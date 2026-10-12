# LeadLens

> Intelligent lead-generation tool that scrapes Google Maps, deduplicates, scores, and ranks business leads for cold-calling — built for Caprae Capital's AI-Readiness pre-screening challenge.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Country + City typeahead** | Select country → type any city name → autocomplete suggestions |
| **Config-driven scoring** | All category logic lives in `config/categories.js` — zero hardcoding |
| **Explainable decisions** | Every lead has `reasons[]` (green chips) and `flags[]` (red chips) |
| **Tier filtering** | Qualified / Review / Disqualified tabs with live counts |
| **Name search** | Filter visible leads by company name in real time |
| **CSV export** | Export current filtered tier as a spreadsheet |
| **Cache refresh** | ↺ button busts the 24-hour in-memory cache and re-scrapes |
| **Swagger UI** | Interactive API docs at `/api/docs` |
| **Docker Compose** | One-command deployment of the entire stack |

---

## 🏗 Architecture

```
leadlens/
├── backend/               # Node 20 + Express API
│   ├── config/
│   │   └── categories.js  # ← ALL category + city config lives here
│   ├── services/
│   │   ├── qualify.js     # Pure functions: normalizeRow, deduplicate, scoreLead
│   │   ├── scraper.js     # Invokes Docker scraper, caches CSV output
│   │   └── cache.js       # In-memory Map with 24h TTL
│   ├── tests/
│   │   └── leadlens.test.js  # Unit + integration tests (Jest + Supertest)
│   ├── server.js          # Express routes + Swagger mount
│   ├── swagger.js         # OpenAPI 3.0 spec (swagger-jsdoc)
│   └── Dockerfile
├── frontend/              # React 19 + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── CitySearch.jsx  # Country selector + city typeahead
│   │   │   ├── LeadCard.jsx    # Lead display + score bar + reason chips
│   │   │   └── StatsBar.jsx    # Tier filter tabs
│   │   ├── App.jsx             # Root component (loads /api/meta dynamically)
│   │   ├── api.js              # fetchMeta, fetchLeads, exportCsv
│   │   └── styles.css          # Custom CSS (no Tailwind), Google Fonts: Inter
│   ├── nginx.conf
│   └── Dockerfile
├── gmapsdata/             # Scraper I/O volume (auto-created on startup)
├── docker-compose.yml
└── .gitignore
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Why |
|-------------|-----|
| **Node.js 20+** | Runs the backend API and frontend dev server |
| **Docker Desktop** (running) | The scraper runs inside a Docker container |
| Internet access (first run only) | Backend auto-pulls `gosom/google-maps-scraper` (~500 MB) on the first search |

> **You do NOT need to pull the Docker image manually.**  
> The backend detects if it's missing and pulls it automatically the first time you click "Find Leads".

---

### Option A — Local Development (two terminals)

**Terminal 1 — Backend**

```bash
cd backend
npm install        # first time only
npm start          # production-like
# or: npm run dev  # hot-reload with --watch
```

Expected output:
```
LeadLens API on :4000
Swagger UI  → http://localhost:4000/api/docs
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm install        # first time only
npm run dev        # Vite dev server
```

Open **http://localhost:5173** in your browser.

**First search behaviour:**
1. You click "Find Leads"
2. Backend checks if `gosom/google-maps-scraper` is in Docker
3. If missing → auto-pulls it (one-time, ~500 MB, shows progress in Terminal 1)
4. Scraper runs, results appear in the UI
5. Results are cached as CSV — every subsequent request for the same category + city is instant

---

### Option B — Docker Compose (full stack, no Node needed)

> **Prerequisite:** Docker Desktop must be running (`docker ps`).

```bash
# Start everything (backend + frontend + shared volume)
docker compose up --build

