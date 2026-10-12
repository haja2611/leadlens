import express from "express";
import cors from "cors";
import { mkdirSync, existsSync } from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";
import swaggerUi from "swagger-ui-express";
import { CATEGORIES, CITIES, COUNTRIES } from "./config/categories.js";
import { loadOrScrape } from "./services/scraper.js";
import { normalizeRow, deduplicate, scoreLead } from "./services/qualify.js";
import { get, set, del } from "./services/cache.js";
import { swaggerSpec } from "./swagger.js";

// ─── Bootstrap required directories on startup ───────────────────────────────
const ROOT = path.resolve("..");
const GMAPS_DIR = path.join(ROOT, "gmapsdata");
if (!existsSync(GMAPS_DIR)) {
  mkdirSync(GMAPS_DIR, { recursive: true });
  console.log(`[init] Created gmapsdata/ at ${GMAPS_DIR}`);
}

const app = express();
app.use(cors());
app.use(express.json());

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));

// ─── GET /api/meta ────────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/meta:
 *   get:
 *     summary: Return all valid categories, cities and countries
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: Categories + cities list for UI dropdowns
 */
app.get("/api/meta", (_req, res) => {
  const categories = Object.entries(CATEGORIES).map(([key, c]) => ({
    key,
    label: c.label,
  }));
  const cities = Object.entries(CITIES).map(([key, c]) => ({
    key,
    label: c.label,
    country: c.country,
  }));
  const countries = Object.entries(COUNTRIES).map(([code, c]) => ({
    code,
    label: c.label,
    flag: c.flag,
  }));
  res.json({ categories, cities, countries });
});

// ─── GET /api/leads ───────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/leads:
 *   get:
 *     summary: Search and score leads for a category + city
 *     tags: [Leads]
 *     parameters:
 *       - in: query
 *         name: category
 *         required: true
 *         schema: { type: string, example: software }
 *       - in: query
 *         name: city
 *         required: true
 *         schema: { type: string, example: chennai }
 *       - in: query
 *         name: refresh
 *         schema: { type: boolean }
 *         description: Set true to bust cache and re-scrape
 *     responses:
 *       200:
 *         description: Scored leads with summary counts
 *       400:
 *         description: Unknown category or city
 */
app.get("/api/leads", (req, res) => {
  const { category = "software", city = "chennai", refresh } = req.query;

  if (!CATEGORIES[category] || !CITIES[city]) {
    return res.status(400).json({ error: "Unknown category or city" });
  }

  const cacheKey = `${category}:${city}`;
  const forceRescrape = refresh === "true";

  if (forceRescrape) del(cacheKey); // evict in-memory Map entry only — CSV untouched

  let leads = get(cacheKey);

  if (!leads) {
    try {
      const raw        = loadOrScrape(category, city, forceRescrape); // merge-on-rescrape
      const normalized = raw.map(normalizeRow);
      const deduped = deduplicate(normalized);
      leads = deduped
        .map((l) => scoreLead(l, category, city))
        .sort((a, b) => b.score - a.score);
      set(cacheKey, leads);
    } catch (err) {
      console.error("[scrape error]", err.message);
      return res.status(500).json({ error: "Scrape failed", detail: err.message });
    }
  }

  const summary = {
    total: leads.length,
    qualified: leads.filter((l) => l.tier === "qualified").length,
    review: leads.filter((l) => l.tier === "review").length,
    disqualified: leads.filter((l) => l.tier === "disqualified").length,
  };

  res.json({
    category: CATEGORIES[category].label,
    city: CITIES[city].label,
    country: COUNTRIES[CITIES[city].country]?.label,
    summary,
    leads,
  });
});

// ─── GET /api/leads/export ────────────────────────────────────────────────────
/**
 * @openapi
 * /api/leads/export:
 *   get:
 *     summary: Export current leads as a CSV file
 *     tags: [Leads]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, example: software }
 *       - in: query
 *         name: city
 *         schema: { type: string, example: chennai }
 *       - in: query
 *         name: tier
 *         schema: { type: string, enum: [all, qualified, review, disqualified] }
 *     responses:
 *       200:
 *         description: CSV file download
 */
app.get("/api/leads/export", (req, res) => {
  const { category = "software", city = "chennai", tier = "all" } = req.query;
  let leads = get(`${category}:${city}`) || [];
  if (tier !== "all") leads = leads.filter((l) => l.tier === tier);

  const csv = stringify(
    leads.map((l) => ({
      Company: l.name,
      Category: l.category,
      City: l.city,
      Country: COUNTRIES[CITIES[city]?.country]?.label || "",
      Website: l.website || "",
      Phone: l.phone || "",
      Email: l.email || "",
      Rating: l.rating,
      Reviews: l.reviewCount,
      Score: l.score,
      Tier: l.tier,
      Reasons: l.reasons.join("; "),
      Flags: l.flags.join("; "),
      Source: l.sourceUrl || "",
    })),
    { header: true }
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${category}-${city}${tier !== "all" ? `-${tier}` : ""}.csv"`
  );
  res.send(csv);
});

// ─── Health check ─────────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: OK
 */
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString() })
);

app.listen(4000, () => {
  console.log("LeadLens API on :4000");
  console.log("Swagger UI  → http://localhost:4000/api/docs");
});