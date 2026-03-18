# RUN MAP — Israeli Personal Finance App
**Version:** 1.0
**Owner:** Raphaël Stanislas
**Updated:** March 2026
**Reference spec:** `IsraelFinanceApp_CDC_v3.md`

---

## HOW TO USE THIS DOCUMENT

Each session with Claude Code = one task.

**Start every Claude Code session with:**
> "Read `IsraelFinanceApp_CDC_v3.md` and `IsraelFinanceApp_RunMap_v1.md`. Then execute TASK [N]."

**Rules:**
→ Complete tasks in order. Do not skip.
→ Mark each task ✅ when done.
→ Do not start the next phase until every task in the current phase is ✅.
→ If Claude Code gets stuck: describe the blocker in a note next to the task. Do not push forward.

---

## PHASE 1 — Foundation

**Goal:** Project runs locally, auth works, DB is ready.

---

### TASK 001 — Initialize Next.js project ✅

**Depends on:** nothing

**Build:**
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
```

Then install all project dependencies in one shot:
```bash
npm install @supabase/supabase-js @supabase/ssr \
  @anthropic-ai/sdk \
  stripe @stripe/stripe-js \
  xlsx papaparse \
  react-dropzone \
  recharts \
  next-intl \
  posthog-js \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-slot \
  class-variance-authority clsx tailwind-merge lucide-react
```

Install shadcn/ui:
```bash
npx shadcn-ui@latest init
```
Select: Default style, Slate color, CSS variables: yes.

Add shadcn components used in the project:
```bash
npx shadcn-ui@latest add button card badge dialog dropdown-menu input label select separator sheet skeleton toast
```

**Create `.env.local`** at root with all variables from CDC Section 10. Leave values empty for now.

**Done when:**
- [ ] `npm run dev` runs with no errors
- [ ] No TypeScript errors on `npm run build`
- [ ] shadcn components render correctly (test with a temp `<Button>Hello</Button>` on the home page)

---

### TASK 002 — Supabase project + database schema ✅

**Depends on:** TASK 001

**Step 1:** Create a Supabase project at `supabase.com`. Free tier. Region: EU West (Frankfurt — closest to Israel).

**Step 2:** Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
```

**Step 3:** Run this SQL in Supabase SQL Editor to create all tables:

```sql
-- Extend auth.users with a public profile
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  language text default 'he' check (language in ('he', 'en')),
  tier text default 'free' check (tier in ('free', 'premium')),
  onboarding_done boolean default false,
  created_at timestamptz default now()
);

-- Categories (system-seeded)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_he text not null,
  name_en text not null,
  icon text,
  type text check (type in ('expense', 'income')),
  is_system boolean default true,
  sort_order integer default 0
);

-- Uploads (each file import)
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  bank_name text not null,
  filename text,
  transaction_count integer default 0,
  period_start date,
  period_end date,
  uploaded_at timestamptz default now()
);

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.uploads(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  raw_id text not null,
  amount numeric not null,
  currency text default 'ILS',
  date date not null,
  description text,
  merchant_name text,
  category_id uuid references public.categories(id),
  is_manual_override boolean default false,
  created_at timestamptz default now(),
  unique(user_id, raw_id)
);

-- Insights
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  content_he text,
  content_en text,
  action_he text,
  action_en text,
  generated_at timestamptz default now(),
  is_read boolean default false,
  period_start date,
  period_end date
);

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'active',
  tier text default 'free',
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

-- Merchant preferences
create table public.merchant_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  merchant_name text not null,
  category_id uuid references public.categories(id) not null,
  created_at timestamptz default now(),
  unique(user_id, merchant_name)
);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.uploads enable row level security;
alter table public.transactions enable row level security;
alter table public.insights enable row level security;
alter table public.subscriptions enable row level security;
alter table public.merchant_preferences enable row level security;
alter table public.categories enable row level security;

-- RLS policies: users can only access their own data
create policy "users: own data" on public.users for all using (auth.uid() = id);
create policy "uploads: own data" on public.uploads for all using (auth.uid() = user_id);
create policy "transactions: own data" on public.transactions for all using (auth.uid() = user_id);
create policy "insights: own data" on public.insights for all using (auth.uid() = user_id);
create policy "subscriptions: own data" on public.subscriptions for all using (auth.uid() = user_id);
create policy "merchant_preferences: own data" on public.merchant_preferences for all using (auth.uid() = user_id);
create policy "categories: readable by all authenticated" on public.categories for select using (auth.role() = 'authenticated');
```

**Step 4:** Seed categories — run this SQL:

