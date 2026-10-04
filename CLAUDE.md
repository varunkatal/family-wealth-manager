# CLAUDE.md v2 — Family Wealth Calculator
## Step-by-Step, Approval-Gated Development Specification

---

# 1. PROJECT PURPOSE

Build a private web application called:

**Family Wealth Calculator**

The application will help a family track:

- Family members
- Assets
- Asset ownership
- Liabilities
- Current net worth
- Income
- Expenses
- Investments/contributions
- Financial goals
- Historical wealth
- Future wealth projections
- Conservative/Base/Optimistic scenarios

The core purpose is:

> Track what the family owns today and calculate how family wealth could grow over time using user-defined assumptions.

---

# 2. CRITICAL DEVELOPMENT RULE

## DO NOT BUILD THE ENTIRE APPLICATION IN ONE GO.

The project must be developed in **small, controlled phases**.

Claude must complete only ONE phase at a time.

After completing a phase:

1. Run the application.
2. Test the functionality.
3. Fix errors.
4. Run the relevant tests.
5. Summarize exactly what was completed.
6. Tell the user how to manually verify it.
7. STOP.
8. Wait for the user's approval before starting the next phase.

Do not automatically continue to the next phase.

The user will say something such as:

- `Continue`
- `Proceed to Step 2`
- `Approved`
- `Go to next step`

Only then may Claude begin the next phase.

---

# 3. DO NOT USE REAL FINANCIAL DATA

The project must start with an empty database.

Do NOT:

- Hard-code real family names.
- Hard-code real asset values.
- Hard-code real account numbers.
- Hard-code real financial information.
- Include private financial information in source code.
- Assume any real user's assets.

If demonstration data is necessary during development, use clearly fake data:

```text
Person A
Person B
Example Mutual Fund
Example Property
₹10,00,000
```

Demo data must be clearly marked and easy to delete.

---

# 4. EXCEL DATA IS NOT PART OF CLAUDE.MD

Do not expect an Excel file to be available while building the core application.

The application itself may later support:

- Excel import
- Excel export

But Excel import is a later development phase.

The initial application must work without any Excel file.

---

# 5. DEVELOPMENT PHASES

Build in exactly this general order:

```text
PHASE 0  → Project planning / inspection
PHASE 1  → Project foundation
PHASE 2  → Family members
PHASE 3  → Assets
PHASE 4  → Ownership and net worth
PHASE 5  → Dashboard
PHASE 6  → Future value calculator
PHASE 7  → Recurring investments / SIP
PHASE 8  → Liabilities and loans
PHASE 9  → Scenarios and inflation
PHASE 10 → Income and expenses
PHASE 11 → Financial goals
PHASE 12 → Wealth history
PHASE 13 → Import / Export
PHASE 14 → Testing and polish
PHASE 15 → Final review
```

Do not skip phases.

---

# 6. PHASE 0 — PROJECT INSPECTION AND PLAN

Before writing substantial code:

Inspect the existing project.

Determine:

- Current framework
- Existing files
- Package manager
- Existing dependencies
- Existing UI system
- Existing database/storage
- Existing routing
- Existing tests

If this is a new project, propose the minimum required structure.

Do not unnecessarily install large numbers of dependencies.

At the end of Phase 0, report:

```text
Project detected:
Framework:
Language:
Package manager:
Existing database:
Existing UI:
Testing setup:

Recommended architecture:
...

Next phase:
Phase 1
```

Then STOP.

---

# 7. PHASE 1 — PROJECT FOUNDATION

Goal:

Create a clean working application shell.

Build:

- Application entry point
- Global layout
- Navigation
- Sidebar or responsive navigation
- Header
- Basic dashboard placeholder
- Settings placeholder
- Responsive layout
- Theme support if practical
- Local persistence foundation

Recommended technology:

- React
- TypeScript
- Vite or Next.js
- Tailwind CSS
- Recharts
- Zod

For MVP storage:

