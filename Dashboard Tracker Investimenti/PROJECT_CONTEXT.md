# PROJECT CONTEXT — Investment Portfolio Tracker
> Incolla questo file nella root del progetto come `PROJECT_CONTEXT.md` e referenzialo in ogni sessione AI con VS Code (Copilot, Cursor, ecc.)

---

## 1. Panoramica del prodotto

**Nome provvisorio:** PortfolioTrack (da definire)  
**Tipo:** Web app SaaS, single-page application (SPA)  
**Target utente:** Investitori retail italiani, privati con portafoglio titoli su uno o più broker  
**Obiettivo core:** Aggregare posizioni di investimento da fonti diverse, calcolare plusvalenze e minusvalenze realizzate, tenere traccia dello zaino fiscale annuo, e offrire una vista chiara dell'esposizione complessiva del portafoglio

---

## 2. Feature principali (MVP)

### 2.1 Dashboard portafoglio
- Vista aggregata di tutte le posizioni aperte (titoli, ETF, obbligazioni, crypto)
- Valore attuale, costo medio di carico, P&L non realizzato (assoluto e percentuale)
- Allocazione per asset class, settore, valuta, area geografica
- Grafici: composizione torta, andamento valore nel tempo (linea), benchmark opzionale

### 2.2 Tracker transazioni
- Inserimento manuale buy/sell/dividendo/cedola/rimborso
- Import CSV da broker (Fineco, DEGIRO, Directa, Flatex, IBKR, Scalable Capital)
- Supporto a operazioni in valuta estera con conversione EUR al cambio del giorno
- Storico transazioni filtrabile per data, ticker, tipo operazione, broker

### 2.3 Calcolo plusvalenze e minusvalenze realizzate
- Metodo FIFO (default Italia per persone fisiche regime dichiarativo)
- Opzione LIFO e costo medio ponderato (per usi gestionali, non fiscali)
- Report annuale e per periodo personalizzato:
  - Plus realizzate (redditi diversi)
  - Minus realizzate (perdite compensabili)
  - Saldo netto per anno fiscale
- Separazione tra redditi di capitale (dividendi, cedole) e redditi diversi (capital gain) — rilevante ai fini fiscali italiani

### 2.4 Zaino fiscale (tax loss carry-forward)
- Tracciamento automatico delle minusvalenze compensabili per anno di generazione
- Scadenza: le minus sono compensabili entro i 4 anni successivi alla realizzazione (art. 68 TUIR)
- Calcolo residuo disponibile per compensazione per anno di scadenza
- Alert quando minus stanno per scadere (entro 12 mesi)
- Simulatore: "se vendo X titolo ora, quanto compenso?"

### 2.5 Report fiscali annuali
- Riepilogo per anno d'imposta (1 gen — 31 dic)
- Export PDF e CSV compatibili con dichiarazione dei redditi (quadro RT, quadro RV)
- Storico multi-anno side-by-side

### 2.6 Gestione multi-broker e multi-account
- Più conti dello stesso utente (es. Fineco + DEGIRO + conto deposito)
- Distinzione tra regime amministrato e dichiarativo per conto
- Consolidamento automatico vista unificata

---

## 3. Stack tecnico definito

### Frontend
- **Framework:** React 18 + TypeScript
- **Build tool:** Vite
- **Routing:** React Router v6
- **State management:** Zustand (global) + React Query (server state / cache)
- **UI library:** shadcn/ui (componenti base) + Tailwind CSS
- **Grafici:** Recharts (grafici principali), opzionale Tremor per dashboard cards
- **Tabelle:** TanStack Table v8 (sorting, filtering, pagination lato client)
- **Form:** React Hook Form + Zod (validazione schema)
- **Date:** date-fns (manipolazione date, calcoli per anno fiscale)
- **Export:** jsPDF + jspdf-autotable (PDF), PapaParse (CSV import/export)

### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify (preferito a Express per performance e schema-first)
- **ORM:** Prisma
- **Database:** PostgreSQL (hosted su Supabase o Railway)
- **Auth:** Supabase Auth (email/password + magic link, futuro OAuth Google)
- **API:** REST con OpenAPI spec (Fastify + @fastify/swagger)
- **Job queue:** BullMQ + Redis (import asincrono CSV, calcoli pesanti, refresh prezzi ogni 15 min)
- **Storage:** Supabase Storage (upload file CSV, export PDF)
- **Market data primario:** `yahoo-finance2` (npm, no API key, 15 min delay, covre MIL/NYSE/NASDAQ/XETRA)
- **Market data fallback:** Twelve Data API (free tier 800 req/giorno, covre borse europee, ISIN nativo)
- **Tassi di cambio:** Frankfurter.app (wrapper ECB, gratuito, storico + real-time)

### Infrastruttura
- **Deploy frontend:** Vercel
- **Deploy backend:** Railway o Render
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **Cache/Queue:** Upstash Redis (serverless-friendly)
- **CI/CD:** GitHub Actions
- **Monorepo:** pnpm workspaces con struttura `apps/web`, `apps/api`, `packages/shared`

---

## 4. Struttura del monorepo

```
/
├── apps/
│   ├── web/                    # Frontend React
│   │   ├── src/
│   │   │   ├── components/     # UI components (shadcn + custom)
│   │   │   ├── pages/          # Route-level components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── lib/            # Utility functions, api client
│   │   │   ├── types/          # TypeScript types (front-end specific)
│   │   │   └── features/       # Feature slices (portfolio, transactions, tax)
│   │   └── vite.config.ts
│   │
│   └── api/                    # Backend Fastify
│       ├── src/
│       │   ├── routes/         # Route handlers
│       │   ├── services/       # Business logic
│       │   ├── repositories/   # DB queries (Prisma)
│       │   ├── jobs/           # BullMQ job processors
│       │   ├── plugins/        # Fastify plugins (auth, cors, swagger)
│       │   └── utils/          # Helpers (FIFO calc, currency conversion, ecc.)
│       └── prisma/
│           └── schema.prisma
│
├── packages/
│   └── shared/                 # Tipi e utility condivisi tra web e api
│       ├── types/
│       └── constants/
│
├── pnpm-workspace.yaml
└── PROJECT_CONTEXT.md          # Questo file
```

---

## 5. Schema dati core (Prisma)

```prisma
model User {
  id          String    @id @default(cuid())
  email       String    @unique
  accounts    Account[]
  createdAt   DateTime  @default(now())
}

model Account {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  name        String        // es. "Fineco principale"
  broker      String        // es. "fineco" | "degiro" | "ibkr"
  regime      String        // "amministrato" | "dichiarativo"
  currency    String        @default("EUR")
  transactions Transaction[]
}

model Transaction {
  id            String    @id @default(cuid())
  accountId     String
  account       Account   @relation(fields: [accountId], references: [id])
  type          String    // "buy" | "sell" | "dividend" | "coupon" | "fee"
  ticker        String    // ISIN o symbol
  assetName     String?
  assetClass    String    // "equity" | "etf" | "bond" | "crypto" | "other"
  quantity      Decimal
  pricePerUnit  Decimal
  currency      String    // valuta della transazione
  fxRateToEur   Decimal   @default(1) // tasso di cambio al momento della transazione
  totalValueEur Decimal   // quantity * pricePerUnit * fxRateToEur + fees
  fees          Decimal   @default(0)
  tradeDate     DateTime
  settlementDate DateTime?
  notes         String?
  importedFrom  String?   // "csv_fineco" | "manual" | "api"
  createdAt     DateTime  @default(now())
}

model TaxLot {
  id              String   @id @default(cuid())
  accountId       String
  ticker          String
  quantity        Decimal
  costBasisEur    Decimal  // costo medio di carico in EUR
  acquisitionDate DateTime
  remainingQty    Decimal  // per FIFO: quantità non ancora venduta
  closed          Boolean  @default(false)
}

model RealizedGainLoss {
  id              String   @id @default(cuid())
  accountId       String
  ticker          String
  taxYear         Int      // anno fiscale (es. 2024)
  sellDate        DateTime
  quantity        Decimal
  proceedsEur     Decimal
  costBasisEur    Decimal
  gainLossEur     Decimal  // positivo = plusvalenza, negativo = minusvalenza
  isGain          Boolean
  usedForOffset   Boolean  @default(false)
}

model TaxBackpack {
  id              String   @id @default(cuid())
  userId          String
  taxYear         Int      // anno in cui è stata realizzata la minus
  expiryYear      Int      // taxYear + 4 (scadenza compensazione)
  totalLossEur    Decimal  // perdita originale
  usedLossEur     Decimal  @default(0) // quanto già compensato
  remainingEur    Decimal  // totalLossEur - usedLossEur
  expired         Boolean  @default(false)
}
```

