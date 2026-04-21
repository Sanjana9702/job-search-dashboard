# Job Search Dashboard

A personal job search tracker that replaces spreadsheets and sticky notes. Log applications, track status through a Kanban board, sync rejection and confirmation emails from Gmail automatically, and export your pipeline to CSV.

**Live app:** [job-search-dashboard-chi.vercel.app](https://job-search-dashboard-chi.vercel.app)

---

## Features

- **Kanban & Table views** — drag cards between stages or manage a sortable table
- **Gmail sync** — automatically detects application confirmations and rejections from your inbox using Claude AI
- **Google Sign-In** — multi-user auth; each user only sees their own data
- **Date filter** — filter by preset ranges (last 7 days, 30 days, 3 months, etc.) or a custom date range
- **Contact tracking** — log recruiter/hiring manager outreach per application
- **Timeline** — auto-generated status history for each application
- **Follow-up dates** — automatically calculated based on status, highlighted when overdue
- **Export to CSV** — exports the current filtered view, ready for Excel or Google Sheets
- **Search** — filter by company or role across both views

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| ORM | Prisma v5 |
| Auth | NextAuth v4 (Google provider) |
| AI | Claude Haiku (Anthropic) — email parsing |
| Email | Gmail API (gmail.readonly scope) |
| Drag & Drop | @dnd-kit |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google Cloud Console](https://console.cloud.google.com) project with OAuth 2.0 credentials
- A [Neon](https://neon.tech) Postgres database
- An [Anthropic API key](https://console.anthropic.com)

### 1. Clone the repo

```bash
git clone https://github.com/Sanjana9702/job-search-dashboard.git
cd job-search-dashboard
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the root:

```env
# Neon Postgres
DATABASE_URL="postgresql://..."         # pooled connection string
DIRECT_URL="postgresql://..."           # direct (unpooled) connection string

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Anthropic
ANTHROPIC_API_KEY=your_api_key

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret            # generate with: openssl rand -base64 32
```

### 3. Configure Google Cloud Console

In your OAuth 2.0 client, add these **Authorized redirect URIs**:

```
http://localhost:3000/api/auth/callback/google   ← NextAuth sign-in
http://localhost:3000/api/auth/google/callback   ← Gmail sync
```

Enable the **Gmail API** in APIs & Services.

### 4. Run the database migration

```bash
npx prisma migrate dev --name init
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

1. Push to GitHub — Vercel auto-deploys on every push to `main`
2. Add all environment variables from `.env.local` to **Vercel → Settings → Environment Variables**, updating:
   - `NEXTAUTH_URL` → `https://your-app.vercel.app`
   - `GOOGLE_REDIRECT_URI` → `https://your-app.vercel.app/api/auth/google/callback`
3. Add production redirect URIs to Google Cloud Console:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   https://your-app.vercel.app/api/auth/google/callback
   ```
4. Run the migration against your Neon database:
   ```bash
   npx prisma migrate deploy
   ```

---

## How Gmail Sync Works

1. Connect Gmail via **Connect Gmail** — authorises read-only access to your inbox
2. Click **Sync Gmail** — scans your inbox for job-related emails using three search strategies:
   - Known ATS senders (Greenhouse, Lever, Workday, etc.)
   - Subject line patterns ("application received", "thank you for applying", etc.)
   - Rejection language in the email body
3. Each email is parsed by Claude Haiku to extract company name, role, and status
4. New applications are created automatically; existing ones are updated if the status has progressed
5. A company-name fallback match handles cases where the role differs between confirmation and rejection emails

---

## Project Structure

```
app/
  api/
    applications/        # CRUD for job applications
    contacts/            # Contact management per application
    auth/                # NextAuth + Google OAuth + Gmail token
    gmail/sync/          # Gmail ingestion + Claude parsing
  signin/                # Sign-in page
  page.tsx               # Dashboard (table/kanban + filters)
components/
  dashboard/
    Header.tsx           # Nav, stats, search, date filter, actions
    DateFilter.tsx       # Date range picker with presets
    KanbanView.tsx       # Drag-and-drop kanban board
    TableView.tsx        # Sortable table
    ApplicationDrawer.tsx  # Side panel: details, timeline, contacts
    UserMenu.tsx         # Avatar + sign-out dropdown
lib/
  auth.ts                # NextAuth config
  prisma.ts              # Prisma client singleton
  session.ts             # Server-side auth helper
prisma/
  schema.prisma          # DB schema (User, Application, Contact, Timeline, OAuthToken)
```

---

## Application Statuses

Applications move **forward only** through these stages:

`Applied` → `Networking` → `Phone Screen` → `Interview` → `Offer`

`Rejected` and `Withdrawn` are terminal statuses reachable from any stage.