- IndexedDB or a reliable local-storage abstraction.

Do not build assets, projections or financial calculations yet.

## Phase 1 acceptance test

Verify:

- App starts.
- App loads without errors.
- Navigation works.
- Refresh does not break the application.
- Basic responsive layout works.
- TypeScript builds successfully.
- No console errors.

Then STOP and wait for approval.

---

# 8. PHASE 2 — FAMILY MEMBERS

Build the Family section.

Features:

- Add family member
- Edit family member
- Delete family member
- View family members
- Active/inactive status

Fields:

```text
ID
Name
Relationship
Date of Birth (optional)
Notes
Created At
Updated At
```

Do not add financial assets yet.

## Phase 2 acceptance test

Test:

1. Add Person A.
2. Add Person B.
3. Edit Person A.
4. Delete Person B.
5. Refresh browser.
6. Confirm Person A remains.

Validate:

- Name required.
- No accidental duplicate IDs.
- Delete requires confirmation.

Then STOP.

---

# 9. PHASE 3 — ASSET MANAGEMENT

Build the Assets section.

Users must be able to:

- Add asset
- Edit asset
- Delete asset
- Search assets
- Filter assets
- View asset details

Default categories:

## Equity

- Direct Stocks
- Equity Mutual Funds
- Index Funds
- ETFs

## Fixed Income

- FD
- RD
- PPF
- EPF
- NPS
- SCSS
- Post Office
- Bonds
- Debt Mutual Funds

## Precious Metals

- Physical Gold
- Gold ETF
- Physical Silver
- Silver ETF

## Real Estate

- Residential Property
- Agricultural Land
- Plot
- Commercial Property
- Shop
- Rental Property

## Cash

- Savings Account
- Current Account
- Cash

## Other

- Business
- Vehicle
- Insurance
- Other

Allow custom categories.

Asset fields:

```text
Asset ID
Asset Name
Asset Class
Subcategory
Institution
Purchase Value
Current Value
Valuation Date
Valuation Method
Conservative Growth %
Base Growth %
Optimistic Growth %
Liquidity
Notes
Created At
Updated At
```

At this stage, owner/ownership can be prepared but does not need full joint ownership logic until Phase 4.

## Phase 3 acceptance test

Create fake demo assets.

Verify:

- Create
- Edit
- Delete
- Search
- Filter
- Category selection
- Currency formatting
- Data persistence

Then STOP.

---

# 10. PHASE 4 — OWNERSHIP AND NET WORTH ENGINE

This is a critical phase.

Implement asset ownership.

A separate ownership table/model is preferred:

```typescript
type AssetOwnership = {
  id: string;
  assetId: string;
  familyMemberId: string;
  percentage: number;
};
```

Example:

```text
Asset value = ₹1,00,00,000

Person A = 60%
Person B = 40%
```

Attributed values:

```text
Person A = ₹60,00,000
Person B = ₹40,00,000
```

Never double-count the full asset for both people.

---

## Net worth

Implement:

```text
Total Assets
= Sum of all family-owned asset values

Total Liabilities
= Sum of all outstanding liabilities

Net Worth
= Total Assets - Total Liabilities
```

Liabilities will initially use a simple model.

Advanced loan calculations come later.

## Phase 4 acceptance test

Test:

### Test 1

One person owns:

```text
Asset = ₹10,00,000
```

Expected:

```text
Assets = ₹10,00,000
```

### Test 2

Two people jointly own:

```text
Asset = ₹10,00,000

A = 50%
B = 50%
```

Expected:

```text
A = ₹5,00,000
B = ₹5,00,000
Family = ₹10,00,000
```

### Test 3

Assets:

```text
₹10,00,000
₹5,00,000
```

Liabilities:

```text
₹2,00,000
```

Expected:

```text
Net Worth = ₹13,00,000
```

Write automated unit tests.

Then STOP.

---

# 11. PHASE 5 — FAMILY WEALTH DASHBOARD

Now build the main dashboard.

Display:

