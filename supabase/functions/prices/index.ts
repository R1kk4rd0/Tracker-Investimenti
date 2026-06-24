import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

const BF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/event-stream',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8',
};

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

// Prova a recuperare il prezzo da Boerse Frankfurt per ISIN.
// L'API risponde in formato SSE (data:{...}) con currency come oggetto.
// Tenta XFRA (bond + ETC) poi XETR (ETF/azioni).
async function fetchFromBF(isin: string): Promise<{ price: number; currency: string; day: number } | null> {
  for (const mic of ['XFRA', 'XETR']) {
    try {
      const url = `https://api.boerse-frankfurt.de/v1/data/price_information?isin=${encodeURIComponent(isin)}&mic=${mic}`;
      const r = await fetch(url, { headers: BF_HEADERS });
      if (!r.ok || !r.body) continue;
      // SSE stream: leggi solo il primo chunk e chiudi subito la connessione
      const reader = r.body.getReader();
      const { value } = await reader.read();
      reader.cancel();
      const text = new TextDecoder().decode(value);
      // Estrai il JSON dal formato SSE: "data:{...}"
      const match = text.match(/data:(\{[^\n]+\})/);
      if (!match) continue;
      const d = JSON.parse(match[1]);
      const price = d.lastPrice ?? d.currentPrice;
      if (!price || price <= 0) continue;
      const currency = typeof d.currency === 'string' ? d.currency : (d.currency?.originalValue ?? 'EUR');
      const day = d.changeToPrevDayInPercent ?? 0;
      return { price, currency, day };
    } catch { /* prova mic successivo */ }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const body = await req.json().catch(() => ({}));
  const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  // ── ACTION: debug_bf ─────────────────────────────────────────────────────
  if (body.action === 'debug_bf') {
    const isin = body.isin || 'IE00B579F325';
    const mic  = body.mic  || 'XFRA';
    const url = `https://api.boerse-frankfurt.de/v1/data/price_information?isin=${encodeURIComponent(isin)}&mic=${mic}`;
    try {
      const r = await fetch(url, { headers: BF_HEADERS });
      const status = r.status;
      const headers_out: Record<string,string> = {};
      r.headers.forEach((v, k) => { headers_out[k] = v; });
      if (!r.body) return json({ status, headers: headers_out, error: 'no body' });
      const reader = r.body.getReader();
      const chunks: string[] = [];
      for (let i = 0; i < 3; i++) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(new TextDecoder().decode(value));
      }
      reader.cancel();
      return json({ status, headers: headers_out, chunks });
    } catch (e: any) {
      return json({ error: e?.message || String(e) });
    }
  }

  // ── ACTION: search ─────────────────────────────────────────────────────────
  if (body.action === 'search') {
    const query = (body.query || '').trim();
    if (!query) return json({ error: 'empty query' });

    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0&enableFuzzyQuery=false`;
    let symbol = '';
    let shortName = '';
    let quoteType = 'EQUITY';
    let exchange = '';

    try {
      const sr = await fetch(searchUrl, { headers: YF_HEADERS });
      const sd = await sr.json();
      const quotes: any[] = sd?.finance?.result?.[0]?.quotes || sd?.quotes || [];
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

    if (!symbol) symbol = query.toUpperCase();

    try {
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&includePrePost=false`;
      const cr = await fetch(chartUrl, { headers: YF_HEADERS });
      const cd = await cr.json();
      const meta = cd?.chart?.result?.[0]?.meta;

      if (meta?.regularMarketPrice) {
        const price    = meta.regularMarketPrice;
        const prev     = meta.chartPreviousClose || meta.previousClose || price;
        const currency = meta.currency || 'USD';
        const name     = shortName || meta.longName || meta.shortName || symbol;
        const cls      = yfTypeToCls(quoteType, name);
        const isin     = meta.isin || '';

        return json({ symbol, name, cls, currency, isin, exchange, price, day: prev ? (price - prev) / prev * 100 : 0 });
      }
    } catch { /* fallthrough */ }

    return json({ error: 'not found', symbol });
  }

  // ── ACTION: prices ─────────────────────────────────────────────────────────
  // Input: { symbols: string[], isinRequests?: Array<{ticker: string, isin: string}> }
  const { symbols, isinRequests } = body;

  const results: Record<string, { price: number; currency: string; day: number }> = {};

  // 1. Yahoo Finance per i simboli noti
  const yfSymbols: string[] = Array.isArray(symbols) ? symbols : [];
  if (yfSymbols.length) {
    await Promise.all(yfSymbols.map(async (sym: string) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d&includePrePost=false`;
        const r = await fetch(url, { headers: YF_HEADERS });
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          const price = meta.regularMarketPrice;
          const prev  = meta.chartPreviousClose || meta.previousClose || price;
          results[sym] = { price, currency: meta.currency || 'USD', day: prev ? (price - prev) / prev * 100 : 0 };
        }
      } catch { /* ignora errori singoli */ }
    }));
  }

  // 2. Boerse Frankfurt come fallback per simboli YF che non hanno restituito dati
  //    isinFallback: { [yfSymbol]: isin } — inviato da prices.js per i ticker con ISIN noto
  const isinFallback: Record<string, string> = (body.isinFallback && typeof body.isinFallback === 'object') ? body.isinFallback : {};
  const missingYf = yfSymbols.filter(sym => !results[sym] && isinFallback[sym]);
  if (missingYf.length) {
    await Promise.all(missingYf.map(async (sym) => {
      const bf = await fetchFromBF(isinFallback[sym]);
      if (bf) results[sym] = bf;
    }));
  }

  // 3. Boerse Frankfurt per strumenti senza ticker YF (bond, ETC, ecc.)
  const isinReqs: Array<{ ticker: string; isin: string }> = Array.isArray(isinRequests) ? isinRequests : [];
  if (isinReqs.length) {
    await Promise.all(isinReqs.map(async ({ ticker, isin }) => {
      if (!isin) return;
      const bf = await fetchFromBF(isin);
      if (bf) results[ticker] = bf;
    }));
  }

  return json(results);
});