---

## 6. Logica di business critica

### 6.1 Calcolo FIFO (First In, First Out)
```
Per ogni operazione di vendita:
1. Recupera tutti i TaxLot aperti per quel ticker, ordinati per acquisitionDate ASC
2. Scala la quantità venduta dai lot più vecchi prima
3. Per ogni lot consumato: calcola (prezzo_vendita - costoBasis) * quantità_consumata
4. Somma i risultati per ottenere gain/loss totale dell'operazione
5. Aggiorna remainingQty dei lot parzialmente consumati
6. Marca come closed i lot completamente esauriti
7. Salva RealizedGainLoss con il taxYear derivato da sellDate
```

### 6.2 Zaino fiscale
```
Al termine di ogni anno fiscale (o on-demand):
1. Somma tutte le RealizedGainLoss con isGain=false e taxYear=X → totalLoss
2. Somma tutte le RealizedGainLoss con isGain=true e taxYear=X → totalGain
3. Se totalLoss > totalGain: crea/aggiorna TaxBackpack con:
   - taxYear = X
   - expiryYear = X + 4
   - totalLossEur = eccedenza di perdita non compensata
4. In anni successivi: quando si realizzano plusvalenze, compensarle con TaxBackpack
   più vecchi prima (quelli in scadenza più vicina)
```

### 6.3 Conversione valuta
```
- Tasso di cambio EUR/XXX preso alla data di trade (API: ECB, Frankfurter.app, o OpenExchangeRates)
- Per gli ETF in USD su borsa americana: usare cambio USD/EUR alla data di esecuzione
- Sempre storicizzare il fxRateToEur sulla transazione al momento dell'import
- Non ricalcolare mai i tassi storici a posteriori
```

### 6.4 Separazione redditi (regime dichiarativo)
```
Redditi di CAPITALE (non compensabili con minus da redditi diversi):
- Dividendi da azioni
- Cedole obbligazioni
- Proventi da ETF a distribuzione

Redditi DIVERSI (compensabili tra loro e con zaino fiscale):
- Capital gain da vendita azioni
- Capital gain da vendita ETF
- Capital gain da vendita crypto
- Capital gain da vendita obbligazioni
```

---

## 7. Architettura prezzi di mercato (delayed 15 min)

### 7.1 Decisione architetturale

**Scelta:** prezzi aggiornati con ritardo massimo di 15 minuti, NON real-time.  
**Motivazione:** sufficiente per un tracker fiscale/portafoglio; evita la complessità e i costi di streaming live; compatibile con tier gratuiti o economici delle API di mercato.

### 7.2 Provider API — stack primario + fallback

```
Primario:   yahoo-finance2 (npm)       — gratuito, no API key, 15 min delay, covre MIL/NYSE/NASDAQ/XETRA
Fallback:   Twelve Data (free tier)    — 800 req/giorno, 8 req/min, covre borse europee + ISIN lookup
Emergenza:  Open Exchange Rates        — solo per tassi di cambio se Frankfurter è down
```

**Perché Yahoo Finance come primario:**
- Nessuna API key richiesta
- Copre automaticamente Borsa Italiana (suffix `.MI`), XETRA (`.DE`), NYSE, NASDAQ
- Supporta ISIN → ticker lookup tramite `search()`
- Il pacchetto `yahoo-finance2` è mantenuto attivamente e gestisce il parsing
- Rischio: API non ufficiale, può rompersi senza preavviso → il fallback su Twelve Data copre questo scenario

