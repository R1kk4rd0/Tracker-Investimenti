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
  'IQQQ': 'IQQQ.DE',
  // Xtrackers ETF — Xetra (EUR)
  'XMMO': 'XMMO.DE', 'XEON': 'XEON.DE', 'XDWD': 'XDWD.DE',
  'DBXD': 'DBXD.DE', 'DBXJ': 'DBXJ.DE',
  // Vanguard ETF — Amsterdam (EUR)
  'VEUR': 'VEUR.AS', 'VFEM': 'VFEM.AS',
  // Amundi ETF
  'AMEA': 'AMEA.DE', 'CW8': 'CW8.PA',
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

async function _fetchOne(yfSym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=1d&interval=1d&includePrePost=false`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const d = await r.json();
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
    const r = await fetch('https://api.frankfurter.app/latest?from=EUR', { headers: { Accept: 'application/json' } });
    if (!r.ok) return {};
    const d = await r.json();
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
