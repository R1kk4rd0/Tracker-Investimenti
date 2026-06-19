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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { symbols } = await req.json().catch(() => ({ symbols: [] }));
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