**Perché Twelve Data come fallback:**
- API ufficiale con free tier generoso (800 req/giorno)
- Endpoint `/time_series` con intervallo `15min`
- Supporto ISIN nativo
- SDK TypeScript disponibile

### 7.3 Flusso di aggiornamento prezzi

```
OGNI 15 MINUTI (BullMQ repeatable job):
  1. Recupera tutti i ticker unici con posizioni aperte (query su TaxLot)
  2. Raggruppa per exchange (MIL, NYSE, NASDAQ, XETRA, CRYPTO)
  3. Controlla orari di apertura exchange — non fare fetch se mercato chiuso
  4. Chiama yahoo-finance2.quoteSummary(tickers[]) in batch (max 20 ticker/call)
  5. Per ogni risposta: upsert su tabella MarketPrice con timestamp
  6. Salva in Redis con TTL = 15 min come cache L1 (risponde al frontend senza DB)
  7. Se yahoo-finance2 fallisce: retry su Twelve Data per i ticker mancanti
  8. Emetti WebSocket event "prices:updated" ai client connessi (opzionale MVP)

LOOKUP ISIN → TICKER (al primo import di ogni nuovo strumento):
  1. yahoo-finance2.search(isin) → restituisce symbol + exchange + nome
  2. Salva mapping in tabella Instrument (isin, symbol, exchangeSuffix, name, assetClass)
  3. Usa questo mapping per tutti i fetch successivi
```

### 7.4 Schema DB aggiuntivo per market data

```prisma
model Instrument {
  id             String   @id @default(cuid())
  isin           String   @unique
  symbol         String                        // es. "ENI"
  yahooSymbol    String                        // es. "ENI.MI"
  twelveSymbol   String?                       // fallback symbol per Twelve Data
  name           String                        // es. "Eni SpA"
  exchange       String                        // es. "MIL" | "NYSE" | "XETRA"
  assetClass     String                        // "equity" | "etf" | "bond" | "crypto"
  currency       String                        // valuta nativa del titolo
  isBtp          Boolean  @default(false)      // flag per aliquota agevolata 12,5%
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  prices         MarketPrice[]
}

model MarketPrice {
  id             String     @id @default(cuid())
  instrumentId   String
  instrument     Instrument @relation(fields: [instrumentId], references: [id])
  price          Decimal
  currency       String
  changeAbs      Decimal?   // variazione assoluta rispetto chiusura precedente
  changePct      Decimal?   // variazione percentuale
  marketState    String     // "REGULAR" | "PRE" | "POST" | "CLOSED"
  source         String     // "yahoo" | "twelve_data"
  fetchedAt      DateTime   // quando è stato scaricato
  asOf           DateTime   // timestamp del prezzo (può essere 15 min prima)

  @@index([instrumentId, fetchedAt(sort: Desc)])
}
```

### 7.5 Servizio prezzi — implementazione