```text
Total Assets
Total Liabilities
Net Worth
```

Also show:

- Net worth by family member
- Asset allocation
- Top assets
- Liquid vs illiquid assets
- Recent changes

Charts:

1. Asset allocation
2. Wealth by family member
3. Asset class distribution

Use real application data.

Do not use hard-coded chart values.

## Phase 5 acceptance test

Confirm:

- Dashboard updates after adding an asset.
- Dashboard updates after editing an asset.
- Dashboard updates after deleting an asset.
- Joint ownership is reflected correctly.
- Charts match table values.

Then STOP.

---

# 12. PHASE 6 — FUTURE VALUE CALCULATOR

Now implement future wealth calculations.

Basic formula:

```text
FV = PV × (1 + r)^n
```

Where:

```text
PV = Present Value
r = Annual Growth Rate
n = Number of Years
```

Support:

```text
1 Year
3 Years
5 Years
10 Years
15 Years
20 Years
25 Years
Custom
```

Each asset must use its own growth assumption.

Do NOT apply one growth rate to the entire portfolio.

---

## Projection table

Display:

| Year | Asset Value | Growth |
|---|---:|---:|
| Today | ₹X | — |
| Year 1 | ₹X | ₹X |
| Year 2 | ₹X | ₹X |
| Year 3 | ₹X | ₹X |

Then show family total.

## Phase 6 acceptance test

Test:

```text
PV = ₹10,00,000
Rate = 10%
Years = 10
```

Expected result approximately:

```text
₹25,93,742
```

Allow for minor display rounding.

Write automated tests.

Then STOP.

---

# 13. PHASE 7 — RECURRING INVESTMENTS / SIP

Add recurring contributions.

Support:

- Monthly
- Quarterly
- Half-yearly
- Yearly

Fields:

```text
Contribution
Owner
Linked Asset
Amount
Frequency
Start Date
End Date
Expected Return
Annual Increase %
```

For monthly SIP:

```text
FV = P × [((1+i)^n - 1) / i]
```

Support:

- Initial investment
- Monthly contribution
- Annual contribution increase

Example:

```text
Starting SIP = ₹10,000
Annual increase = 10%
Return = 12%
```

These are test values only.

## Phase 7 acceptance test

Verify:

- SIP calculation
- Increasing SIP
- Initial lump sum
- Different frequencies
- Projection integration

Then STOP.

---

# 14. PHASE 8 — LIABILITIES AND LOANS

Build full liabilities.

Fields:

```text
Liability ID
Owner
Name
Type
Original Amount
Current Outstanding
Interest Rate
Monthly EMI
Remaining Months
Start Date
Expected End Date
Notes
```

Types:

- Home Loan
- Car Loan
- Personal Loan
- Education Loan
- Portfolio Loan
- Credit Card
- Other

Implement loan amortization.

Show:

- Current debt
- Monthly EMI
- Interest
- Principal repayment
- Remaining balance
- Estimated debt-free date

## Phase 8 acceptance test

Create a fake test loan.

Verify:

- EMI
- Outstanding balance
- Interest/principal split
- Net worth impact
- Projected debt reduction

Then STOP.

---

# 15. PHASE 9 — SCENARIOS AND INFLATION

Implement:

### Conservative

### Base

### Optimistic

Each asset can have:

```text
Conservative Growth %
Base Growth %
Optimistic Growth %
```

Allow defaults in Settings.

---

## Inflation

Default assumption:

```text
6%
```

But editable.

Real future value:

```text
Real FV =
Nominal FV / (1 + inflation)^n
```

Display:

```text
Nominal Wealth
Today's Purchasing Power
```

---

## Scenario comparison

Create:

| Period | Conservative | Base | Optimistic |
|---|---:|---:|---:|
| Today | ₹X | ₹X | ₹X |
| 5 Years | ₹X | ₹X | ₹X |
| 10 Years | ₹X | ₹X | ₹X |
| 20 Years | ₹X | ₹X | ₹X |

