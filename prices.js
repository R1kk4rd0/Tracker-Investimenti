// Prezzi live via Yahoo Finance (~15 min ritardo, nessuna API key)
// Cambi EUR via Frankfurter.app (dati ECB, gratuito)
// Solo indicativo — non per uso finanziario professionale.

// Ticker interno → simbolo Yahoo Finance
const _YF = {
  // iShares ETF — Euronext Amsterdam (quotati in EUR)
  'IWDA': 'IWDA.AS', 'EIMI': 'EIMI.AS', 'CSPX': 'CSPX.AS', 'IEMA': 'IEMA.AS',
  'IUSQ': 'IUSQ.AS', 'IEEM': 'IEEM.AS', 'IQQW': 'IQQW.AS',
  'VWRL': 'VWRL.AS', 'INRG': 'INRG.AS', 'IBCI': 'IBCI.AS',
  // iShares ETF — Xetra (EUR)
  'IQQQ': 'IQQQ.DE', 'XDEM': 'XDEM.DE', 'EMIM': 'EMIM.L',
  // Xtrackers ETF — Xetra (EUR)
  'XMMO': 'XMMO.DE', 'XEON': 'XEON.DE', 'XDWD': 'XDWD.DE',
  'DBXD': 'DBXD.DE', 'DBXJ': 'DBXJ.DE',
  // Vanguard ETF — Amsterdam (EUR)
  'VEUR': 'VEUR.AS', 'VFEM': 'VFEM.AS', 'VDEA': 'VDEA.L',
  // Amundi / Lyxor ETF
  'AMEA': 'AMEA.DE', 'CW8': 'CW8.PA', 'LYXD': 'LYXD.PA', 'CBU7': 'CBU7.DE',
  // Azioni US (USD — verranno convertiti in EUR)
  'NVDA': 'NVDA',   'AAPL': 'AAPL',   'GOOG': 'GOOG',   'GOOGL': 'GOOGL',
  'MSFT': 'MSFT',   'IBM':  'IBM',    'PYPL': 'PYPL',   'STLA': 'STLA',
  'AMZN': 'AMZN',   'META': 'META',   'TSLA': 'TSLA',   'NFLX': 'NFLX',
  'AMGN': 'AMGN',   'INTC': 'INTC',   'AMD':  'AMD',    'BABA': 'BABA',
  'JPM':  'JPM',    'BAC':  'BAC',    'V':    'V',      'MA': 'MA',
  // Azioni EU (EUR)
  'ASML': 'ASML.AS',
  // Crypto — underlying in USD, convertiti in EUR
  'BTC':  'BTC-USD', 'ETH': 'ETH-USD', 'SOL': 'SOL-USD', 'ADA': 'ADA-USD',
  // Crypto ETP — SIX Swiss Exchange (CHF → verranno convertiti in EUR)
  'ABTC': 'ABTC.SW',
  // Materie prime (USD)
  'GOLD': 'GC=F', 'PHAU': 'PHAU.L', 'SLVR': 'SI=F',
  // BTP e obbligazioni governative: non disponibili su Yahoo → omessi
};

const _PROXY_URLS = [
  (u) => u,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

function _extractJsonText(text) {
  const t = String(text || '');
  if (!t) return '';

  const firstBrace = t.indexOf('{');
  const firstBracket = t.indexOf('[');
  const first = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket) ? firstBrace : firstBracket;
  if (first === -1) return '';

  const open = t[first];
  let depth = 0;
  for (let i = first; i < t.length; i++) {
    if (t[i] === open) depth++;
    else if (t[i] === (open === '{' ? '}' : ']')) depth--;
    if (depth === 0 && i > first) {
      return t.slice(first, i + 1);
    }
  }

  return t.slice(first);
}

async function _fetchJson(url) {
  for (const toUrl of _PROXY_URLS) {
    try {
      const candidate = toUrl(url);
      const r = await fetch(candidate, { headers: { Accept: 'application/json' } });
      const text = await r.text();
      if (!r.ok || !text) {
        console.log('[prices] fetch failed', { candidate, ok: r.ok, status: r.status });
        continue;
      }
      const jsonText = _extractJsonText(text);
      if (!jsonText) {
        console.log('[prices] no json payload', { candidate, preview: String(text).slice(0, 200) });
        continue;
      }
      const parsed = JSON.parse(jsonText);
      console.log('[prices] success', { candidate, parsed: !!parsed?.chart });
      return parsed;
    } catch (e) {
      console.log('[prices] exception', { candidate, error: String(e) });
    }
  }
  return null;
}

async function _fetchOne(yfSym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=1d&interval=1d&includePrePost=false`;
  try {
    const d = await _fetchJson(url);
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || meta.previousClose || price;
    return { price, day: prev ? (price - prev) / prev * 100 : 0, currency: meta.currency || 'USD' };
  } catch { return null; }
}

// Restituisce { USD: 0.924, GBP: 1.163, CHF: 1.072, ... } — quanti EUR vale 1 unità di valuta estera
async function _fetchFxToEur() {
  try {
    // open.er-api.com ha CORS nativo (no proxy needed); Frankfurter come fallback
    const d = await (async () => {
      try {
        const r = await fetch('https://open.er-api.com/v6/latest/EUR', { headers: { Accept: 'application/json' } });
        if (r.ok) { const j = await r.json(); if (j?.rates) return j; }
      } catch {}
      return _fetchJson('https://api.frankfurter.app/latest?from=EUR');
    })();
    if (!d?.rates) return {};
    // d.rates = { USD: 1.081, GBP: 0.859, CHF: 0.933, ... } — 1 EUR = X unità
    // Invertiamo: 1 unità = (1/X) EUR
    const toEur = { EUR: 1 };
    for (const [cur, rate] of Object.entries(d.rates || {})) {
      toEur[cur] = 1 / rate;
    }
    // GBp (penny sterling, usato da Yahoo per LSE) = GBP / 100
    if (toEur.GBP) toEur.GBp = toEur.GBP / 100;
    return toEur;
  } catch { return {}; }
}

// Aggiunge una voce alla mappa _YF a runtime (ticker custom dell'utente)
function registerTicker(internalTicker, yahooSymbol) {
  _YF[internalTicker] = yahooSymbol;
}

async function fetchLivePrices(tickers) {
  const pairs = [...new Set((tickers || []).filter(t => _YF[t]))].map(t => [t, _YF[t]]);
  if (!pairs.length) return {};

  // Prezzi e cambi FX in parallelo per velocità
  const [settled, fx] = await Promise.all([
    Promise.allSettled(pairs.map(([, sym]) => _fetchOne(sym))),
    _fetchFxToEur(),
  ]);

  const out = {};
  pairs.forEach(([tk], i) => {
    const r = settled[i];
    if (r.status !== 'fulfilled' || !r.value) return;
    let { price, day, currency } = r.value;

    // Converti in EUR se necessario
    if (currency !== 'EUR') {
      // GBp (penny sterling) → GBP prima, poi EUR
      const lookupKey = currency === 'GBp' ? 'GBp' : currency;
      const rate = fx[lookupKey];
      if (rate) {
        price = price * rate;
      }
      // Se il tasso non è disponibile (ex. valuta rara), il prezzo resta nella valuta originale
      // e viene mostrato con il prefisso "~" dal getMkt() tramite hasLivePrice=false
    }

    out[tk] = { price, day, currency: 'EUR' };
  });

  return out;
}

window.PRICES = { fetchLivePrices, registerTicker };