```typescript
// apps/api/src/services/marketPriceService.ts

import yahooFinance from 'yahoo-finance2'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'

const PRICE_CACHE_TTL = 60 * 15 // 15 minuti in secondi
const EXCHANGE_HOURS: Record<string, { open: number; close: number; tz: string }> = {
  MIL:    { open: 9,  close: 17.5, tz: 'Europe/Rome' },
  XETRA:  { open: 9,  close: 17.5, tz: 'Europe/Berlin' },
  NYSE:   { open: 9.5, close: 16,  tz: 'America/New_York' },
  NASDAQ: { open: 9.5, close: 16,  tz: 'America/New_York' },
  CRYPTO: { open: 0,  close: 24,   tz: 'UTC' }, // sempre aperto
}

export async function getLatestPrice(isin: string): Promise<MarketPriceResult | null> {
  // 1. Controlla cache Redis (L1)
  const cached = await redis.get(`price:${isin}`)
  if (cached) return JSON.parse(cached)

  // 2. Recupera da DB (L2)
  const instrument = await prisma.instrument.findUnique({
    where: { isin },
    include: { prices: { orderBy: { fetchedAt: 'desc' }, take: 1 } }
  })

  if (!instrument) return null

  const latestPrice = instrument.prices[0]
  if (latestPrice && isRecent(latestPrice.fetchedAt, 15)) {
    // Prezzo recente nel DB, metti in cache e restituisci
    await redis.setex(`price:${isin}`, PRICE_CACHE_TTL, JSON.stringify(latestPrice))
    return latestPrice
  }

  // 3. Fetch fresco da Yahoo Finance
  return fetchAndCachePrice(instrument)
}

export async function fetchPricesForPortfolio(userId: string): Promise<void> {
  // Recupera tutti gli ISIN con posizioni aperte dell'utente
  const openPositions = await prisma.taxLot.findMany({
    where: { account: { userId }, remainingQty: { gt: 0 } },
    select: { ticker: true },
    distinct: ['ticker']
  })

  const isins = openPositions.map(p => p.ticker)
  const instruments = await prisma.instrument.findMany({
    where: { isin: { in: isins } }
  })

  // Batch per exchange (Yahoo accetta fino a 20 symbol per chiamata)
  const batches = chunk(instruments, 20)
  for (const batch of batches) {
    const symbols = batch.map(i => i.yahooSymbol)
    try {
      const quotes = await yahooFinance.quote(symbols)
      for (const quote of quotes) {
        await upsertMarketPrice(quote)
      }
    } catch (err) {
      // Fallback su Twelve Data per i ticker falliti
      await fetchFromTwelveData(batch)
    }
  }
}

async function resolveIsinToInstrument(isin: string): Promise<Instrument> {
  // Cerca prima nel DB
  let instrument = await prisma.instrument.findUnique({ where: { isin } })
  if (instrument) return instrument

  // Lookup su Yahoo Finance
  const searchResult = await yahooFinance.search(isin)
  const quote = searchResult.quotes[0]
  if (!quote) throw new Error(`ISIN ${isin} non trovato`)

  instrument = await prisma.instrument.create({
    data: {
      isin,
      symbol: quote.symbol.replace(/\.MI|\.DE|\.PA$/i, ''),
      yahooSymbol: quote.symbol,
      name: quote.shortname ?? quote.longname ?? isin,
      exchange: quote.exchange ?? 'UNKNOWN',
      assetClass: mapYahooTypeToAssetClass(quote.quoteType),
      currency: quote.currency ?? 'EUR',
      isBtp: false,
    }
  })

  return instrument
}
```

### 7.6 Job BullMQ per aggiornamento periodico

```typescript
// apps/api/src/jobs/priceRefreshJob.ts

import { Queue, Worker } from 'bullmq'
import { redis } from '../lib/redis'
import { fetchPricesForPortfolio } from '../services/marketPriceService'

export const priceQueue = new Queue('price-refresh', { connection: redis })

// Schedula ogni 15 minuti solo negli orari in cui almeno un exchange è aperto
export async function schedulePriceRefreshes() {
  await priceQueue.add(
    'refresh-all-portfolios',
    {},
    {
      repeat: { every: 15 * 60 * 1000 },  // ogni 15 minuti
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  )
}

const worker = new Worker('price-refresh', async (job) => {
  // Recupera tutti gli userId con posizioni aperte
  const users = await prisma.user.findMany({
    where: { accounts: { some: { transactions: { some: {} } } } },
    select: { id: true }
  })

  for (const user of users) {
    await fetchPricesForPortfolio(user.id)
  }
}, { connection: redis, concurrency: 3 })
```

### 7.7 Orari di mercato e gestione "mercato chiuso"

```typescript
// apps/api/src/utils/marketHours.ts

import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'

export function isMarketOpen(exchange: string): boolean {
  const config = EXCHANGE_HOURS[exchange]
  if (!config) return false
  if (exchange === 'CRYPTO') return true

  const nowInTz = utcToZonedTime(new Date(), config.tz)
  const hour = nowInTz.getHours() + nowInTz.getMinutes() / 60
  const dayOfWeek = nowInTz.getDay() // 0=Dom, 6=Sab

  if (dayOfWeek === 0 || dayOfWeek === 6) return false // weekend
  return hour >= config.open && hour < config.close
}

// Quando il mercato è chiuso: usa l'ultimo prezzo disponibile
// e mostra "Chiuso - ultimo agg. HH:MM" nell'UI
```

