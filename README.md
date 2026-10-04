# Family Wealth Calculator

A private web app for tracking what a family owns and owes, and projecting how its wealth could grow under your own assumptions.

> This application is a personal wealth tracking and projection tool. Future values are estimates based on user-entered assumptions and are not guaranteed returns or financial advice.

## Running the app

You need [Node.js](https://nodejs.org) 22.12 or later.

```bash
npm install
npm run dev        # start at http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Run all automated tests |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Build the production version into `dist/` |
| `npm run preview` | Serve the built version locally |

The built app is static files only. You can host `dist/` anywhere that serves files, but it is designed to be used on your own computer.

To try the app without entering real figures, click **Load demo data** on the Assets page. Demo records are labelled DEMO, and **Clear demo data** removes them without touching anything you entered.

## How your data is stored

- Everything is stored **in your browser on this device** (IndexedDB). Nothing is sent to a server. The app makes no network requests and has no analytics or tracking.
- Data is per browser and per device. Another browser or computer starts empty; use backup and restore to move data.
- Clearing your browser's site data deletes the app's data. On **Backup & data** you can ask the browser to keep the data even when storage runs low, but keep regular backups regardless.
- Amounts are in Indian rupees, shown with Indian digit grouping (₹10,00,000) or as lakh/crore (choose in Settings).

## Backing up and restoring

On the **Backup & data** page:

- **Download backup** saves a complete copy of all data and settings as a JSON file. It contains your financial data, so store it somewhere private.
- **Restore** loads a backup file. The app checks the whole file first (every record, unique IDs, and that every reference points at something in the file) and shows what it contains. Restoring **replaces all current data**; it never merges. It happens in a single step, so a failed restore leaves your existing data untouched.
- **Export** creates readable copies: an Excel workbook (one sheet per table, plus a summary) and CSV files per table. Exports are for reading; only backups can be restored.
- **Delete all data** permanently removes everything after you type `DELETE`.

Importing from Excel is not supported.

## How the calculations work

All formulas live in `src/services/finance/` as pure functions with automated tests. The UI only displays their results.

**Ownership and net worth.** Each asset has one or more owners with percentage shares. An owner's value is asset value × share. The family's value of an asset is asset value × the total of its owners' shares (shares can total less than 100% when part of an asset belongs to someone outside the family), so an asset is never counted twice. An asset with no owner is excluded and flagged.
Net worth = total family-owned assets − total outstanding liabilities.

**Future value.** Each asset grows at its own rate, compounded yearly: FV = PV × (1 + r)ⁿ. One rate is never applied to the whole portfolio. An asset without a rate is held at today's value and flagged.

**Scenarios.** Assets can have Conservative, Base and Optimistic rates. If an asset has no rate for a scenario, the default for its asset class from Settings is used (blank by default); otherwise it is held flat and flagged. The app never invents rates.

**Inflation.** "Today's money" = nominal value ÷ (1 + inflation)ⁿ. Inflation defaults to 6% and can be changed in Settings.

**Regular investments (SIPs).** FV = P × [((1 + i)ⁿ − 1) / i], where i = annual return ÷ periods per year (12% a year → 1% a month), with contributions at the end of each period. A step-up raises the contribution once every 12 months. A lump sum compounds yearly like an asset. Projections include only contributions made after today, because past ones are already in the linked asset's value. An investment uses its own expected return, otherwise the linked asset's rate for the scenario.

**Loans.** EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1), with r = annual rate ÷ 12. Each month's interest is charged on the remaining balance and the EMI pays interest first, then principal. If the EMI is left blank, it is worked out from the remaining months. An EMI that does not cover the monthly interest is rejected. Loans without repayment details are held at today's balance in projections. EMIs are paid from income, so they do not reduce projected assets.

**Cash flow.** Free cash flow = income − expenses, counting only items active today. Investments and loan EMIs are not expenses; they are shown separately as money set aside.

**Goals.** Remaining = target − saved. The required monthly saving uses the same conventions as SIPs (money already saved grows yearly at the goal's expected return, or 0% if none is set). Wealth milestones (₹25 lakh to ₹5 crore, or a custom amount) are estimated from projected net worth under each scenario, interpolating between yearly points, so dates are approximate.

**History.** Snapshots store the totals as they were on a date and are never recalculated. Changes and percentage changes compare each snapshot with the previous one; month over month uses the latest snapshot in each month. Asset value history is recorded automatically whenever an asset's value or valuation date changes.

Amounts are rounded to the paisa in calculations and shown in whole rupees in projections.

## Project structure

```
src/
  app/            App shell: routes, layout, navigation, settings context
  pages/          One component per page
  features/       Forms and sections used by pages
  components/     Shared UI (buttons, modal, charts)
  models/         Data types and validation (zod)
  services/
    finance/      Calculations (pure functions, tested)
    storage/      IndexedDB access (repositories)
    export/       CSV and Excel writers
  hooks/          useWealthData: loads all records for a page
  utils/          Formatting and small helpers
```

Built with React, TypeScript, Vite, Tailwind CSS, Zod and idb. Tests use Vitest, Testing Library and fake-indexeddb.
