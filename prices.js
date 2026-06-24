// Prezzi live via Supabase Edge Function → Yahoo Finance (server-side, nessun problema CORS)
// Cambi EUR via open.er-api.com (CORS nativo, gratuito)

const _YF = {
  // iShares ETF — Euronext Amsterdam (EUR)
  'IWDA': 'IWDA.AS', 'EIMI': 'EIMI.AS', 'CSPX': 'CSPX.AS', 'IEMA': 'IEMA.AS',
  'IUSQ': 'IUSQ.AS', 'IEEM': 'IEEM.AS', 'IQQW': 'IQQW.AS',
  'VWRL': 'VWRL.AS', 'INRG': 'INRG.AS', 'IBCI': 'IBCI.AS',
  // iShares ETF — Xetra / London (EUR/GBp)
  'IQQQ': 'IQQQ.DE', 'XDEM': 'XDEM.DE', 'EMIM': 'EMIM.L',
  // Xtrackers ETF — Xetra (EUR)
  'XMMO': 'XMMO.DE', 'XEON': 'XEON.DE', 'XDWD': 'XDWD.DE',
  'DBXD': 'DBXD.DE', 'DBXJ': 'DBXJ.DE',
  'DBXT': 'XEON.DE',  // Xtrackers II EUR Overnight Rate Swap, ISIN LU0290358497
  // Vanguard ETF
  'VEUR': 'VEUR.AS', 'VFEM': 'VFEM.AS', 'VDEA': 'VDEA.L',
  // Amundi / Lyxor ETF
  'AMEA': 'AMEA.DE', 'CW8': 'CW8.PA', 'LYXD': 'MTD.PA',
  'CBU7': 'CSBGU7.SW', // iShares $ Treasury Bond 3-7YR UCITS ETF USD A — CBU7.DE non risponde su YF
  // Azioni US (USD → convertiti in EUR)
  'NVDA': 'NVDA',  'AAPL': 'AAPL',  'GOOG': 'GOOG',  'GOOGL': 'GOOGL',
  'MSFT': 'MSFT',  'IBM':  'IBM',   'PYPL': 'PYPL',  'STLA': 'STLA',
  'AMZN': 'AMZN',  'META': 'META',  'TSLA': 'TSLA',  'NFLX': 'NFLX',
  'AMGN': 'AMGN',  'INTC': 'INTC',  'AMD':  'AMD',   'BABA': 'BABA',
  'JPM':  'JPM',   'BAC':  'BAC',   'V':    'V',     'MA':   'MA',
  'BA':   'BA',    'GS':   'GS',    'MS':   'MS',    'WMT':  'WMT',
  // Azioni EU (EUR)
  'ASML': 'ASML.AS',
  // Crypto (USD → EUR)
  'BTC': 'BTC-USD', 'ETH': 'ETH-USD', 'SOL': 'SOL-USD', 'ADA': 'ADA-USD',
  'ABTC': 'ABTC.SW',
  // Materie prime (USD)
  'GOLD': 'GC=F', 'PHAU': 'PHAU.L', 'SLVR': 'SI=F',
  '8PSD': 'SGLD.L',   // Invesco Physical Gold ETC USD — SGLD.L (LSE) = stesso ISIN IE00B579F325, funziona su YF
};

const _EDGE_URL  = 'https://qpmwcydwsbfztxkivndk.supabase.co/functions/v1/prices';
const _ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwbXdjeWR3c2JmenR4a2l2bmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDk2MzMsImV4cCI6MjA5NzM4NTYzM30.tdVGw4SAqUoHKeNi7CSvxidsg_XljDrGFPZtfIkEl2U';

async function _fetchFxToEur() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/EUR');
    if (!r.ok) return {};
    const d = await r.json();
    const toEur = { EUR: 1 };
    for (const [cur, rate] of Object.entries(d.rates || {})) toEur[cur] = 1 / rate;
    if (toEur.GBP) toEur.GBp = toEur.GBP / 100;
    return toEur;
  } catch { return {}; }
}

