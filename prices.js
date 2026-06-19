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
  // Vanguard ETF
  'VEUR': 'VEUR.AS', 'VFEM': 'VFEM.AS', 'VDEA': 'VDEA.L',
  // Amundi / Lyxor ETF
  'AMEA': 'AMEA.DE', 'CW8': 'CW8.PA', 'LYXD': 'LYXD.PA', 'CBU7': 'CBU7.DE',
  // Azioni US (USD → convertiti in EUR)
  'NVDA': 'NVDA',  'AAPL': 'AAPL',  'GOOG': 'GOOG',  'GOOGL': 'GOOGL',
  'MSFT': 'MSFT',  'IBM':  'IBM',   'PYPL': 'PYPL',  'STLA': 'STLA',
  'AMZN': 'AMZN',  'META': 'META',  'TSLA': 'TSLA',  'NFLX': 'NFLX',
  'AMGN': 'AMGN',  'INTC': 'INTC',  'AMD':  'AMD',   'BABA': 'BABA',
  'JPM':  'JPM',   'BAC':  'BAC',   'V':    'V',     'MA':   'MA',
  // Azioni EU (EUR)
  'ASML': 'ASML.AS',
  // Crypto (USD → EUR)
  'BTC': 'BTC-USD', 'ETH': 'ETH-USD', 'SOL': 'SOL-USD', 'ADA': 'ADA-USD',
  'ABTC': 'ABTC.SW',
  // Materie prime (USD)
  'GOLD': 'GC=F', 'PHAU': 'PHAU.L', 'SLVR': 'SI=F',
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

async function fetchLivePrices(tickers) {
  const pairs = [...new Set((tickers || []).filter(t => _YF[t]))].map(t => [t, _YF[t]]);
  if (!pairs.length) return {};

  const symbols      = pairs.map(([, sym]) => sym);
  const tickerBySym  = Object.fromEntries(pairs.map(([tk, sym]) => [sym, tk]));

  const [raw, fx] = await Promise.all([
    fetch(_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${_ANON_KEY}`,
        'apikey':        _ANON_KEY,
      },
      body: JSON.stringify({ symbols }),
    }).then(r => r.json()).catch(() => ({})),
    _fetchFxToEur(),
  ]);

  const out = {};
  for (const [sym, data] of Object.entries(raw || {})) {
    const tk = tickerBySym[sym];
    if (!tk || !data?.price) continue;
    let { price, currency, day } = data;
    if (currency !== 'EUR') {
      const rate = fx[currency === 'GBp' ? 'GBp' : currency];
      if (rate) price = price * rate;
    }
    out[tk] = { price, day: day || 0, currency: 'EUR' };
  }
  return out;
}

window.PRICES = { fetchLivePrices, registerTicker };
