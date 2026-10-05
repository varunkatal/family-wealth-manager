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

The built app is static files only (no server, no database). See [Hosting](#hosting-it-for-other-families) to put it online.

To use Google Sheets you need a Google OAuth Client ID: follow [docs/google-setup.md](docs/google-setup.md), then put it in `.env.local` (see `.env.example`) and restart `npm run dev`. Without it, the app works in browser-only mode.

To try the app without entering real figures, click **Load demo data** on the Assets page. Demo records are labelled DEMO, and **Clear demo data** removes them without touching anything you entered.

## How your data is stored

On first use you choose where the family's data is kept. You can switch later on **Backup & data**.

**In my Google Sheet**
- The app creates a spreadsheet, “Family Wealth Calculator – data”, in **your own Google Drive**, with one tab per kind of record (Family, Assets, Ownership, Liabilities, Investments, Income, Expenses, Goals, Snapshots, Asset values), plus Settings and About.
- Every change is saved to the sheet automatically, a second or two after you stop editing. The header shows *Saving…* / *Saved to Google Sheet* / *Not saved · Retry* / *Sign in*.
- Use the app from any device by signing in with the **same Google account** (one account per family). A new device loads the sheet.
- The browser keeps a working copy, so the app stays fast and nothing is lost if the internet drops or the Google sign-in expires (about once an hour; click **Sign in** to continue saving).
- If the sheet was saved from another device while you were editing, saving stops and you choose which copy to keep. The app never overwrites differing data on its own.
- The sheet is written by the app; read it freely, but don't edit it by hand (an edit that breaks it is reported, never silently dropped).
- The app asks Google only for `drive.file`: access to the files it creates. It can't see anything else in your Drive. Your data goes only between your browser and Google; there is no app server, and the app's makers never receive it.

**In this browser only**
- Everything is stored in your browser on this device (IndexedDB) and nothing is sent anywhere.
- Another browser or computer starts empty; use backup and restore to move data.
- Clearing your browser's site data deletes the app's data. On **Backup & data** you can ask the browser to keep it even when storage runs low, but keep regular backups regardless.

In both modes there are no analytics, tracking or cookies, and financial values are never logged. Amounts are in Indian rupees, shown with Indian digit grouping (₹10,00,000) or as lakh/crore (choose in Settings). See also the [privacy page](public/privacy.html).

## Backing up and restoring

On the **Backup & data** page:

- **Download backup** saves a complete copy of all data and settings as a JSON file. It contains your financial data, so store it somewhere private.
- **Restore** loads a backup file. The app checks the whole file first (every record, unique IDs, and that every reference points at something in the file) and shows what it contains. Restoring **replaces all current data**; it never merges. It happens in a single step, so a failed restore leaves your existing data untouched.
- **Export** creates readable copies: an Excel workbook (one sheet per table, plus a summary) and CSV files per table. Exports are for reading; only backups can be restored.
- **Delete all data** permanently removes everything after you type `DELETE` (in Google Sheet mode this also empties the sheet; the empty file stays in your Drive).
- **Disconnect** (Google Sheet mode) stops saving to Google and revokes the app's access; optionally it also clears this browser. To remove the app's access from Google's side, use [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

A restore or delete in Google Sheet mode is saved to the sheet like any other change.

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

## Hosting it for other families

The app is static files, so any static host works. Each family's data still goes only to their own Google Drive.

**GitHub Pages (free, no domain needed)** — the site is published at `https://<username>.github.io/<repo>/` by `.github/workflows/deploy.yml` on every push to `main` (tests must pass first):

1. The repository must be **public** (GitHub Pages on private repositories needs a paid plan). Nothing secret is in the code; `.env.local` is never committed.
2. On GitHub: **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables → New repository variable**: `VITE_GOOGLE_CLIENT_ID` = your Client ID (a variable, as it is public).
4. Push to `main`, or run the workflow from the **Actions** tab.
5. In Google Cloud, add `https://<username>.github.io` (no path) to **Authorized JavaScript origins**.

**Netlify / Cloudflare Pages** — alternatively:

1. Make sure `.env.local` has your Client ID, then run `npm run build`. The ID is baked into `dist/` (it is public, not a secret).
2. Upload `dist/` to a static host. [Netlify](https://app.netlify.com/drop) (drag and drop the `dist` folder) and Cloudflare Pages both work as is: `dist/_redirects` makes page links work on refresh, and `dist/_headers` adds security headers.
3. In Google Cloud, add the site's address (e.g. `https://your-site.netlify.app`) to the OAuth client's **Authorized JavaScript origins**, and publish the app. Details in [docs/google-setup.md](docs/google-setup.md#5-let-other-families-sign-in).

## Security

- No server, no database, no client secret. Google sign-in uses the browser token flow; the access token is held in memory only and expires within an hour.
- The only Google permission is `drive.file` (files the app created).
- The built app has a Content Security Policy: scripts only from the app itself and Google's sign-in library; network requests only to the app and Google's Drive/Sheets APIs. Google's sign-in script is loaded only when you use or are about to use Google.
- Values are written to the sheet as typed values, so text such as `=HYPERLINK(...)` is stored as text and never runs as a formula. CSV exports guard against formula injection.
- `localStorage` holds only the theme, the chosen mode and the spreadsheet / save IDs, never financial data.

## Project structure

```
src/
  app/            App shell: routes, layout, navigation, start screen, settings and Google sync contexts
  pages/          One component per page
  features/       Forms and sections used by pages
  components/     Shared UI (buttons, modal, charts)
  models/         Data types and validation (zod)
  services/
    finance/      Calculations (pure functions, tested)
    storage/      IndexedDB access (repositories)
    export/       CSV and Excel writers
    google/       Google sign-in, Sheets client, sheet layout, sync decisions
  hooks/          useWealthData: loads all records for a page
  utils/          Formatting and small helpers
```

Built with React, TypeScript, Vite, Tailwind CSS, Zod and idb. Tests use Vitest, Testing Library and fake-indexeddb; Google is replaced by an in-memory fake in tests.
