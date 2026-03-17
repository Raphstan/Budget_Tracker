# CAHIER DES CHARGES — Israeli Personal Finance App
**Version:** 3.0
**Owner:** Raphaël Stanislas
**Updated:** March 2026
**Changes from v2:** Salt Edge removed. Replaced by CSV/Excel upload with bank-specific export guides. Progressive bank support (Leumi first).

> This document is the single source of truth for the MVP build.
> Do not build anything not listed in MVP SCOPE.
> Do not make product decisions — if something is ambiguous, stop and ask.
> For the execution task list, see `IsraelFinanceApp_RunMap_v1.md`.

---

## 1. PRODUCT SUMMARY

A web app where Israeli users upload their bank export file and get automatic AI insights on their spending.

**Core loop:**
1. User selects their bank → follows an in-app step-by-step guide to export their transactions as Excel/CSV
2. User uploads the file → app parses and categorizes transactions automatically
3. App generates 1 AI insight (daily for premium, weekly for free)
4. User sees dashboard: balance + cash flow + categories + insight

**No bank credentials. No OAuth. No real-time sync.**
Users re-upload manually when they want fresh data (monthly).

**What it is NOT:**
→ Not a financial advisor
→ Not a budgeting tool (users don't set budgets)
→ Not a chat interface
→ Not a mobile app (web only, MVP)
→ Not a real-time sync product

---

## 2. TECH STACK

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | React. TypeScript. |
| Backend | Next.js API routes | Serverless. No separate backend. |
| Database | PostgreSQL via Supabase | Managed. Use Supabase JS client. |
| Auth | Supabase Auth | Google SSO + email/password. |
| File parsing | `xlsx` npm package | Parse .xls and .xlsx from Israeli banks. |
| CSV parsing | `papaparse` npm package | Parse .csv fallback. |
| File upload UI | `react-dropzone` | Drag & drop + browse. |
| AI Insights | Anthropic Claude API | claude-haiku-4-5-20251001 |
| Payments | Stripe | Monthly subscription. |
| Hosting | Vercel | Frontend + API routes. |
| Analytics | PostHog | Self-hosted events. |
| Styling | Tailwind CSS + shadcn/ui | No custom CSS framework. |
| Charts | Recharts | Category breakdown. |
| i18n | next-intl | Hebrew + English. |

---

## 3. ARCHITECTURE OVERVIEW

### 3.1 System Components

```
[User Browser]
    ↓ HTTPS
[Next.js on Vercel]
    → /app (frontend pages + components)
    → /api (backend routes)
        ↓                    ↓                  ↓
[Supabase DB]         [Claude API]         [Stripe API]
[Supabase Auth]       (AI insights)        (subscriptions)
```

No webhook from banks. No external bank connection. All data comes from user-uploaded files.

### 3.2 Data Model

**users** (Supabase Auth + extended profile)
```
id              uuid        PK (from Supabase Auth)
email           text        unique
full_name       text
language        text        default 'he'  — 'he' | 'en'
tier            text        default 'free'  — 'free' | 'premium'
onboarding_done boolean     default false
created_at      timestamp
```

**uploads** (each file the user imports)
```
id              uuid        PK
user_id         uuid        FK → users.id
bank_name       text        'leumi' | 'hapoalim' | 'discount' | 'mizrahi' | 'yahav' | 'fibi'
filename        text        original file name
transaction_count int       number of transactions parsed
period_start    date        earliest transaction date in file
period_end      date        latest transaction date in file
uploaded_at     timestamp
```

**transactions**
```
id                  uuid        PK
upload_id           uuid        FK → uploads.id
user_id             uuid        FK → users.id
raw_id              text        unique per user — hash of (date + amount + description) for dedup
amount              numeric     negative = expense, positive = income
currency            text        default 'ILS'
date                date
description         text        raw description from bank export
merchant_name       text        cleaned merchant name (parsed from description)
category_id         uuid        FK → categories.id
is_manual_override  boolean     default false
created_at          timestamp
```

**Deduplication rule:** Before inserting a transaction, check if `raw_id` already exists for this `user_id`. If yes, skip. This prevents duplicates when user re-uploads overlapping periods.

**categories**
```
id          uuid    PK
name_he     text
name_en     text
icon        text    emoji
type        text    'expense' | 'income'
is_system   boolean
sort_order  integer
```

Default system categories (seed on DB setup):

| name_he | name_en | icon | type |
|---|---|---|---|
| משכורת | Salary | 💼 | income |
| הכנסה אחרת | Other Income | ➕ | income |
| מזון וסופר | Food & Groceries | 🛒 | expense |
| מסעדות | Restaurants & Cafes | 🍽️ | expense |
| דיור | Housing & Rent | 🏠 | expense |
| תחבורה | Transport & Fuel | 🚗 | expense |
| חשבונות | Bills & Utilities | 📱 | expense |
| בריאות | Health | 💊 | expense |
| חינוך | Education | 📚 | expense |
| בידור | Entertainment | 🎬 | expense |
| קניות | Shopping | 🛍️ | expense |
| אחר | Other | 📌 | expense |

**insights**
```
id              uuid        PK
user_id         uuid        FK → users.id
content_he      text        Hebrew observation (max 2 sentences)
content_en      text        English observation (max 2 sentences)
action_he       text        Hebrew action (1 sentence)
action_en       text        English action (1 sentence)
generated_at    timestamp
is_read         boolean     default false
period_start    date
period_end      date
```

**subscriptions**
```
id                      uuid    PK
user_id                 uuid    FK → users.id (unique)
stripe_customer_id      text
stripe_subscription_id  text
status                  text    'active' | 'canceled' | 'past_due'
tier                    text    'free' | 'premium'
current_period_end      timestamp
updated_at              timestamp
```

**merchant_preferences** (optional — built in Phase 2)
```
id              uuid    PK
user_id         uuid    FK → users.id
merchant_name   text    exact merchant string from description
category_id     uuid    FK → categories.id
created_at      timestamp
UNIQUE(user_id, merchant_name)
```

---

## 4. BANK CSV/EXCEL FORMATS

### 4.1 Supported Banks (MVP launch order)

| Bank | Status | Format | Notes |
|---|---|---|---|
| Leumi (לאומי) | ✅ Launch | `.xls` / `.xlsx` | Built and tested by Raphaël |
| Hapoalim (הפועלים) | 🔜 Phase 2 | `.xls` | Largest bank in Israel |
| Discount (דיסקונט) | 🔜 Phase 2 | `.xlsx` | |
| Mizrahi (מזרחי) | 🔜 Phase 3 | `.xlsx` | |
| Yahav (יהב) | 🔜 Phase 3 | `.xlsx` | Government workers |
| First International (FIBI) | 🔜 Phase 3 | `.xlsx` | |

For banks not yet supported: show "Coming soon — notify me" with email capture.

### 4.2 Leumi Export Format

**How to export from Leumi:**
1. Log into `bankleumi.co.il`
2. Click "חשבונות" → select account
3. Click "תנועות בחשבון"
4. Set date range (last 3 months recommended)
5. Click the Excel icon (bottom of the transactions list)
6. File downloads as `.xls`

**Column mapping (Leumi .xls):**

| Leumi column | Our field | Notes |
|---|---|---|
| תאריך | `date` | Format: DD/MM/YYYY |
| תיאור | `description` | Raw transaction description |
| חובה | `amount` | Debit — store as negative |
| זכות | `amount` | Credit — store as positive |
| יתרה | (ignored) | Balance snapshot — not stored |

**Parser logic:**
- If "חובה" has a value → `amount = -1 * parseFloat(חובה)`
- If "זכות" has a value → `amount = +1 * parseFloat(זכות)`
- Skip rows where both are empty (header rows, summary rows)
- Skip rows where date is not parseable
- `raw_id` = MD5 hash of `${date}|${amount}|${description}` per user

> **Note:** Get a real Leumi export file from Raphaël's account before building the parser. Column names may have minor formatting differences. Build the parser against the actual file.

### 4.3 Parser Architecture

One parser function per bank. All parsers return the same normalized format:

```typescript
interface ParsedTransaction {
  date: string           // ISO format: YYYY-MM-DD
  amount: number         // negative = expense, positive = income
  description: string    // raw text from bank
  currency: string       // default 'ILS'
}
```

Entry point: `parseFile(file: File, bank: BankName): Promise<ParsedTransaction[]>`

---

## 5. USER FLOWS

### 5.1 Onboarding (new user)

**Step 1 — Sign up** (`/auth/signup`)
- Fields: Email + Password, or Google SSO button
- On success → `/onboarding/bank`

**Step 2 — Bank selection** (`/onboarding/bank`)
- 6 bank logos in a grid (large, clickable cards)
- Leumi: active. Others: show logo with "Coming soon" badge.
- On click (Leumi) → `/onboarding/export`

**Step 3 — Export guide** (`/onboarding/export`)
- Bank-specific step-by-step instructions
- Numbered steps with screenshots or illustrated icons
- Maximum 4–5 steps. Short. In user's language.
- CTA button at bottom: "I downloaded my file →"
- On click → `/onboarding/upload`

**Step 4 — File upload** (`/onboarding/upload`)
- Large drag-and-drop zone
- Accepts: `.xls`, `.xlsx`, `.csv`
- On file selected: show filename + "Upload and analyze" button
- On upload:
  - POST `/api/upload` → parse + categorize + store transactions
  - Show progress: "Reading file... → Categorizing transactions... → Generating your first insight..."
  - On success → redirect to `/dashboard`
  - On error → show specific error message + retry

**Mark onboarding complete:** `users.onboarding_done = true` on successful upload.

---

### 5.2 Dashboard (`/dashboard`)

**Layout:** Single scrollable page. Top nav only (no sidebar).

**Top nav:**
- Left: Logo + app name
- Right: Language toggle (he/en) | User avatar → dropdown (Settings, Logout)

**Section 1 — Summary cards**

| Card | Value |
|---|---|
| Total balance | Sum of last known balance across uploads (most recent period_end per bank) |
| Income this month | Sum of positive transactions where date is in current calendar month |
| Expenses this month | Sum of ABS(negative transactions) in current calendar month |
| Surplus | Income − Expenses |

**Section 2 — AI Insight card**
- Most recent insight (unread first)
- Format: observation text + separator line + action text
- Badge: "Today's insight" or date if older
- On view: mark `is_read = true`
- Freemium lock: if free user already used weekly quota → blurred card with upgrade CTA

**Section 3 — Expenses by category**
- Current month only
- Horizontal bar chart (Recharts)
- Each bar: category icon + name + amount (₪) + % of total expenses
- Sorted by amount descending
- Click → filter transactions list by that category (slide-over panel)

**Section 4 — Recent transactions**
- Last 15 transactions across all uploads
- Row: date | merchant name | category icon | amount (color: green income / red expense)
- Click row → Transaction detail slide-over

**Section 5 — Upload history**
- List of past uploads: bank name | date uploaded | # transactions | period covered
- "Upload new file" button (always visible)
- Freemium gate: free users limited to data from last 30 days

**Empty states:**
- No uploads yet → "Upload your first bank file" CTA
- No transactions in current month → "No transactions found for this month"
- No insight yet → "Your first insight is being generated..."

---

### 5.3 Transaction Detail (slide-over panel)

- Merchant name (large)
- Amount + date
- Current category (pill with icon)
- "Change category" → dropdown with all system categories
- On change: PATCH `/api/transactions/:id` — set `category_id`, `is_manual_override = true`
- Optional: "Always categorize [merchant] as [category]" → save to `merchant_preferences`

---

### 5.4 Transactions List (`/transactions`)

- Filter bar: date range | category
- Default: current month, all categories
- Table: date | merchant | category | amount
- 50 rows per page, pagination
- Click row → slide-over detail panel

---

### 5.5 Insights History (`/insights`)

- Premium only. Free users see paywall component.
- List, newest first
- Each card: date | observation | action

---

### 5.6 Settings (`/settings`)

**Sections:**
- Profile: name (editable), email (read-only), language toggle
- Upload history: same as dashboard section 5, with "Delete upload" option
- Subscription: current plan + renewal date + manage (Stripe portal) or upgrade CTA
- Danger zone: "Delete my account" → confirmation → cascade delete all data

---

### 5.7 Upgrade / Paywall Modal

**Triggered by:**
- Trying to access blurred insight (free quota used)
- Clicking "Insights history" (free)
- Trying to view data older than 30 days (free)

**Content:**
- Headline: "Unlock full access" / "גישה מלאה"
- Feature comparison table:

| Feature | Free | Premium |
|---|---|---|
| File uploads | Unlimited | Unlimited |
| Data history | 30 days | 12 months |
| AI insights | 1/week | Daily |
| Insights archive | ✗ | ✓ |

- Price: ₪25/month
- CTA: "Start Premium" → Stripe Checkout
- Sub-copy: "Cancel anytime."

---

## 6. BUSINESS LOGIC RULES

### 6.1 Freemium Gating

| Feature | Free | Premium | Enforcement |
|---|---|---|---|
| File uploads | Unlimited | Unlimited | No gate |
| Data shown | Last 30 days | Last 365 days | Server-side date filter on all queries |
| AI insights | 1 per 7 days | 1 per calendar day | Check `insights` table before generating |
| Insights archive page | ✗ | ✓ | Page renders paywall component |

**Always validate tier server-side. Never trust client-only state.**

### 6.2 Insight Generation Rules

**Trigger:** Insight is generated automatically after a successful file upload, if eligible.
Also available: manual trigger button on dashboard ("Refresh insight").

**Eligibility:**
- User must have ≥ 10 transactions in their data
- Premium: no insight generated today → generate
- Free: no insight generated in last 7 days → generate
- If not eligible: skip silently, show last insight or "not enough data" state

**Insight must be different from the last 3 insights.** Pass last 3 `content_{language}` values to Claude prompt.

**Both languages generated always** (Hebrew + English), regardless of user's language setting.

### 6.3 Auto-Categorization (Priority Order)

1. User has a `merchant_preferences` entry for this merchant → use it (never override)
2. Exact match on cleaned `merchant_name` in seed lookup table
3. Keyword match on `description` field
4. Fallback → "אחר / Other"

**Do NOT re-categorize if `is_manual_override = true`.**

**Israeli merchant seed data:**

| Merchant keywords | Category |
|---|---|
| שופרסל, ויקטורי, רמי לוי, מגה, יינות ביתן, AM:PM | מזון וסופר |
| מקדונלד, ארומה, קפה, סושי, פיצה, מסעדה, שווארמה | מסעדות |
| פז, סונול, דלק, רב קו, אגד, מטרו | תחבורה |
| סלקום, הוט, פרטנר, 012, בזק, yes | חשבונות |
| מכבי, כללית, לאומית, מאוחדת, בית מרקחת, סופר פארם | בריאות |
| משכורת, שכר, salary, העברה מ | משכורת |

### 6.4 Balance Calculation

- No "live" balance. Balance is derived from uploaded data.
- Monthly income = SUM(amount) WHERE amount > 0 AND date IN current month
- Monthly expenses = SUM(ABS(amount)) WHERE amount < 0 AND date IN current month
- Surplus = income − expenses
- "Total balance" is not calculated (no running balance in CSV files) — **remove this card or replace with "Total income vs expenses this month"**

> Note: Israeli bank exports don't always include a reliable running balance column. Do not display a "total balance" figure that could be wrong. Show income vs. expenses instead.

---

## 7. INTEGRATION SPECIFICATIONS

### 7.1 Claude API (AI Insights)

**Model:** `claude-haiku-4-5-20251001`

**Prompt template:**

```
You are a financial assistant for an Israeli personal finance app.
The user's language is: {language} ('he' = Hebrew, 'en' = English).

User's financial data ({period_start} to {period_end}):
- Total income: {total_income} ₪
- Total expenses: {total_expenses} ₪
- Surplus: {surplus} ₪
- Top 3 spending categories: {top_categories}
  (format: "Category name: X₪ (Y% of expenses)")
- Biggest single expense: {biggest_expense_merchant} — {biggest_expense_amount} ₪
- Month-over-month expense change: {mom_change}% (if prior month data exists)

Recent insights already shown — DO NOT repeat these observations:
{last_3_insights_content}

Generate exactly:
1. One observation: 1–2 sentences. Specific. Use numbers. Factual only.
2. One action: 1 sentence. Concrete. Not generic.

Hard rules:
- Never recommend a specific financial product, bank, fund, or broker
- Never advise buying or selling any asset
- Never advise on taxes
- Compare, inform, quantify — never prescribe
- If data is insufficient for a meaningful observation, return {"observation": null, "action": null}

Generate in BOTH languages regardless of user setting.

Respond in this exact JSON format only:
{
  "he": { "observation": "...", "action": "..." },
  "en": { "observation": "...", "action": "..." }
}
```

**Call parameters:**
- Max tokens: 400
- Temperature: 0.7
- On JSON parse failure: retry once with temperature 0
- On second failure: log error, skip generation

### 7.2 Stripe

**Checkout flow:**
1. User clicks "Start Premium" → POST `/api/stripe/create-checkout-session`
2. Backend creates Stripe Checkout Session:
   - `mode: 'subscription'`
   - `price_id`: `STRIPE_PREMIUM_PRICE_ID` (env var)
   - `customer_email`: user's email
   - `metadata.user_id`: Supabase user UUID
   - `success_url`: `/dashboard?upgrade=success`
   - `cancel_url`: `/dashboard`
3. Redirect to Stripe-hosted checkout

**Webhook events** (`POST /api/webhooks/stripe`):
- `checkout.session.completed` → upsert subscription, set `users.tier = 'premium'`
- `customer.subscription.updated` → update subscription status
- `customer.subscription.deleted` → set `users.tier = 'free'`
- `invoice.payment_failed` → set status `past_due`

**Cancellation:** Redirect to Stripe Customer Portal via `POST /api/stripe/create-portal-session`.

---

## 8. ERROR STATES

### Upload Errors

| Error | Message (EN) | Message (HE) |
|---|---|---|
| Unsupported file type | "Please upload an .xls or .xlsx file." | "אנא העלה קובץ .xls או .xlsx" |
| File too large (>10MB) | "File too large. Max 10MB." | "הקובץ גדול מדי. מקסימום 10MB" |
| Wrong bank format | "This file doesn't match [Bank] format. Re-export and try again." | "הקובץ לא תואם לפורמט [בנק]. ייצא מחדש ונסה שוב" |
| No transactions found | "No transactions found in this file. Check the date range and re-export." | "לא נמצאו תנועות בקובץ. בדוק את טווח התאריכים" |
| All transactions already imported | "These transactions are already in your account." | "תנועות אלה כבר קיימות בחשבון" |

### Insight Errors

| Error | Behavior |
|---|---|
| Not enough data (<10 transactions) | Show: "Upload more data to get your first insight." |
| Claude API failure | Retry once. If fails: show last insight. Log error. |
| Quota not met (too recent) | Show last insight with date. No error message. |

### Auth Errors

| Error | Behavior |
|---|---|
| Invalid credentials | Inline form error. No redirect. |
| Email already exists | "Account exists. Sign in instead." + link |
| Session expired | Redirect to `/auth/login?redirect=/dashboard` |

### Payment Errors

| Error | Behavior |
|---|---|
| Payment failed | Toast: "Payment failed. Update your payment method in Settings." |
| Subscription expired | Downgrade to free. Dashboard banner: "Your Premium plan has expired." |

---

## 9. SECURITY CONSTRAINTS

- No bank credentials ever stored or transmitted
- All `/api` routes validate Supabase session token
- All DB queries include `WHERE user_id = {authenticated_user_id}`
- Stripe webhook: validate signature header on every request
- User data deletion: "Delete my account" cascades to all tables
- Terms of Service + Privacy Policy checkbox at signup (unchecked by default)
- No PII sent to Claude API — only aggregated financial summaries

---

## 10. ENVIRONMENT VARIABLES

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PREMIUM_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 11. MVP SCOPE (LOCKED)

### IN
- Signup / login (email + Google)
- Onboarding: bank selection + export guide + file upload
- CSV/Excel parser (Leumi at launch)
- Auto-categorization + manual override
- Dashboard: income/expenses/surplus cards, category breakdown, recent transactions, insight card
- AI insight (1/week free, 1/day premium)
- Freemium model (30-day history free, 12 months premium, ₪25/month)
- Stripe subscription
- Hebrew + English
- Web only

### OUT (post-MVP)
- Real-time bank sync (Salt Edge or scrapers)
- Hapoalim / Discount / Mizrahi parsers (built progressively after launch)
- Pension decoder
- Hishtalmut tracker
- Savings goals
- Chat AI
- Mobile app
- PDF monthly report
- Push/email notifications
- French, Russian languages

---

## 12. WHAT IS NOT DECIDED

→ Product name (working titles: Klar, Numo, Zeni, Matzpen, Peli)
→ Legal entity structure
→ Whether to raise pre-seed before or after MVP validation

---

*For execution tasks and build order, see `IsraelFinanceApp_RunMap_v1.md`.*