### 7.8 Prezzi storici (per grafico andamento portafoglio)

```typescript
// Per il grafico "valore portafoglio nel tempo" usiamo prezzi storici giornalieri (EOD)
// Yahoo Finance: yahooFinance.historical(symbol, { period1, period2, interval: '1d' })
// Calcoliamo il valore portafoglio giornaliero retrospettivamente:
//   per ogni giorno → sum(quantità_detenuta * prezzo_chiusura)
// Salviamo i valori calcolati in una tabella PortfolioSnapshot per non ricalcolare ogni volta

model PortfolioSnapshot {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date
  valueEur    Decimal
  costBasisEur Decimal
  unrealizedPnlEur Decimal
  calculatedAt DateTime @default(now())

  @@unique([userId, date])
  @@index([userId, date(sort: Desc)])
}
```

### 7.9 Indicatore "dati aggiornati a" nel frontend

```typescript
// Ogni cella di prezzo nel frontend mostra:
// - Il prezzo delayed
// - Un badge colorato con l'età del dato:
//   < 15 min → verde "Live (15 min)"
//   15-60 min → giallo "Dati ritardati"
//   > 60 min / mercato chiuso → grigio "Chiuso - agg. HH:MM"

// Componente React
function PriceCell({ price, asOf, marketState }: PriceCellProps) {
  const ageMinutes = differenceInMinutes(new Date(), new Date(asOf))
  const badge =
    marketState === 'CLOSED'
      ? { label: `Chiuso · ${format(asOf, 'HH:mm')}`, color: 'gray' }
      : ageMinutes < 15
      ? { label: 'Aggiornato', color: 'green' }
      : { label: `${ageMinutes} min fa`, color: 'amber' }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono">{formatCurrency(price)}</span>
      <Badge variant={badge.color}>{badge.label}</Badge>
    </div>
  )
}
```

---

## 8. Import CSV per broker

### Mapping colonne per broker supportati

```typescript
// packages/shared/constants/brokerMappings.ts

export const BROKER_CSV_MAPPINGS = {
  fineco: {
    delimiter: ';',
    dateFormat: 'DD/MM/YYYY',
    columns: {
      date: 'Data',
      ticker: 'Titolo',
      isin: 'ISIN',
      type: 'Operazione',     // "Acquisto" | "Vendita" | "Dividendo"
      quantity: 'Quantità',
      price: 'Prezzo',
      currency: 'Divisa',
      amount: 'Controvalore',
      fees: 'Commissioni',
    }
  },
  degiro: {
    delimiter: ',',
    dateFormat: 'DD-MM-YYYY',
    columns: {
      date: 'Data',
      ticker: 'Prodotto',
      isin: 'ISIN',
      type: 'Tipo',
      quantity: 'Quantità',
      price: 'Prezzo',
      currency: 'Valuta locale',
      amount: 'Valore locale',
      fees: 'Spese di transazione',
    }
  },
  ibkr: {
    delimiter: ',',
    dateFormat: 'YYYY-MM-DD',
    columns: {
      date: 'TradeDate',
      ticker: 'Symbol',
      isin: 'ISIN',
      type: 'TransactionType',
      quantity: 'Quantity',
      price: 'TradePrice',
      currency: 'CurrencyPrimary',
      amount: 'Proceeds',
      fees: 'IBCommission',
    }
  }
  // aggiungere: directa, scalable, flatex
}
```

---

## 8. Routing frontend

