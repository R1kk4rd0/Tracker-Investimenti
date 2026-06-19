// CSV import — DEGIRO (altri broker da aggiungere)

// ── ISIN → ticker per ETF e titoli comuni ────────────────────────────────────
const _ISIN_TICKER = {
  // iShares
  'IE00B4L5Y983': 'IWDA',  'IE00BKM4GZ66': 'EIMI',  'IE00B5BMR087': 'CSPX',
  'IE00B52MJY50': 'IEMA',  'IE00BYX2JD69': 'IUSQ',  'IE00B0M62X26': 'IEEM',
  'IE00B14X4S71': 'IQQQ',  'IE00B6R52259': 'IQQW',  'IE00B3RBWM25': 'VWRL',
  'IE00B3F81R35': 'INRG',  'IE00B4ND3602': 'IBCI',
  // Xtrackers
  'IE00BL25JP72': 'XMMO',  'LU0290358497': 'XEON',  'LU1681048804': 'XDWD',
  'LU0274208692': 'DBXD',  'LU0292096186': 'DBXJ',
  // Vanguard
  'IE00B3VVMM84': 'VEUR',  'IE00B5456744': 'VFEM',
  // Amundi
  'LU1681045370': 'AMEA',  'FR0010315770': 'CW8',
  // Azioni singole comuni
  'NL0010273215': 'ASML',  'US67066G1040': 'NVDA',  'US0378331005': 'AAPL',
  'US38259P5089': 'GOOG',  'US5949181045': 'MSFT',  'US4592001014': 'IBM',
  // Crypto ETP
  'XS2376095068': 'BTC',   'CH0454664001': 'ABTC',
  // Materie prime / ETC
  'DE000A0S9GB0': 'GOLD',  'GB00B00FHZ82': 'PHAU',
  // Obbligazioni governative
  'IT0005209493': 'BTP30',
  'AT0000A2HLC4': 'OEAT',  // Austria 100 anni 2120
};

// ── Rilevamento classe da nome prodotto ────────────────────────────────────────
function _detectClass(name) {
  const n = name.toUpperCase();
  // ETF/ETC/ETN: priorità massima — un ETF che investe in bond rimane ETF, non Obbligazioni
  if (/UCITS|\bETF\b|\bETC\b|\bETN\b/.test(n)) return 'ETF';
  // Bond diretti (solo titoli senza wrapper ETF/ETC)
  if (/\bMTN\b|\bGOVT\b|TREASURY|GILT|\bBTP\b|\bBOT\b|\bBOND\b/.test(n))     return 'Obbligazioni';
  // Asset diretti
  if (/BITCOIN|ETHEREUM|CRYPTO|\bBTC\b|\bETH\b/.test(n))                       return 'Criptovalute';
  if (/\bGOLD\b|SILVER|OIL|COMMODITY|METAL|\bGAS\b/.test(n))                  return 'Materie prime';
  if (/OVERNIGHT|MONEY.MARKET|LIQUIDITY|CASH/.test(n))                         return 'Liquidità';
  return 'Azioni';
}

// ── Parsing CSV con gestione virgolette ────────────────────────────────────────
function _csvLine(line) {
  const cols = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { cols.push(cur); cur = ''; }
    else cur += c;
  }
  cols.push(cur);
  return cols;
}

// Numero italiano: "67,0000" → 67.0  |  "-3,00" → -3
function _itNum(s) {
  return parseFloat(String(s || '0').replace(',', '.')) || 0;
}

// Data DB (YYYY-MM-DD) → display italiano (DD/MM/YYYY)
function _fmtDateIT(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Data DEGIRO "21-11-2025" → ISO "2025-11-21"
function _degiroDate(s) {
  const p = (s || '').trim().split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s;
}

// ── Parser DEGIRO ──────────────────────────────────────────────────────────────
function parseDegiroCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = _csvLine(lines[i]);
    if (!c[2] || !c[3]) continue;
    const rawQty = _itNum(c[6]);
    if (rawQty === 0) continue;
    const isin  = c[3].trim();
    const name  = c[2].trim();
    const cls   = _detectClass(name);
    const qty   = Math.abs(rawQty);
    // c[7]  = prezzo nella valuta locale dell'asset (USD per azioni USA, EUR per EU, % per bond)
    // c[9]  = valuta locale (es. "USD", "EUR")
    // c[10] = valore totale in EUR già convertito da DeGiro al tasso del giorno
    // Per obbligazioni: price è % del nominale → lo teniamo così (controvalore = qty × price / 100)
    // Per asset in USD/GBP/CHF: usiamo c[10]/qty per ottenere il prezzo in EUR
    const rawPrice     = Math.abs(_itNum(c[7]));
    const localCur     = (c[9] || '').trim().toUpperCase();
    const valoreEur    = Math.abs(_itNum(c[10]));
    let price;
    if (cls === 'Obbligazioni') {
      price = rawPrice;  // % nominale, invariata
    } else if (localCur && localCur !== 'EUR' && valoreEur > 0 && qty > 0) {
      price = valoreEur / qty;  // EUR price = EUR value / qty
    } else {
      price = rawPrice;  // già in EUR
    }
    const controvalore = cls === 'Obbligazioni' ? qty * price / 100 : qty * price;
    rows.push({
      _sel: true,
      date:         _degiroDate(c[0]),
      type:         rawQty > 0 ? 'Acquisto' : 'Vendita',
      name, isin, cls,
      ticker:       _ISIN_TICKER[isin] || '',
      qty, price,
      fees:         Math.abs(_itNum(c[14])),
      controvalore,
      currency:     'EUR',
      broker:       'DEGIRO',
      exchange:     c[5].trim(),
      note:         '',
    });
  }
  return rows;
}

// ── Auto-rilevamento formato dal header ────────────────────────────────────────
function detectAndParse(text) {
  const h = (text.split('\n')[0] || '').toLowerCase();
  if (h.includes('id ordine') || h.includes('prodotto') || h.includes('borsa di riferimento')) {
    return { rows: parseDegiroCSV(text), broker: 'DEGIRO' };
  }
  return null;
}

window.IMPORT = { detectAndParse, fmtDateIT: _fmtDateIT };