function registerTicker(tk, sym) { _YF[tk] = sym; }

async function fetchLivePrices(tickers, isinMap = {}) {
  const uniq = [...new Set(tickers || [])];

  // Ticker con simbolo YF noto → Yahoo Finance
  const pairs       = uniq.filter(t => _YF[t]).map(t => [t, _YF[t]]);
  const tickerBySym = Object.fromEntries(pairs.map(([tk, sym]) => [sym, tk]));
  const symbols     = pairs.map(([, sym]) => sym);

  // Ticker senza simbolo YF ma con ISIN → Boerse Frankfurt tramite Edge Function
  const isinRequests = uniq
    .filter(t => !_YF[t] && isinMap[t])
    .map(t => ({ ticker: t, isin: isinMap[t] }));

  if (!symbols.length && !isinRequests.length) return {};

  // Per i ticker YF che hanno anche un ISIN: mappa yfSym→isin per il fallback BF
  const isinFallback = {};
  for (const [tk, sym] of pairs) {
    if (isinMap[tk]) isinFallback[sym] = isinMap[tk];
  }

  const body = {};
  if (symbols.length)                body.symbols       = symbols;
  if (isinRequests.length)           body.isinRequests  = isinRequests;
  if (Object.keys(isinFallback).length) body.isinFallback = isinFallback;

  const [raw, fx] = await Promise.all([
    fetch(_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${_ANON_KEY}`,
        'apikey':        _ANON_KEY,
      },
      body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => ({})),
    _fetchFxToEur(),
  ]);

  const out = {};
  for (const [key, data] of Object.entries(raw || {})) {
    // key è il simbolo YF oppure il ticker diretto (per risultati BF)
    const tk = tickerBySym[key] ?? key;
    if (!data?.price) continue;
    let { price, currency, day } = data;
    if (currency !== 'EUR') {
      const rate = fx[currency === 'GBp' ? 'GBp' : currency];
      if (rate) price = price * rate;
    }
    out[tk] = { price, day: day || 0, currency: 'EUR' };
  }
  return out;
}

// Cambio storico BCE per una data specifica (frankfurter.app, gratuito, nessuna API key)
async function fetchHistoricalFxRate(date, currency) {
  if (!currency || currency === 'EUR') return 1;
  try {
    const iso = (date || '').slice(0, 10);
    if (!iso) return null;
    const r = await fetch(`https://api.frankfurter.app/${iso}?from=${currency}&to=EUR`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.rates?.EUR ?? null;
  } catch { return null; }
}

// Ricerca strumento per ticker o ISIN tramite Edge Function → Yahoo Finance search
async function searchInstrument(query) {
  query = (query || '').trim().toUpperCase();
  if (!query) return null;
  try {
    const r = await fetch(_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${_ANON_KEY}`,
        'apikey':        _ANON_KEY,
      },
      body: JSON.stringify({ action: 'search', query }),
    });
    const d = await r.json();
    if (d.error || !d.symbol) return null;
    // converte il prezzo in EUR se necessario
    if (d.currency && d.currency !== 'EUR' && d.price) {
      const fx = await _fetchFxToEur();
      const rate = fx[d.currency === 'GBp' ? 'GBp' : d.currency];
      if (rate) d.priceEur = d.price * rate;
    } else {
      d.priceEur = d.price;
    }
    return d;
  } catch { return null; }
}

function getTickerNativeCurrency(ticker) {
  const sym = _YF[ticker];
  if (!sym) return null;
  if (['.AS', '.DE', '.PA', '.MI'].some(s => sym.endsWith(s))) return 'EUR';
  if (sym.endsWith('.L')) return 'GBp';
  if (sym.endsWith('.SW')) return 'CHF';
  return 'USD';
}

window.PRICES = { fetchLivePrices, registerTicker, searchInstrument, fetchHistoricalFxRate, getTickerNativeCurrency };