```sql
insert into public.categories (name_he, name_en, icon, type, is_system, sort_order) values
('משכורת', 'Salary', '💼', 'income', true, 1),
('הכנסה אחרת', 'Other Income', '➕', 'income', true, 2),
('מזון וסופר', 'Food & Groceries', '🛒', 'expense', true, 10),
('מסעדות', 'Restaurants & Cafes', '🍽️', 'expense', true, 11),
('דיור', 'Housing & Rent', '🏠', 'expense', true, 12),
('תחבורה', 'Transport & Fuel', '🚗', 'expense', true, 13),
('חשבונות', 'Bills & Utilities', '📱', 'expense', true, 14),
('בריאות', 'Health', '💊', 'expense', true, 15),
('חינוך', 'Education', '📚', 'expense', true, 16),
('בידור', 'Entertainment', '🎬', 'expense', true, 17),
('קניות', 'Shopping', '🛍️', 'expense', true, 18),
('אחר', 'Other', '📌', 'expense', true, 99);
```

**Done when:**
- [ ] All tables created in Supabase without errors
- [ ] RLS enabled on all tables
- [ ] Categories seeded (12 rows visible in Supabase Table Editor)

---

### TASK 003 — Supabase Auth setup ✅

**Depends on:** TASK 002

**Build these files:**

`src/lib/supabase/client.ts` — browser client
`src/lib/supabase/server.ts` — server client (for API routes and Server Components)
`src/lib/supabase/middleware.ts` — session refresh middleware

Follow the official Supabase Next.js App Router guide: https://supabase.com/docs/guides/auth/server-side/nextjs

**Pages to create:**
- `src/app/auth/login/page.tsx` — Email/password form + Google SSO button
- `src/app/auth/signup/page.tsx` — Email/password form + Google SSO button + ToS checkbox
- `src/app/auth/callback/route.ts` — OAuth callback handler (required for Google SSO)