```
/                         → redirect a /dashboard (se autenticato) o /login
/login                    → pagina di accesso
/register                 → registrazione
/dashboard                → panoramica portafoglio aggregata
/portfolio                → lista posizioni aperte
/portfolio/:ticker        → dettaglio singolo titolo
/transactions             → storico transazioni (tutti gli account)
/transactions/import      → wizard import CSV
/transactions/new         → inserimento manuale
/tax                      → sezione fiscale
/tax/gains-losses         → plus/minus realizzate per anno
/tax/backpack             → zaino fiscale (carry-forward)
/tax/reports              → report annuali, export PDF/CSV
/accounts                 → gestione conti broker
/accounts/new             → aggiunta nuovo conto
/settings                 → impostazioni utente (profilo, notifiche, preferenze)
```

---

## 9. Convenzioni di codice

### Naming
- Componenti React: PascalCase (`PortfolioTable.tsx`)
- Hook: camelCase con prefisso `use` (`usePortfolioData.ts`)
- Store Zustand: camelCase con suffisso `Store` (`portfolioStore.ts`)
- Service API: camelCase con suffisso `Service` (`transactionService.ts`)
- Costanti: UPPER_SNAKE_CASE (`MAX_CSV_ROWS`)
- Tipi/Interface: PascalCase con prefisso `I` per interface (`ITransaction`), niente prefisso per type alias

### Struttura componente React (ordine standard)
```typescript
// 1. Import
// 2. Types/interfaces locali
// 3. Costanti locali
// 4. Componente principale (function declaration)
//    - hooks di stato
//    - hooks di query
//    - computed values (useMemo)
//    - handlers (useCallback)
//    - effects (useEffect)
//    - early returns (loading, error, empty states)
//    - return JSX
// 5. Subcomponenti (se piccoli e strettamente correlati)
// 6. Export default
```

### Gestione errori
- Tutti gli errori API vanno wrappati in una classe `AppError` con `code`, `message`, `statusCode`
- Frontend usa React Error Boundaries per sezioni critiche
- Toast per feedback operazioni (usare sonner)
- Ogni async operation ha stato: `idle | loading | success | error`

### Internazionalizzazione
- Lingua UI: italiano (default, unica per MVP)
- Numeri: formato italiano (es. 1.234,56 €)
- Date: formato DD/MM/YYYY
- Valuta: sempre in EUR per i totali, con indicazione valuta originale dove rilevante

---

## 10. Linee guida UI/UX

