// Prezzi di mercato statici (aggiornare manualmente o sostituire con fetch API)
window.MARKET_DATA = {
  NVDA:  { name: 'NVIDIA Corp',             cls: 'Azioni',        price: 1085.40, day:  1.85, isin: 'US67066G1040' },
  AAPL:  { name: 'Apple Inc.',              cls: 'Azioni',        price:  198.20, day: -0.42, isin: 'US0378331005' },
  ASML:  { name: 'ASML Holding',            cls: 'Azioni',        price:  905.00, day:  0.95, isin: 'NL0010273215' },
  IWDA:  { name: 'iShares Core MSCI World', cls: 'Azioni',        price:  101.20, day:  0.30, isin: 'IE00B4L5Y983' },
  BTC:   { name: 'Bitcoin',                 cls: 'Criptovalute',  price: 58420,   day:  3.21, isin: ''             },
  ETH:   { name: 'Ethereum',                cls: 'Criptovalute',  price:  2980,   day: -1.10, isin: ''             },
  BTP30: { name: 'BTP Italia 2030',         cls: 'Obbligazioni',  price:   97.80, day:  0.12, isin: 'IT0005425233' },
  GOLD:  { name: 'Oro (oncia)',             cls: 'Materie prime', price:  2155,   day:  0.65, isin: ''             },
  STLA:  { name: 'Stellantis',              cls: 'Azioni',        price:   14.50, day: -0.80, isin: 'NL00150001Q9' },
  PYPL:  { name: 'PayPal Holdings',         cls: 'Azioni',        price:   62.00, day:  0.40, isin: 'US70450Y1038' },
};

// Colori per classe asset
window.CLS_COLORS = {
  'Azioni':        '#5B9DF9',
  'Criptovalute':  '#A78BFA',
  'Obbligazioni':  '#14B8A6',
  'Materie prime': '#E5B567',
  'Liquidità':     '#5A6678',
};

// Liquidità disponibile (€)
window.CASH_BALANCE = 18500;