**Auto-create user profile on signup:**
In Supabase Dashboard → Database → Functions → create a trigger:
```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**Enable Google OAuth in Supabase:**
Dashboard → Authentication → Providers → Google → enable + add credentials.
(Raphaël: create a Google Cloud OAuth app and add the Client ID + Secret to Supabase)

**Done when:**
- [ ] Can sign up with email → user row created in `public.users`
- [ ] Can log in with email
- [ ] Can log out
- [ ] Google SSO button visible (can be non-functional until Google OAuth configured)
- [ ] `/auth/callback` route works

---

### TASK 004 — Protected route middleware ✅

**Note:** Implemented as part of TASK 003 (`src/proxy.ts`). All 3 redirect rules covered.

**Depends on:** TASK 003

**Build:** `src/middleware.ts`

Logic:
- If user is not authenticated AND trying to access any route except `/`, `/auth/*`, `/api/webhooks/*` → redirect to `/auth/login?redirect=[current path]`
- If user is authenticated AND tries to access `/auth/login` or `/auth/signup` → redirect to `/dashboard`
- If user is authenticated AND `onboarding_done = false` AND not on `/onboarding/*` → redirect to `/onboarding/bank`

**Done when:**
- [ ] Unauthenticated user hitting `/dashboard` → redirected to login
- [ ] Logged-in user hitting `/auth/login` → redirected to dashboard
- [ ] New user (onboarding_done = false) → redirected to `/onboarding/bank`

---

## PHASE 2 — Onboarding & File Upload

**Goal:** User can go through the full onboarding, upload a Leumi file, see parsed transactions.

---

### TASK 005 — i18n setup (Hebrew + English) ✅

**Depends on:** TASK 004

**Build:**
- Configure `next-intl` in `next.config.ts`
- Create `src/i18n/messages/he.json` and `src/i18n/messages/en.json`
- Create `src/i18n/routing.ts` with locales `['he', 'en']` and `defaultLocale: 'he'`

**Hebrew is RTL.** Configure `dir="rtl"` on `<html>` when language is `he`.

**All user-facing strings go into the message files from the start.** Never hardcode UI text directly in components.

Strings to include at this stage (add more as you build each component):
```json
// he.json (sample — expand as you build)
{
  "auth": {
    "login": "התחברות",
    "signup": "הרשמה",
    "email": "אימייל",
    "password": "סיסמה",
    "continue_google": "המשך עם Google",
    "agree_terms": "אני מסכים לתנאי השימוש ומדיניות הפרטיות"
  },
  "onboarding": {
    "select_bank": "באיזה בנק אתה?",
    "coming_soon": "בקרוב",
    "export_title": "ייצא את העסקאות שלך",
    "upload_title": "העלה את הקובץ",
    "upload_cta": "גרור לכאן או לחץ לבחור קובץ",
    "analyzing": "מנתח את הנתונים שלך..."
  }
}
```

**Done when:**
- [ ] `next-intl` configured, no build errors
- [ ] Switching between `he` and `en` renders different strings
- [ ] `dir="rtl"` applied when language is Hebrew

---

### TASK 006 — Bank selector screen ☐

**Depends on:** TASK 005

**Route:** `/onboarding/bank`

**Build:** `src/app/onboarding/bank/page.tsx`

**UI:**
- Title: "באיזה בנק אתה?" / "Which bank are you with?"
- 6 bank cards in a 2×3 grid (or 3×2 on mobile)
- Each card: bank logo + bank name in Hebrew
- Leumi card: fully clickable, hover state, active style
- All other 5 cards: grayed out, "בקרוב" / "Coming soon" badge, not clickable
- On click Leumi → navigate to `/onboarding/export?bank=leumi`

**Bank logos:** Use placeholder text/emoji for now if logo files don't exist yet. Structure for easy logo swap later.

**Done when:**
- [ ] Screen renders with 6 bank cards
- [ ] Leumi card is clickable and navigates correctly
- [ ] Other cards are visually disabled
- [ ] Layout works in both RTL (Hebrew) and LTR (English)

---

### TASK 007 — Export guide screen ☐

**Depends on:** TASK 006

**Route:** `/onboarding/export?bank=leumi`

**Build:** `src/app/onboarding/export/page.tsx`
**Build:** `src/lib/bank-guides/leumi.ts` — export guide content (steps array)

**Guide content for Leumi:**
```typescript
export const leumiGuide = {
  bank: 'leumi',
  steps: [
    {
      step: 1,
      he: 'היכנס לאתר bankleumi.co.il',
      en: 'Go to bankleumi.co.il and log in',
      icon: '🌐'
    },
    {
      step: 2,
      he: 'לחץ על "חשבונות" ובחר את החשבון שלך',
      en: 'Click "Accounts" and select your account',
      icon: '🏦'
    },
    {
      step: 3,
      he: 'לחץ על "תנועות בחשבון"',
      en: 'Click "Account movements"',
      icon: '📋'
    },
    {
      step: 4,
      he: 'בחר טווח תאריכים — 3 חודשים אחרונים מומלץ',
      en: 'Select date range — last 3 months recommended',
      icon: '📅'
    },
    {
      step: 5,
      he: 'לחץ על אייקון האקסל (⬇) בתחתית הרשימה',
      en: 'Click the Excel icon (⬇) at the bottom of the list',
      icon: '⬇️'
    }
  ]
}
```

**UI:**
- Progress indicator: Step 2 of 3 (or similar)
- Numbered step list, each with icon + text
- Prominent CTA at bottom: "הורדתי את הקובץ ←" / "I downloaded my file →"
- On click CTA → navigate to `/onboarding/upload?bank=leumi`

**Done when:**
- [ ] Steps render correctly in both languages
- [ ] CTA navigates to upload screen
- [ ] Layout is clean, no visual clutter

---

### TASK 008 — File upload component ☐

**Depends on:** TASK 007

**Route:** `/onboarding/upload?bank=leumi`

**Build:**
- `src/app/onboarding/upload/page.tsx`
- `src/components/FileUploader.tsx` — reusable upload component (also used later in dashboard)

**FileUploader component:**
- Uses `react-dropzone`
- Accepts: `.xls`, `.xlsx`, `.csv`
- Max file size: 10MB
- States:
  - Idle: large dashed zone with icon + "גרור לכאן או לחץ לבחור קובץ" / "Drag here or click to browse"
  - File selected: show filename + file size + "Upload and analyze" / "העלה וְנַתֵּחַ" button
  - Uploading: spinner + "מנתח..." / "Analyzing..."
  - Success: checkmark + "X transactions found" → auto-navigate to `/dashboard`
  - Error: red alert + specific error message + "Try again" button

**API call on upload:**
- POST `/api/upload` with FormData containing: `file`, `bank` (query param from URL)
- Handle all error states from CDC Section 8

**Done when:**
- [ ] Drag & drop works
- [ ] Click to browse works
- [ ] File type validation works (rejects .pdf, .txt, etc.)
- [ ] File size validation works
- [ ] Loading state shows during upload
- [ ] Error messages display correctly

---

### TASK 009 — Leumi Excel parser ☐

**Depends on:** TASK 008

**Build:**
- `src/lib/parsers/leumi.ts` — parser for Leumi .xls/.xlsx
- `src/lib/parsers/index.ts` — router: `parseFile(file, bank)` → calls correct parser

> ⚠️ IMPORTANT: Before writing this parser, Raphaël must provide a real Leumi .xls export file.
> The parser must be built against the actual file format, not assumed column names.
> Upload the file to Claude Code in the session and say: "Build the parser against this file."

**Parser logic (`leumi.ts`):**
```typescript
// Expected columns (verify against real file):
// תאריך | תיאור | חובה | זכות | יתרה
// date  | desc  | debit | credit | balance

export function parseLeumi(buffer: ArrayBuffer): ParsedTransaction[] {
  // Use xlsx.read(buffer, { type: 'array' })
  // Find the correct sheet (usually first sheet)
  // Find header row (skip intro rows)
  // Map each data row to ParsedTransaction
  // Skip empty rows
  // Return array
}
```

**Normalized output (all parsers must return this):**
```typescript
interface ParsedTransaction {
  date: string        // YYYY-MM-DD
  amount: number      // negative = expense, positive = income
  description: string
  currency: string    // 'ILS'
}
```

**`raw_id` generation** (deduplication key):
```typescript
import { createHash } from 'crypto'
const raw_id = createHash('md5')
  .update(`${userId}|${date}|${amount}|${description}`)
  .digest('hex')
```

**Done when:**
- [ ] Parser tested against a real Leumi export file
- [ ] Returns correct number of transactions
- [ ] Amounts: debits are negative, credits are positive
- [ ] Dates parsed to YYYY-MM-DD format
- [ ] Empty/header rows skipped
- [ ] `raw_id` generated correctly

---

### TASK 010 — Auto-categorization engine ☐

**Depends on:** TASK 009

**Build:**
- `src/lib/categorization/rules.ts` — keyword rules + merchant seed data
- `src/lib/categorization/engine.ts` — categorization logic

**Priority order (from CDC Section 6.3):**
1. Check `merchant_preferences` table for this user + merchant
2. Check merchant seed lookup table (exact match on cleaned merchant name)
3. Check keyword rules on description
4. Fallback: "אחר / Other" category

**Merchant name cleaning:**
```typescript
function cleanMerchantName(description: string): string {
  // Remove transaction numbers, dates, amounts from description
  // Lowercase, trim
  // Examples: "SHUFERSAL DEAL 1234" → "shufersal deal"
  // "מקדונלד ירושלים 05/03" → "מקדונלד ירושלים"
}
```

**Seed rules** (from CDC Section 6.3 — expand as needed):
```typescript
const MERCHANT_RULES: { keywords: string[], categoryName: string }[] = [
  { keywords: ['שופרסל', 'shufersal', 'ויקטורי', 'רמי לוי', 'מגה', 'יינות'], categoryName: 'מזון וסופר' },
  { keywords: ['מקדונלד', 'ארומה', 'aroma', 'קפה', 'cafe', 'coffee', 'פיצה', 'pizza'], categoryName: 'מסעדות' },
  { keywords: ['פז', 'סונול', 'דלק', 'paz', 'sonol', 'רב קו', 'rav kav', 'אגד', 'egged', 'מטרו'], categoryName: 'תחבורה' },
  { keywords: ['סלקום', 'cellcom', 'הוט', 'hot', 'פרטנר', 'partner', '012', 'בזק', 'bezeq'], categoryName: 'חשבונות' },
  { keywords: ['מכבי', 'maccabi', 'כללית', 'clalit', 'מאוחדת', 'meuhedet', 'בית מרקחת', 'pharmacy', 'סופר פארם'], categoryName: 'בריאות' },
  { keywords: ['משכורת', 'שכר', 'salary', 'wage', 'payroll'], categoryName: 'משכורת' },
]
```

**Done when:**
- [ ] Function `categorize(description, userId)` returns a category ID
- [ ] Test with 10 sample descriptions — at least 7 correctly categorized
- [ ] Fallback to "אחר" works when no match found

---

### TASK 011 — Upload API route ☐

**Depends on:** TASK 009 + TASK 010

**Build:** `src/app/api/upload/route.ts`

**Logic:**
```
POST /api/upload
  1. Authenticate user (Supabase session)
  2. Get bank name from query param (?bank=leumi)
  3. Parse FormData → get file buffer
  4. Validate file type and size
  5. Call parseFile(buffer, bank) → ParsedTransaction[]
  6. If 0 transactions → return error
  7. Create upload record in DB
  8. For each transaction:
     a. Generate raw_id
     b. Clean merchant name
     c. Get category (auto-categorization)
     d. Upsert into transactions (skip if raw_id already exists for this user)
  9. Update upload record with transaction_count, period_start, period_end
  10. Trigger insight generation (async — don't wait for it)
  11. Update users.onboarding_done = true
  12. Return: { uploadId, transactionCount, newTransactions, duplicatesSkipped }
```

**Done when:**
- [ ] Successful upload creates records in `uploads` and `transactions` tables
- [ ] Duplicate transactions skipped (re-uploading same file = no duplicates)
- [ ] File type validation returns 400 for wrong type
- [ ] Auth check returns 401 for unauthenticated requests

---

## PHASE 3 — Dashboard

**Goal:** User sees their financial data after upload.

---

### TASK 012 — Dashboard layout + routing ☐

**Depends on:** TASK 011

**Build:**
- `src/app/dashboard/page.tsx` — main page (Server Component, fetches initial data)
- `src/app/dashboard/layout.tsx` — layout with top nav
- `src/components/TopNav.tsx` — logo + language toggle + user avatar dropdown

**Top nav contents:**
- Left (RTL: right): Logo + app name (placeholder until name decided)
- Right (RTL: left): Language toggle (HE/EN text button) | Avatar → dropdown: Settings, Sign out

**Language toggle behavior:**
- On click: update `users.language` in DB + switch `next-intl` locale
- Page re-renders in new language immediately

**Done when:**
- [ ] Dashboard page renders at `/dashboard`
- [ ] Top nav visible with all elements
- [ ] Language toggle switches between Hebrew and English
- [ ] Sign out works

---

### TASK 013 — Summary cards ☐

**Depends on:** TASK 012

**Build:**
- `src/components/dashboard/SummaryCards.tsx`
- `src/app/api/dashboard/summary/route.ts`

**API route logic:**
```
GET /api/dashboard/summary?month=YYYY-MM

Current month income = SUM(amount) WHERE amount > 0 AND date BETWEEN first and last day of month
Current month expenses = SUM(ABS(amount)) WHERE amount < 0 AND same date range
Surplus = income - expenses
Previous month income + expenses (for comparison arrows)
```

**3 cards** (not 4 — see CDC Section 6.4: no "total balance" card):
- Income this month (₪ amount + vs last month arrow)
- Expenses this month (₪ amount + vs last month arrow)
- Surplus (₪ amount, green if positive, red if negative)

**Done when:**
- [ ] Cards render with correct values from DB
- [ ] Values update when month changes
- [ ] Empty state: "No data for this month" if 0 transactions

---

### TASK 014 — Category breakdown ☐

**Depends on:** TASK 013

**Build:**
- `src/components/dashboard/CategoryBreakdown.tsx`
- `src/app/api/dashboard/categories/route.ts`

**API route:** Returns expense categories for current month, sorted by amount DESC, with % of total.

**UI:** Horizontal bar chart (Recharts `BarChart`) or a list with visual bars.
Each row: icon + category name + ₪ amount + % of total expenses.
Click on row → opens transaction list filtered by category (slide-over).

**Done when:**
- [ ] Categories display with correct amounts
- [ ] Percentages calculated correctly (sum to 100%)
- [ ] Clicking a category opens filtered transaction view

---

### TASK 015 — Recent transactions list ☐

**Depends on:** TASK 013

**Build:**
- `src/components/dashboard/RecentTransactions.tsx`
- `src/app/api/transactions/route.ts` — paginated, filterable transaction list

**API route params:**
- `?limit=15&offset=0` — for dashboard (last 15)
- `?category=:id&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50&page=1` — for full list

**Dashboard UI (last 15 transactions):**
- Row: date | merchant name | category icon | amount
- Amount color: green for income, red for expense
- "See all" link → `/transactions`

**Freemium filter:** Server-side: free users only see transactions from last 30 days.

**Done when:**
- [ ] Last 15 transactions display correctly
- [ ] Income vs. expense color coding works
- [ ] Free tier date filter enforced server-side

---

### TASK 016 — Transaction detail slide-over + category edit ☐

**Depends on:** TASK 015

**Build:**
- `src/components/transactions/TransactionDetail.tsx` — Sheet component (shadcn `Sheet`)
- `src/app/api/transactions/[id]/route.ts` — PATCH endpoint

**Slide-over contents:**
- Merchant name (large)
- Amount + date
- Category picker: dropdown of all system categories + user's custom ones
- On category change: PATCH `/api/transactions/:id` → `{ category_id, is_manual_override: true }`
- Optional: "Always categorize [merchant] as [category]" checkbox → POST to `/api/merchant-preferences`

**Done when:**
- [ ] Clicking a transaction opens the slide-over
- [ ] Category can be changed
- [ ] Change persists on page refresh
- [ ] `is_manual_override = true` set correctly in DB

---

## PHASE 4 — AI Insights

**Goal:** User receives a real AI insight based on their data.

---

### TASK 017 — Claude API service ☐

**Depends on:** TASK 011

**Build:** `src/lib/claude/insights.ts`

**Function:** `generateInsight(userId: string): Promise<InsightResult | null>`

Logic:
1. Fetch user language + tier from DB
2. Fetch last 90 days transactions for user
3. Check eligibility:
   - Count transactions: if < 10 → return null
   - Premium: check if insight generated today → if yes → return null
   - Free: check if insight generated in last 7 days → if yes → return null
4. Calculate summary stats (income, expenses, surplus, top 3 categories, biggest expense)
5. Fetch last 3 insights content (to avoid repetition)
6. Build prompt (from CDC Section 7.1)
7. Call Claude API (`claude-haiku-4-5-20251001`, max_tokens: 400, temperature: 0.7)
8. Parse JSON response
9. On parse failure: retry once with temperature: 0
10. On second failure: return null (log error)
11. Store insight in `insights` table (both `he` and `en` versions)
12. Return the stored insight

**Done when:**
- [ ] Function generates a real insight from real transaction data
- [ ] Both Hebrew and English versions stored
- [ ] Eligibility check works (no double-generation same day)
- [ ] Prompt hard rules enforced (no financial product recommendations in output — verify manually)

---

### TASK 018 — Insight card on dashboard ☐

**Depends on:** TASK 017

**Build:**
- `src/components/dashboard/InsightCard.tsx`
- `src/app/api/insights/latest/route.ts`

**API route:** Returns most recent insight for user. Marks as `is_read = true` on fetch.

**Card UI:**
- Badge: "התובנה של היום" / "Today's insight" (or date if older)
- Observation text (1–2 sentences, in user's language)
- Separator line
- Action text (1 sentence)
- Subtle "Refresh" icon (triggers manual insight regeneration if eligible)

**Freemium locked state:**
- If free user has used their weekly quota: show blurred card + lock icon + "Upgrade for daily insights" CTA
- Blur via CSS `filter: blur(4px)` with overlay

**Done when:**
- [ ] Insight displays in correct language
- [ ] Free user sees locked state after weekly quota used
- [ ] "Refresh" button works (calls `POST /api/insights/generate`)
- [ ] Insight marked as read on view

---

### TASK 019 — Insight generation API route ☐

**Depends on:** TASK 017

**Build:** `src/app/api/insights/generate/route.ts`

```
POST /api/insights/generate

1. Authenticate user
2. Call generateInsight(userId)
3. Return: { insight } or { error: 'not_eligible', reason: '...' }
```

This route is called:
- Automatically after successful file upload (fire-and-forget from TASK 011)
- Manually when user clicks "Refresh" on dashboard

**Done when:**
- [ ] Calling the route generates an insight (when eligible)
- [ ] Returns correct error when not eligible (quota reached, not enough data)
- [ ] Unauthenticated requests return 401

---

## PHASE 5 — Freemium & Payments

**Goal:** Free/premium tiers enforced, Stripe subscription works end-to-end.

---

### TASK 020 — Freemium gating logic ☐

**Depends on:** TASK 015

**Build:**
- `src/lib/auth/tier.ts` — helper functions to check user tier
- Apply gating to all relevant API routes

**Helper functions:**
```typescript
async function getUserTier(userId: string): Promise<'free' | 'premium'>
async function canViewTransaction(userId: string, transactionDate: Date): Promise<boolean>
  // free: only last 30 days | premium: last 365 days
async function canGenerateInsight(userId: string): Promise<boolean>
  // free: no insight in last 7 days | premium: no insight today
```

**Apply to:**
- `GET /api/transactions` → filter by date based on tier
- `GET /api/insights` (history) → return 403 for free users
- `POST /api/insights/generate` → check quota
- `GET /api/dashboard/categories` → filter by date based on tier

**Done when:**
- [ ] Free user queries return only last 30 days of data
- [ ] Premium user queries return up to 365 days
- [ ] All tier checks run server-side
- [ ] A free user manually calling premium API routes gets correct rejection

---

### TASK 021 — Upgrade modal ☐

**Depends on:** TASK 020

**Build:** `src/components/payments/UpgradeModal.tsx`

**Modal content (from CDC Section 5.7):**
- Headline: "גישה מלאה" / "Unlock full access"
- Feature comparison table (4 rows)
- Price: ₪25/month
- CTA button: "התחל Premium" / "Start Premium" → calls `createCheckoutSession()`
- "Cancel anytime" sub-copy

**Trigger locations:**
- Blurred insight card on dashboard
- Insights history page (for free users)
- Transaction list when older data is requested

**Done when:**
- [ ] Modal opens from all 3 trigger points
- [ ] Feature table renders correctly
- [ ] CTA button calls Stripe checkout flow (built in TASK 022)

---

### TASK 022 — Stripe Checkout integration ☐

**Depends on:** TASK 021

**Setup:**
1. Create Stripe account (free). Get test API keys.
2. Create a Product + Price in Stripe Dashboard: ₪25/month recurring.
3. Fill in `.env.local` Stripe vars.

**Build:**
- `src/app/api/stripe/create-checkout-session/route.ts`
- `src/app/api/stripe/create-portal-session/route.ts`

**Checkout session params (from CDC Section 7.2):**
```typescript
{
  mode: 'subscription',
  line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
  customer_email: user.email,
  metadata: { user_id: user.id },
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
}
```

**On success URL:** Show a success toast on dashboard: "Welcome to Premium!" + dismiss.

**Done when:**
- [ ] Clicking "Start Premium" redirects to Stripe Checkout (test mode)
- [ ] Completing test payment redirects to `/dashboard?upgrade=success`
- [ ] Success toast appears
- [ ] "Manage subscription" in settings opens Stripe Customer Portal

---

### TASK 023 — Stripe webhook handler ☐

**Depends on:** TASK 022

**Build:** `src/app/api/webhooks/stripe/route.ts`

**Logic (from CDC Section 7.2):**
```
POST /api/webhooks/stripe
  1. Verify Stripe signature (reject if invalid)
  2. Switch on event.type:
     - checkout.session.completed:
         → upsert subscriptions table
         → set users.tier = 'premium'
     - customer.subscription.updated:
         → update subscriptions.status
         → if status becomes 'active' → users.tier = 'premium'
     - customer.subscription.deleted:
         → subscriptions.status = 'canceled'
         → users.tier = 'free'
     - invoice.payment_failed:
         → subscriptions.status = 'past_due'
  3. Return 200 OK
```

**Test with Stripe CLI:**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

**Done when:**
- [ ] Webhook receives events (200 response)
- [ ] Signature verification rejects unsigned requests
- [ ] `users.tier` updated to 'premium' after successful checkout event
- [ ] `users.tier` reverted to 'free' after subscription deleted event

---

## PHASE 6 — Settings & Polish

**Goal:** Product is complete, polished, and ready for real users.

---

### TASK 024 — Settings page ☐

**Depends on:** TASK 023

**Route:** `/settings`

**Build:** `src/app/settings/page.tsx`

**Sections (from CDC Section 5.6):**
1. Profile: name (editable via PATCH `/api/user/profile`), email (read-only), language toggle
2. Upload history: list of past uploads (date, bank, # transactions, period) — no delete for MVP
3. Subscription: show plan + renewal date + "Manage subscription" (Stripe portal) or upgrade CTA
4. Danger zone: "Delete my account" → confirmation dialog → DELETE `/api/user/account` → sign out

**Delete account API:**
```
DELETE /api/user/account
  1. Cancel Stripe subscription if active
  2. Delete user from Supabase Auth (cascades to all tables)
  3. Sign out
  4. Redirect to /
```

**Done when:**
- [ ] Profile name editable and saves
- [ ] Language toggle works
- [ ] Upload history shows all past uploads
- [ ] Stripe portal link works
- [ ] Account deletion works end-to-end

---

### TASK 025 — Full transactions page ☐

**Depends on:** TASK 015

**Route:** `/transactions`

**Build:** `src/app/transactions/page.tsx`

**Features:**
- Filter bar: date range picker | category dropdown
- Default: current month, all categories
- Table: date | merchant | category icon | amount
- 50 rows/page, pagination
- Click row → slide-over (reuse `TransactionDetail` from TASK 016)
- Freemium gate: free users see message when trying to filter to data > 30 days old

**Done when:**
- [ ] Transactions load with correct pagination
- [ ] Filters work (date range + category)
- [ ] Free tier date restriction enforced
- [ ] Click row opens slide-over

---

### TASK 026 — Insights history page ☐

**Depends on:** TASK 019

**Route:** `/insights`

**Build:** `src/app/insights/page.tsx`

**Free users:** Page renders `<UpgradeModal />` or a full-page paywall component. No insights visible.

**Premium users:**
- List of past insights, newest first
- Each card: date | observation | action
- Empty state: "No insights yet. Upload your bank file to get started."

**Done when:**
- [ ] Free users see paywall
- [ ] Premium users see all past insights
- [ ] Empty state renders when no insights

---

### TASK 027 — Error + empty states (all screens) ☐

**Depends on:** All previous tasks

**Audit every screen and ensure:**
- Empty state exists (no data case)
- Error state exists (API failure case)
- Loading state exists (fetching case)

**Screens to check:**
- [ ] Dashboard (no uploads yet)
- [ ] Dashboard (no transactions this month)
- [ ] Dashboard (insight not yet generated)
- [ ] Transactions list (no transactions for filter)
- [ ] Insights history (no insights)
- [ ] Upload flow (parse error)
- [ ] Upload flow (no transactions found in file)

**Build:** `src/components/ui/EmptyState.tsx` — reusable component with icon + title + description + optional CTA button.

---

### TASK 028 — PostHog event tracking ☐

**Depends on:** TASK 027

**Build:** `src/lib/analytics/posthog.ts` — PostHog client wrapper

**Events to track:**

| Event | Trigger | Properties |
|---|---|---|
| `user_signed_up` | After signup | `{ method: 'email' | 'google' }` |
| `bank_selected` | Bank selector click | `{ bank: 'leumi' }` |
| `file_uploaded` | Successful upload | `{ bank, transaction_count, new_transactions }` |
| `insight_viewed` | Insight card rendered | `{ tier, insight_age_days }` |
| `upgrade_modal_opened` | Modal trigger | `{ trigger_location }` |
| `upgrade_completed` | Stripe success URL | `{}` |
| `category_changed` | Manual category override | `{}` |

**Done when:**
- [ ] PostHog initialized
- [ ] All 7 events firing in PostHog Live Events tab
- [ ] No PII in event properties

---

### TASK 029 — Landing page (`/`) ☐

**Depends on:** TASK 028

**Route:** `/` (public, not protected)

**Build:** `src/app/page.tsx`

**Structure (from CDC CLAUDE.md):**
1. Hero: headline + sub-headline + CTA
2. Problem section: 3 questions your bank can't answer
3. How it works: 3 steps (upload → categorize → insight)
4. Security block: "Read-only access. We never see your bank credentials."
5. Pricing: Free vs Premium comparison table
6. Final CTA

**Copy (Hebrew + English):**
- Headline HE: "סוף סוף תבין לאן הכסף שלך הולך"
- Headline EN: "Finally understand where your money goes"
- Sub HE: "חבר את חשבון הבנק שלך. קבל תובנות אוטומטיות. דע מה לעשות עם מה שנשאר."
- Sub EN: "Upload your bank file. Get automatic AI insights. Know what to do with what's left."
- CTA: "נסה בחינם" / "Try free — no credit card"

**Done when:**
- [ ] Page renders cleanly in Hebrew (RTL) and English (LTR)
- [ ] CTA links to `/auth/signup`
- [ ] Pricing table matches current free/premium features
- [ ] Mobile responsive

---

## PHASE 7 — Launch

---

### TASK 030 — Production environment setup ☐

**Depends on:** TASK 029

**Steps:**
1. Create Vercel project → connect GitHub repo → deploy
2. Add all production environment variables to Vercel (Settings → Environment Variables)
3. Switch Supabase to production URL if using a separate project (or keep same for now)
4. Switch Stripe from test mode to live mode → get live keys → update Vercel env vars
5. Add Stripe live webhook: `https://[your-vercel-domain]/api/webhooks/stripe` → select all subscription events
6. Add PostHog production key
7. Update `NEXT_PUBLIC_APP_URL` to production URL

**Done when:**
- [ ] App deployed and accessible at production URL
- [ ] Signup + login works in production
- [ ] File upload works in production
- [ ] Stripe live checkout works (test with ₪25 real charge then immediately cancel)
- [ ] PostHog receiving events in production

---

### TASK 031 — Smoke test (pre-launch checklist) ☐

**Depends on:** TASK 030

Run this full user journey in production:

- [ ] Sign up with email → user created in DB
- [ ] Onboarding: select Leumi → see export guide → upload real Leumi file
- [ ] Dashboard loads with correct data (income, expenses, surplus)
- [ ] Categories display with correct amounts
- [ ] Recent transactions list populated
- [ ] Insight generates within 30 seconds of upload
- [ ] Language toggle switches between Hebrew and English correctly
- [ ] Upgrade to Premium via Stripe → tier updated to premium
- [ ] Premium insight (daily) works after upgrade
- [ ] Settings page: name edit, subscription management
- [ ] Sign out + sign back in → data still there
- [ ] Delete account → all data removed

**Only launch when all 13 checkboxes are ✅.**

---

## TASK STATUS SUMMARY

| Task | Phase | Description | Status |
|---|---|---|---|
| 001 | 1 | Initialize Next.js project | ✅ |
| 002 | 1 | Supabase DB schema | ✅ |
| 003 | 1 | Auth setup | ✅ |
| 004 | 1 | Protected route middleware | ✅ |
| 005 | 2 | i18n setup | ✅ |
| 006 | 2 | Bank selector screen | ☐ |
| 007 | 2 | Export guide screen | ☐ |
| 008 | 2 | File upload component | ☐ |
| 009 | 2 | Leumi Excel parser | ☐ |
| 010 | 2 | Auto-categorization engine | ☐ |
| 011 | 2 | Upload API route | ☐ |
| 012 | 3 | Dashboard layout + nav | ☐ |
| 013 | 3 | Summary cards | ☐ |
| 014 | 3 | Category breakdown | ☐ |
| 015 | 3 | Recent transactions list | ☐ |
| 016 | 3 | Transaction detail slide-over | ☐ |
| 017 | 4 | Claude API service | ☐ |
| 018 | 4 | Insight card on dashboard | ☐ |
| 019 | 4 | Insight generation API | ☐ |
| 020 | 5 | Freemium gating logic | ☐ |
| 021 | 5 | Upgrade modal | ☐ |
| 022 | 5 | Stripe Checkout | ☐ |
| 023 | 5 | Stripe webhook | ☐ |
| 024 | 6 | Settings page | ☐ |
| 025 | 6 | Full transactions page | ☐ |
| 026 | 6 | Insights history page | ☐ |
| 027 | 6 | Error + empty states | ☐ |
| 028 | 6 | PostHog tracking | ☐ |
| 029 | 6 | Landing page | ☐ |
| 030 | 7 | Production setup | ☐ |
| 031 | 7 | Smoke test | ☐ |

**Total: 31 tasks across 7 phases.**

---

*Reference spec: `IsraelFinanceApp_CDC_v3.md`*
*Questions on scope: ask Raphaël before implementing.*