## Phase 9 acceptance test

Verify:

- Scenario rates work.
- Asset-level rates work.
- Inflation calculation works.
- Charts update.
- Scenario totals reconcile with individual assets.

Then STOP.

---

# 16. PHASE 10 — INCOME AND EXPENSES

Add income tracking.

Income types:

- Salary
- Pension
- Rent
- Interest
- Farm Income
- Business Income
- Trading Income
- Other

Fields:

```text
Family Member
Income Type
Monthly Amount
Annual Amount
Growth %
Start Date
End Date
Notes
```

Add expense tracking.

Expense categories:

- Household
- Grocery
- Utilities
- Medical
- Insurance
- Education
- Travel
- Shopping
- Family
- Other

Important:

Do not treat investment contributions as consumption expenses.

Show:

```text
Income
-
Expenses
=
Free Cash Flow
```

## Phase 10 acceptance test

Verify:

- Monthly income
- Annual income
- Monthly expenses
- Annual expenses
- Free cash flow
- Family-member income
- Persistence

Then STOP.

---

# 17. PHASE 11 — FINANCIAL GOALS

Create Goals.

Fields:

```text
Goal ID
Name
Target Amount
Current Saved Amount
Target Date
Owner
Priority
Monthly Required Contribution
Notes
```

Examples:

- Car
- House
- Marriage
- Education
- Retirement
- Emergency Fund
- Travel
- Custom

Calculate:

```text
Remaining Amount =
Target Amount - Current Saved Amount
```

Calculate required monthly contribution for target date.

## Milestones

Support:

- ₹25 lakh
- ₹50 lakh
- ₹75 lakh
- ₹1 crore
- ₹2 crore
- ₹5 crore
- Custom

Estimate milestone date under each scenario.

Then STOP.

---

# 18. PHASE 12 — WEALTH HISTORY

Create historical snapshots.

Snapshot:

```text
Date
Total Assets
Total Liabilities
Net Worth
```

Allow manual:

**Save Wealth Snapshot**

Also create asset valuation history:

```text
Asset
Date
Value
Source
Notes
```

Show:

- Net worth history
- Asset value history
- Month-over-month change
- Percentage change

## Phase 12 acceptance test

Create multiple fake snapshots.

Verify:

- Historical values remain unchanged.
- Current values can change.
- Charts use historical data.
- Percentage changes calculate correctly.

Then STOP.

---

# 19. PHASE 13 — IMPORT / EXPORT

Only implement this after the core application is stable.

## Export

Support:

### JSON

Complete backup.

### CSV

Separate exports for:

- Assets
- Liabilities
- Income
- Expenses
- Contributions
- Goals
- Snapshots

### Excel

Create a readable workbook.

---

## Optional Excel import

If implemented:

1. Upload file.
2. Detect sheets.
3. Preview.
4. Map columns.
5. Detect possible duplicates.
6. Show import preview.
7. Ask user for confirmation.
8. Import.
9. Preserve source information.

Never automatically merge ambiguous records.

Never silently overwrite existing data.

---

# 20. PHASE 14 — TESTING AND POLISH

Perform complete testing.

## Calculation tests

Test:

- Future value
- SIP
- Growing SIP
- Ownership
- Net worth
- Inflation
- Loan balance
- Milestones

## CRUD tests

Test:

- Family members
- Assets
- Liabilities
- Income
- Expenses
- Contributions
- Goals
- Snapshots

## UI tests

Test:

- Desktop
- Tablet
- Mobile
- Empty states
- Loading states
- Error states
- Large numbers

## Security/privacy

Confirm:

- No personal data is hard-coded.
- No financial data is sent externally.
- No unnecessary logging.
- Delete functionality works.
- Backup works.

Fix all major issues before proceeding.

Then STOP.

---

# 21. PHASE 15 — FINAL REVIEW

Only perform this after the user approves Phase 14.

Review:

### Architecture

- Clean components
- Reusable services
- No duplicated financial logic

