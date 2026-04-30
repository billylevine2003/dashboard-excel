# dashboard-excel

A browser-based claims analytics dashboard built with **React + Vite + TypeScript**.  
Upload an Excel (`.xlsx`) or CSV file and instantly see KPI cards, interactive charts, pivot tables, and a filterable data table — no backend required.

---

## Quick Start (fresh clone)

### 1. Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | **18** (LTS recommended) | `node -v` |
| npm | **9** | `npm -v` |

> **Tip — managing Node versions:** If you have multiple Node versions installed, use [nvm](https://github.com/nvm-sh/nvm):
> ```bash
> nvm install 20
> nvm use 20
> ```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

The app opens automatically at **http://localhost:3000** (or the next available port).  
Hot-reload is enabled — saving a file instantly updates the browser.

### 4. Build for production

```bash
npm run build
```

The compiled output lands in `dist/`. Preview it locally with:

```bash
npm run preview
```

### 5. Lint the code

```bash
npm run lint
```

---

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server (port 3000, auto-opens browser) |
| `npm run build` | Type-check + compile to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint across all source files |

---

## Loading data into the dashboard

### Option A — Upload your Excel or CSV file (recommended)

1. Open the app and click **Upload Panel** in the left sidebar.
2. Choose your `.xlsx` (Excel) or `.csv` file under **Main Claims File**.
3. KPI cards, charts, and tables populate automatically.

**Expected columns** (column names are matched case-insensitively):

| Column | Purpose |
|--------|---------|
| `Claim Number` | Unique claim identifier (used for deduplication) |
| `Claim Status` | `Open` or `Closed` |
| `Claim Reported Date` | ISO date string (`YYYY-MM-DD`) or Excel date serial |
| `Direct Loss Paid ITD` | Numeric — cumulative loss paid |
| `Direct Loss Reserve Outstanding` | Numeric — outstanding reserve |
| `Adjuster` | Adjuster code / name (used in filters) |
| `Peril Description` | Peril type (used in filters) |
| `Cause of Loss` | Loss cause (used in filters) |

The app automatically derives `Claim Age (Days)`, `Claim Age Category`, and `Claim Reported Month-Year` from `Claim Reported Date`.

### Option B — Try with the included sample CSV

A ready-to-use sample file is included at [`public/sample-data.csv`](public/sample-data.csv).

1. Run `npm run dev`.
2. Open **Upload Panel** → **Main Claims File**.
3. Select `public/sample-data.csv` from your local clone.

---

## Environment variables (optional)

The AI Adjuster Summary feature can call the OpenAI API if you supply a key.  
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_OPENAI_API_KEY` | No | — | OpenAI API key. If omitted, the app uses a built-in local summary. |
| `VITE_OPENAI_MODEL` | No | `gpt-4o-mini` | Model name to use |
| `VITE_OPENAI_API_URL` | No | OpenAI Chat Completions endpoint | Override the API endpoint |

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm install` fails with `ENOENT` or `node: not found` | Install Node.js ≥ 18 from https://nodejs.org |
| Port 3000 is already in use | Run `npm run dev -- --port 3001` or kill the process occupying 3000 |
| `vite: command not found` | Run `npm install` first; Vite is a local dev dependency |
| TypeScript errors on build | Run `npm install` to ensure all `@types/*` packages are present |
| Blank screen after upload | Check the browser console (F12) for parse errors; verify the file is `.xlsx` or `.csv` |
| Charts show no data | Ensure your file contains a `Claim Reported Date` column so Month-Year grouping works |

---

## Project structure

```
dashboard-excel/
├── public/
│   └── sample-data.csv      # Sample claims data for testing
├── src/
│   ├── components/          # React UI components
│   │   ├── Charts.tsx        # Recharts bar/line charts
│   │   ├── DataTable.tsx     # Filterable data table
│   │   ├── FileUpload.tsx    # Excel/CSV upload panel
│   │   ├── KeyMetrics.tsx    # KPI cards (open/closed/total)
│   │   ├── LeftPanel.tsx     # Sidebar filters
│   │   ├── MatrixReport.tsx  # Matrix drilldown report
│   │   ├── PivotTable.tsx    # Pivot table view
│   │   └── ...
│   ├── config/
│   │   └── closability-config.json
│   ├── App.tsx              # Root component + Excel parsing logic
│   ├── App.css              # App styles
│   └── main.tsx             # React entry point
├── .env.example             # Example environment variables
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Tech stack

| Library | Version | Role |
|---------|---------|------|
| [React](https://react.dev) | 18 | UI framework |
| [Vite](https://vitejs.dev) | 5 | Dev server & bundler |
| [TypeScript](https://www.typescriptlang.org) | 5 | Type safety |
| [Recharts](https://recharts.org) | 2 | Charts |
| [xlsx](https://sheetjs.com) | 0.18 | Excel/CSV parsing |