### Principi
- Dark mode first (dati finanziari si leggono meglio su scuro)
- Densità informativa alta ma non caotica: usa whitespace deliberato
- Color coding consistente: verde (#22c55e) per guadagni, rosso (#ef4444) per perdite, blu/neutro per valori neutri
- Ogni numero importante deve avere il suo contesto visivo (etichetta, unità, variazione)

### Componenti critici da costruire
- `PortfolioTable` — tabella posizioni con sorting multi-colonna, mini sparkline inline
- `GainLossCell` — cella con valore colorato + icona freccia + percentuale
- `TaxBackpackWidget` — card con barre di scadenza anni, residuo compensabile
- `YearSelector` — switcher anno fiscale presente in tutte le sezioni tax
- `ImportWizard` — stepper 4 step: carica file → mappa colonne → anteprima → conferma
- `SimulatorModal` — modale "cosa succede se vendo ora": input titolo/qty → output fiscale

### Palette colori (dark mode)
```
background:       #0f1117
surface:          #1a1d27
border:           #2a2d3a
text-primary:     #f0f2f7
text-secondary:   #8b8fa8
accent-blue:      #4f8ef7
gain-green:       #22c55e
loss-red:         #ef4444
warning-amber:    #f59e0b
```

---

## 11. Checklist MVP (priorità)

### Fase 1 — Core (6-8 settimane)
- [ ] Auth (register, login, password reset)
- [ ] Gestione account broker (CRUD)
- [ ] Inserimento manuale transazioni
- [ ] Import CSV Fineco e DEGIRO
- [ ] Calcolo FIFO e posizioni aperte
- [ ] ISIN → ticker lookup (yahoo-finance2 search)
- [ ] Dashboard portafoglio base
- [ ] Prezzi delayed 15 min (yahoo-finance2, job BullMQ ogni 15 min)
- [ ] Cache prezzi in Redis con TTL 15 min
- [ ] Indicatore "dati aggiornati a" su ogni cella prezzo

### Fase 2 — Tax (4-6 settimane)
- [ ] Calcolo plus/minus realizzate per anno
- [ ] Zaino fiscale con scadenze
- [ ] Report annuale con export CSV
- [ ] Alert minus in scadenza

### Fase 3 — Avanzato (4-6 settimane)
- [ ] Import CSV IBKR, Directa, Flatex, Scalable
- [ ] Export PDF report fiscale (layout dichiarazione)
- [ ] Simulatore vendita
- [ ] Conversione valuta storica automatica (Frankfurter.app)
- [ ] Grafico andamento valore portafoglio nel tempo (prezzi EOD storici da Yahoo Finance)
- [ ] PortfolioSnapshot giornaliero (job notturno BullMQ)
- [ ] Gestione orari exchange e stato mercato (aperto/chiuso/pre-market)
- [ ] Fallback automatico su Twelve Data quando yahoo-finance2 è irraggiungibile

### Fase 4 — Growth (da definire)
- [ ] Prezzi real-time (Yahoo Finance API o Alpha Vantage)
- [ ] Notifiche email (minus in scadenza, report pronti)
- [ ] Modalità multi-utente / famiglia
- [ ] API pubblica per connessioni terze parti

---

## 12. Note fiscali di riferimento (Italia)

- **Regime dichiarativo:** l'investitore calcola e dichiara autonomamente (quadro RT per redditi diversi, quadro RM per dividendi esteri)
- **Aliquota capital gain:** 26% su redditi diversi (azioni, ETF, crypto, obbligazioni corporate)
- **Aliquota ridotta:** 12,5% su titoli di Stato italiani ed equiparati (BTP, BOT, ecc.) — da gestire separatamente
- **Compensazione minus:** le minusvalenze da redditi diversi sono compensabili solo con plusvalenze da redditi diversi, non con dividendi/cedole
- **Carry-forward:** minusvalenze non compensate riportabili per 4 anni (es. minus 2022 scade fine 2026)
- **Crypto:** dal 2023 incluse nel regime dei redditi diversi, con esenzione sotto 2.000€ di plusvalenza annua (da verificare aggiornamenti normativi)
- **ETF armonizzati:** i proventi (distribuzione o rimborso) sono redditi di capitale; il capital gain è reddito diverso
- **Riferimento normativo:** art. 67 e 68 TUIR (Testo Unico Imposte sui Redditi)

> ⚠️ Questo tool è a scopo informativo e gestionale. Non sostituisce la consulenza di un commercialista. Ogni utente è responsabile della propria dichiarazione dei redditi.

---

## 13. Variabili d'ambiente

```env
# apps/api/.env

DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...         # Supabase direct connection (per Prisma migrate)

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

REDIS_URL=redis://...               # Upstash o Redis locale

FRANKFURTER_API_URL=https://api.frankfurter.app   # Cambio valute ECB (gratuito)

# Market Data — prezzi delayed 15 min
# yahoo-finance2 non richiede API key (provider primario, gratuito)
TWELVE_DATA_API_KEY=...             # Fallback: https://twelvedata.com — free tier 800 req/giorno
PRICE_REFRESH_INTERVAL_MS=900000    # 15 minuti in ms (default, modificabile per test)
PRICE_CACHE_TTL_SECONDS=900         # TTL Redis per cache prezzi

JWT_SECRET=...
CORS_ORIGIN=http://localhost:5173

# apps/web/.env

VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 14. Comandi di sviluppo

```bash
# Installazione dipendenze (dalla root del monorepo)
pnpm install

# Dev frontend
pnpm --filter web dev

# Dev backend
pnpm --filter api dev

# Entrambi in parallelo
pnpm dev

# Prisma: generare client dopo modifiche schema
pnpm --filter api prisma generate

# Prisma: apply migrations
pnpm --filter api prisma migrate dev --name <nome_migrazione>

# Prisma: aprire studio
pnpm --filter api prisma studio

# Build completo
pnpm build

# Type-check tutto il monorepo
pnpm typecheck

# Lint
pnpm lint
```

---

*Ultimo aggiornamento: Giugno 2026 — versione MVP*
