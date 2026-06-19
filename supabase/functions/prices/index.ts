import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

// Mappa quoteType YF → classe asset del tracker
function yfTypeToCls(quoteType: string, shortName: string): string {
  const n = (shortName || '').toUpperCase();
  if (/UCITS|\bETF\b|\bETC\b|\bETN\b/.test(n)) return 'ETF';
  if (quoteType === 'ETF')   return 'ETF';
  if (quoteType === 'MUTUALFUND') return 'ETF';
  if (/\bBTP\b|\bBOND\b|\bMTN\b|TREASURY|GILT|GOVT/.test(n)) return 'Obbligazioni';
  if (quoteType === 'CRYPTOCURRENCY') return 'Criptovalute';
  if (quoteType === 'FUTURE' || /GOLD|SILVER|OIL|COMMODITY/.test(n)) return 'Materie prime';
  return 'Azioni';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const body = await req.json().catch(() => ({}));

  // ── ACTION: search ─────────────────────────────────────────────────────────
  // Input: { action: 'search', query: 'XDEM' | 'IE00BL25JP72' }
  // Output: { symbol, name, cls, currency, isin, exchange, price, day }
  if (body.action === 'search') {
    const query = (body.query || '').trim();
    if (!query) return new Response(JSON.stringify({ error: 'empty query' }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    // 1. Cerca su Yahoo Finance search API (funziona per ticker AND per ISIN)
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0&enableFuzzyQuery=false`;
    let symbol = '';
    let shortName = '';
    let quoteType = 'EQUITY';
    let exchange = '';

    try {
      const sr = await fetch(searchUrl, { headers: HEADERS });
      const sd = await sr.json();
      const quotes: any[] = sd?.finance?.result?.[0]?.quotes || sd?.quotes || [];
      // Preferisci il match esatto per ISIN o ticker
      const best = quotes.find(q => q.symbol === query.toUpperCase())
        || quotes.find(q => (q.longname || q.shortname || '').length > 0)
        || quotes[0];
      if (best) {
        symbol    = best.symbol || '';
        shortName = best.longname || best.shortname || '';
        quoteType = best.quoteType || 'EQUITY';
        exchange  = best.exchange || '';
      }
    } catch { /* continua anche senza search */ }

    // Se la search non ha trovato nulla, prova a usare la query diretta come simbolo
    if (!symbol) symbol = query.toUpperCase();

    // 2. Recupera prezzo + metadati completi via v8/chart
    try {
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&includePrePost=false`;
      const cr = await fetch(chartUrl, { headers: HEADERS });
      const cd = await cr.json();
      const meta = cd?.chart?.result?.[0]?.meta;

      if (meta?.regularMarketPrice) {
        const price    = meta.regularMarketPrice;
        const prev     = meta.chartPreviousClose || meta.previousClose || price;
        const currency = meta.currency || 'USD';
        const name     = shortName || meta.longName || meta.shortName || symbol;
        const cls      = yfTypeToCls(quoteType, name);
        const isin     = meta.isin || '';   // non sempre presente

        return new Response(JSON.stringify({
          symbol, name, cls, currency, isin, exchange,
          price, day: prev ? (price - prev) / prev * 100 : 0,
        }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    } catch { /* fallthrough */ }

    return new Response(JSON.stringify({ error: 'not found', symbol }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // ── ACTION: prices (default) ───────────────────────────────────────────────
  // Input: { symbols: ['AAPL', 'XDEM.DE', ...] }
  const { symbols } = body;
  if (!Array.isArray(symbols) || !symbols.length) {
    return new Response(JSON.stringify({}), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const results: Record<string, { price: number; currency: string; day: number }> = {};

  await Promise.all(symbols.map(async (sym: string) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d&includePrePost=false`;
      const r = await fetch(url, { headers: HEADERS });
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const price = meta.regularMarketPrice;
        const prev  = meta.chartPreviousClose || meta.previousClose || price;
        results[sym] = {
          price,
          currency: meta.currency || 'USD',
          day: prev ? (price - prev) / prev * 100 : 0,
        };
      }
    } catch { /* ignora errori singoli */ }
  }));

  return new Response(JSON.stringify(results), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