### Calculations

- Correct formulas
- Correct ownership
- Correct projections

### UX

- Clear dashboard
- Simple data entry
- Good mobile experience

### Performance

- Fast loading
- No unnecessary rerenders

### Data

- Reliable persistence
- Backup/restore
- No data loss during normal use

### Documentation

Create a short README explaining:

- How to run the application
- How data is stored
- How calculations work
- How to backup data
- How to restore data

---

# 22. FINANCIAL CALCULATION SERVICE

All calculations must be isolated from UI.

Suggested functions:

```typescript
calculateFutureValue()
calculateSIPFutureValue()
calculateGrowingSIPFutureValue()
calculateAssetFutureValue()
calculateOwnershipValue()
calculateTotalAssets()
calculateTotalLiabilities()
calculateNetWorth()
calculateAssetAllocation()
calculateLoanBalance()
calculateLoanPayment()
calculateRequiredMonthlyContribution()
calculateInflationAdjustedValue()
calculateProjectedNetWorth()
calculateMilestoneDate()
```

Do not put formulas directly inside React components.

---

# 23. ASSET MODEL

Use a structure similar to:

```typescript
type Asset = {
  id: string;

  name: string;
  assetClass: AssetClass;
  subcategory?: string;

  institution?: string;

  quantity?: number;
  unit?: string;
  unitPrice?: number;

  purchaseValue?: number;
  currentValue: number;

  valuationMethod: "manual" | "quantity_x_price";

  valuationDate: string;

  conservativeGrowthRate: number;
  baseGrowthRate: number;
  optimisticGrowthRate: number;

  liquidity: "liquid" | "semi-liquid" | "illiquid";

  monthlyContribution?: number;
  annualContribution?: number;
  annualContributionGrowth?: number;

  annualIncome?: number;
  incomeGrowthRate?: number;

  notes?: string;

  createdAt: string;
  updatedAt: string;
};
```

Ownership:

```typescript
type AssetOwnership = {
  id: string;
  assetId: string;
  familyMemberId: string;
  percentage: number;
};
```

---

# 24. LIABILITY MODEL

```typescript
type Liability = {
  id: string;
  ownerId: string;

  name: string;
  type: string;

  originalAmount: number;
  currentOutstanding: number;

  interestRate: number;
  monthlyEMI?: number;
  remainingMonths?: number;

  startDate?: string;
  expectedEndDate?: string;

  notes?: string;

  createdAt: string;
  updatedAt: string;
};
```

---

# 25. IMPORTANT FINANCIAL DISTINCTIONS

Keep these separate:

### Asset appreciation

```text
Property value increases.
```

### Investment return

```text
Investment value increases.
```

### Income

```text
Salary / rent / interest / business income.
```

### Contribution

```text
Money invested into an asset.
```

### Expense

```text
Money consumed.
```

### Debt repayment

```text
Money used to reduce liability.
```

Never combine all of these into one growth calculation.

---

# 26. CURRENCY FORMAT

Default currency:

**INR ₹**

Indian numbering:

```text
₹1,000
₹10,000
₹1,00,000
₹10,00,000
₹1,00,00,000
```

Compact:

```text
₹2.5 Lakh
₹80 Lakh
₹1.2 Crore
```

Allow:

```text
Exact
Lakh/Crore
```

---

# 27. PRIVACY

This application handles sensitive financial information.

MVP requirements:

- Local storage only.
- No analytics by default.
- No external financial API required.
- No unnecessary telemetry.
- Do not log financial values.
- Do not store sensitive account numbers unless explicitly required.
- Allow complete backup.
- Allow complete deletion.

Future cloud implementation must include authentication and strict data isolation.

---

# 28. FINANCIAL DISCLAIMER

Include:

> This application is a personal wealth tracking and projection tool. Future values are estimates based on user-entered assumptions and are not guaranteed returns or financial advice.

---

# 29. CODING RULES

Follow these rules throughout the project:

