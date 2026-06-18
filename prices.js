// Prezzi live via Yahoo Finance (endpoint pubblico, ~15 min ritardo su mercati aperti)
// Nessuna API key richiesta. Dati solo indicativi — non per uso finanziario professionale.

// Ticker interno → simbolo Yahoo Finance
const _YF = {
  // iShares ETF — Euronext Amsterdam
  'IWDA': 'IWDA.AS', 'EIMI': 'EIMI.AS', 'CSPX': 'CSPX.AS', 'IEMA': 'IEMA.AS',
  'IUSQ': 'IUSQ.AS', 'IEEM': 'IEEM.AS', 'IQQW': 'IQQW.AS',
  'VWRL': 'VWRL.AS', 'INRG': 'INRG.AS', 'IBCI': 'IBCI.AS',
  // iShares ETF — Xetra
  'IQQQ': 'IQQQ.DE',
  // Xtrackers ETF — Xetra
  'XMMO': 'XMMO.DE', 'XEON': 'XEON.DE', 'XDWD': 'XDWD.DE',
  'DBXD': 'DBXD.DE', 'DBXJ': 'DBXJ.DE',
  // Vanguard ETF — Amsterdam
  'VEUR': 'VEUR.AS', 'VFEM': 'VFEM.AS',
  // Amundi ETF
  'AMEA': 'AMEA.DE', 'CW8': 'CW8.PA',
  // Azioni US (ticker identico a Yahoo)
  'NVDA': 'NVDA',   'AAPL': 'AAPL',   'GOOG': 'GOOG',   'GOOGL': 'GOOGL',
  'MSFT': 'MSFT',   'IBM':  'IBM',    'PYPL': 'PYPL',   'STLA': 'STLA',
  'AMZN': 'AMZN',   'META': 'META',   'TSLA': 'TSLA',   'NFLX': 'NFLX',
  'AMGN': 'AMGN',   'INTC': 'INTC',   'AMD':  'AMD',    'BABA': 'BABA',
  'JPM':  'JPM',    'BAC':  'BAC',    'V':    'V',      'MA': 'MA',
  // Azioni EU
  'ASML': 'ASML.AS',
  // Crypto — prezzo underlying in USD
  'BTC':  'BTC-USD', 'ETH': 'ETH-USD', 'SOL': 'SOL-USD', 'ADA': 'ADA-USD',
  // Crypto ETP (21Shares, SIX Swiss Exchange)
  'ABTC': 'ABTC.SW',
  // Materie prime
  'GOLD': 'GC=F', 'PHAU': 'PHAU.L', 'SLVR': 'SI=F',
  // BTP e obbligazioni governative: non disponibili su Yahoo → omessi
};

async function _fetchOne(yfSym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=1d&interval=1d&includePrePost=false`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) return null;
  const d = await r.json();
  const meta = d?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;
  const price = meta.regularMarketPrice;
  const prev  = meta.chartPreviousClose || meta.previousClose || price;
  return { price, day: prev ? (price - prev) / prev * 100 : 0, currency: meta.currency || 'USD' };
}

// Aggiunge una voce alla mappa _YF a runtime (usato dall'utente per ticker custom)
function registerTicker(internalTicker, yahooSymbol) {
  _YF[internalTicker] = yahooSymbol;
}

async function fetchLivePrices(tickers) {
  const pairs = [...new Set((tickers || []).filter(t => _YF[t]))].map(t => [t, _YF[t]]);
  if (!pairs.length) return {};
  const settled = await Promise.allSettled(pairs.map(([, sym]) => _fetchOne(sym)));
  const out = {};
  pairs.forEach(([tk], i) => {
    const r = settled[i];
    if (r.status === 'fulfilled' && r.value) out[tk] = r.value;
  });
  return out;
}

window.PRICES = { fetchLivePrices, registerTicker };