# Stop and remove containers
docker compose down
```

> **Note on Docker-in-Docker scraping:**  
> The backend runs inside a container and spawns the `gosom/google-maps-scraper` container on demand. To allow this:
> - `docker-cli` is pre-installed in the backend container (`backend/Dockerfile`).
> - The host Docker socket (`/var/run/docker.sock`) is mounted into the backend container (`docker-compose.yml`).
>
> On Windows with Docker Desktop, ensure the Docker daemon is active before running. The scraper image will be pulled on demand by the host daemon upon first scrape.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Swagger UI | http://localhost:4000/api/docs |

---

## 🧪 Running Tests

```bash
cd backend
npm install
npm test
```

Tests cover:
- `normalizeRow` — CSV row parsing edge cases
- `deduplicate` — all 4 fingerprint priorities (placeId → cid → name+phone → name+geo → name)
- `scoreLead` — all scoring dimensions, tier assignment, negative/generic name detection
- HTTP endpoints — `/api/health`, `/api/meta`, `/api/leads` via Supertest

---

## 📡 API Reference

Interactive docs available at **http://localhost:4000/api/docs** (Swagger UI).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/meta` | GET | All categories, cities, countries |
| `/api/leads` | GET | Scrape + score leads (`?category=&city=&refresh=`) |
| `/api/leads/export` | GET | Download CSV (`?tier=qualified`) |

---

## ⚙ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend listen port |
| `VITE_API_URL` | `http://localhost:4000` | API base URL used by frontend |

Create `backend/.env` and `frontend/.env.local` as needed.

---

## 🔧 Extending Categories & Cities

All config is in [`backend/config/categories.js`](./backend/config/categories.js).

**Add a new city:**
```js
// In CITIES object:
toronto: { label: "Toronto", country: "CA", matchers: ["toronto"] },
```

**Add a new country:**
```js
// In COUNTRIES object:
CA: { label: "Canada", flag: "🇨🇦" },
```

**Add a new category:**
```js
// In CATEGORIES object:
realestate: {
  label: "Real Estate",
  searchTerms: ["real estate agencies", "property dealers"],
  matchedCategories: ["real estate agency", "property management"],
  genericNamePatterns: [/^real estate$/i],
  negativeNamePatterns: [/construction|builder/i],
},
```

No other files need to change. The scraper, scoring, and UI all pick it up automatically.

---

## 🐳 Scraper Notes

The scraper (`gosom/google-maps-scraper`) runs as an external Docker container invoked on-demand by [`services/scraper.js`](./backend/services/scraper.js).

### Image lifecycle

| When | What happens |
|------|-------------|
| **First search ever** | Backend checks `docker image inspect` → image missing → auto-pulls from Docker Hub (~500 MB, one-time) |
| **All subsequent searches** | Image already present → `docker inspect` is instant, no network needed |

### Data lifecycle

| Scenario | What happens |
|----------|-------------|
| **First search** for a category+city | Docker runs scraper → saves raw CSV to `gmapsdata/` → copies to `backend/data/cache/` → scores + serves |
| **Repeat search** (within 24h) | Served from in-memory Map (instant, zero I/O) |
| **After 24h or server restart** | Re-reads from CSV in `backend/data/cache/` (instant parse, no Docker) |
| **↺ Refresh button** (`?refresh=true`) | Evicts Map entry → runs Docker → **merges** fresh rows with existing CSV → deduplicates → writes back **only if new records found** → CSV is never deleted |
| **Same data from Google** | CSV untouched — merge produces no change, `writeFileSync` is skipped |

The `gmapsdata/` directory is automatically created at backend startup.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4, ESM |
| Caching | In-memory `Map` with 24h TTL |
| Storage | Flat CSV files (no database) |
| Scraper | `gosom/google-maps-scraper` (Docker) |
| Frontend | React 19, Vite 8 |
| Styling | Vanilla CSS, Google Fonts (Inter) |
| API Docs | Swagger UI (swagger-jsdoc + swagger-ui-express) |
| Testing | Jest 29, Supertest |
| Container | Docker, Docker Compose |

---

## 📋 Submission Notes (Caprae Capital)

This project was built in response to Caprae Capital's AI-Readiness Pre-Screening challenge.

**Design decisions:**
- **No database** — stateless in-memory cache + committed CSV files satisfy the cold-start demo requirement while keeping deployment dead-simple.
- **Config-driven** — adding a new city or category is a one-liner in `categories.js`. No code changes required anywhere else.
- **Explainability first** — every lead carries `reasons[]` and `flags[]` so a sales rep always knows *why* a lead was ranked the way it was.
- **Dedup before score** — merging duplicates before scoring prevents double-counting and gives the cleanest data to the scoring function.