1. TypeScript strict mode.
2. Reusable components.
3. Reusable calculation services.
4. No duplicated financial formulas.
5. No hard-coded personal data.
6. No hard-coded production financial values.
7. Use validation for user inputs.
8. Keep calculations testable.
9. Keep storage logic separate from UI.
10. Keep financial logic separate from UI.
11. Do not silently modify user data.
12. Do not silently merge records.
13. Confirm destructive actions.
14. Preserve historical data.
15. Do not over-engineer the MVP.
16. Prefer simple reliable implementations.
17. Avoid adding dependencies without a clear reason.

---

# 30. PHASE COMPLETION REPORT

At the end of EVERY phase, Claude must provide a concise report in this format:

```text
## Phase X Complete

### Built
- ...
- ...
- ...

### Files Changed
- ...
- ...

### Tests Run
- ...
- ...

### Test Result
PASS / FAIL

### Manual Verification
1. ...
2. ...
3. ...

### Known Issues
- None
OR
- ...

### Next Phase
Phase X+1

Waiting for approval.
```

Then STOP.

---

# 31. NEVER CONTINUE AUTOMATICALLY

This is mandatory.

After a phase is complete:

**STOP WORKING.**

Do not:

- Start the next phase.
- Add unrelated features.
- Refactor unrelated code.
- Implement future phases "while you are there".
- Assume approval.

Wait for explicit user approval.

---

# 32. IF A PHASE FAILS

If tests fail:

1. Do not proceed.
2. Diagnose the issue.
3. Fix the issue.
4. Re-run tests.
5. Report the result.
6. Only stop after the phase passes or the user is informed of the blocker.

If a requirement is ambiguous:

- Ask the user before implementing a major decision.
- Do not invent financial assumptions.

---

# 33. IF THE USER ASKS TO SKIP A PHASE

Allow the user to explicitly skip a phase.

Before skipping:

```text
This phase provides X functionality.
Skipping it means Y will not work yet.

Continue anyway?
```

If the user confirms, record the skipped phase in the development notes.

---

# 34. IF THE USER ASKS FOR A CHANGE TO A COMPLETED PHASE

Do not automatically move forward.

Instead:

1. Identify which phase the change belongs to.
2. Make the smallest safe change.
3. Run that phase's tests again.
4. Report the result.
5. Return to the current approved phase.

Avoid unnecessary rewrites.

---

# 35. DEMO DATA

If UI development requires data, use only fake data:

```text
Person A
Person B

Example Equity Fund
Example Property
Example Gold
Example FD

₹5,00,000
₹10,00,000
₹25,00,000
```

Mark demo data clearly.

Provide:

**Clear Demo Data**

button if practical.

Do not allow demo data to be confused with real financial information.

---

# 36. SUCCESS CRITERIA

The final product should allow a family to:

1. Create family members.
2. Add assets.
3. Assign ownership.
4. Track current values.
5. Track asset classes.
6. Track liabilities.
7. Calculate net worth.
8. View asset allocation.
9. Calculate future value.
10. Calculate SIP/recurring investment growth.
11. Compare Conservative/Base/Optimistic scenarios.
12. Adjust for inflation.
13. Track income.
14. Track expenses.
15. Calculate free cash flow.
16. Create financial goals.
17. Track wealth history.
18. Back up data.
19. Export data.
20. Optionally import existing financial data later.

---

# 37. FINAL COMMAND TO CLAUDE

Start with **PHASE 0 ONLY**.

Do not build Phase 1 until Phase 0 is completed and the user approves it.

At the end of Phase 0:

- Explain what you inspected.
- Explain the recommended architecture.
- Explain what will be built in Phase 1.
- Do not write unrelated application features.
- STOP and wait for the user's approval.

After the user approves, build Phase 1 only.

Continue this approval-gated process for every phase.

The objective is not to produce the entire application in one response.

The objective is to build a **stable, tested, maintainable family wealth application one verified phase at a time.**
