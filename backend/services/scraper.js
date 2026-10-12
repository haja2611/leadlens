import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync, spawnSync } from "child_process";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import path from "path";
import { CATEGORIES, CITIES } from "../config/categories.js";

const ROOT      = path.resolve("..");
const DATA_DIR  = path.join(ROOT, "gmapsdata");
const CACHE_DIR = path.join(ROOT, "backend", "data", "cache");
const SCRAPER_IMAGE = "gosom/google-maps-scraper";

mkdirSync(DATA_DIR,  { recursive: true });   // auto-create on startup
mkdirSync(CACHE_DIR, { recursive: true });

/**
 * Checks if the scraper Docker image exists locally.
 * If not, pulls it automatically (one-time, ~500 MB download).
 * Subsequent starts are instant — docker inspect is O(1).
 */
function ensureScraperImage() {
  // docker image inspect exits 0 if found, non-zero if missing
  const check = spawnSync("docker", ["image", "inspect", SCRAPER_IMAGE], {
    stdio: "ignore",
  });
  if (check.status === 0) return; // already present

  console.log(`[scraper] Image '${SCRAPER_IMAGE}' not found locally — pulling now…`);
  console.log("[scraper] This is a one-time download (~500 MB). Please wait.");
  try {
    execSync(`docker pull ${SCRAPER_IMAGE}`, { stdio: "inherit" });
    console.log(`[scraper] Pull complete ✓`);
  } catch (err) {
    throw new Error(
      `[scraper] Failed to pull '${SCRAPER_IMAGE}'. ` +
      `Make sure Docker Desktop is running and you have internet access.\n${err.message}`
    );
  }
}

let imageReady = false; // pulled at most once per process lifetime

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ─── Internal: run Docker scraper, return raw rows ───────────────────────────
function runScraper(config, city, cacheKey) {
  // Auto-pull the image if not present (once per process)
  if (!imageReady) {
    ensureScraperImage();
    imageReady = true;
  }

  const inputPath  = path.join(DATA_DIR, `${cacheKey}-input.txt`);
  const outputPath = path.join(DATA_DIR, `${cacheKey}-out.csv`);

  const lines = config.searchTerms.map(term => `${term} in ${city.label}`);
  writeFileSync(inputPath, lines.join("\n") + "\n");

  // When running inside docker (container has container hostname), inherit volumes from itself.
  // Otherwise, mount DATA_DIR from host filesystem.
  const isInsideContainer = existsSync("/.dockerenv") || process.env.CONTAINER_NAME;
  const volumeArgs = isInsideContainer
    ? ["--volumes-from", process.env.CONTAINER_NAME || "leadlens-backend"]
    : ["-v", `${DATA_DIR}:/gmapsdata`];

  // Use spawnSync so stderr is captured → useful error message on failure
  const result = spawnSync("docker", [
    "run", "--rm",
    ...volumeArgs,
    SCRAPER_IMAGE,
    "-input",  `/gmapsdata/${cacheKey}-input.txt`,
    "-results", `/gmapsdata/${cacheKey}-out.csv`,
    "-exit-on-inactivity", "3m",
  ], { stdio: ["ignore", "inherit", "pipe"] }); // stderr captured, stdout streamed

  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim() || "(no stderr output)";
    throw new Error(
      `Docker scraper exited with code ${result.status}.\n` +
      `Stderr: ${stderr}\n` +
      `Common causes:\n` +
      `  • Docker Desktop is not running\n` +
      `  • Network/CAPTCHA issue from Google\n` +
      `  • Image '${SCRAPER_IMAGE}' not found (try: docker pull ${SCRAPER_IMAGE})`
    );
  }

  if (!existsSync(outputPath)) {
    throw new Error(
      `Scraper ran but produced no output file: ${outputPath}\n` +
      `The search may have returned 0 results.`
    );
  }

  return parse(readFileSync(outputPath, "utf8"), { columns: true, skip_empty_lines: true });
}

// ─── Internal: deduplicate raw CSV rows by place_id → name+phone → name ─────
// (lightweight dedup at the raw-row level before normalisation)
function dedupeRaw(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key =
      row.place_id                     ? `pid:${row.place_id}` :
      (row.title && row.phone)         ? `np:${row.title.toLowerCase().replace(/\s+/g,"")}:${(row.phone||"").replace(/\D/g,"")}` :
                                         `n:${(row.title||"").toLowerCase().replace(/\s+/g,"")}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values());
}

/**
 * loadOrScrape(categoryKey, cityKey, forceRescrape)
 *
 * forceRescrape = false (default)
 *   → Checks backend/data/cache/<slug>.csv first.
 *     If CSV exists → parse and return (no Docker).
 *     If CSV missing → scrape → save CSV → return rows.
 *
 * forceRescrape = true  (?refresh=true from the API)
 *   → Runs Docker scraper to fetch fresh data from Google.
 *   → Merges fresh rows WITH existing CSV rows (if CSV exists).
 *   → Deduplicates the merged set.
 *   → Writes merged result back to CSV.
 *   → Returns merged rows.
 *   → The CSV is NEVER deleted — only ever grows or stays the same.
 */
export function loadOrScrape(categoryKey, cityKey, forceRescrape = false) {
  const config   = CATEGORIES[categoryKey];
  const city     = CITIES[cityKey];
  const cacheKey = `${slug(categoryKey)}-${slug(cityKey)}`;
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.csv`);

  // ── Normal path: serve from CSV if it exists ─────────────────────────────
  if (!forceRescrape && existsSync(cachePath)) {
    return parse(readFileSync(cachePath, "utf8"), { columns: true, skip_empty_lines: true });
  }

  // ── Scrape fresh data from Google Maps ───────────────────────────────────
  const freshRows = runScraper(config, city, cacheKey);

  if (!forceRescrape) {
    // First-ever scrape — just save and return
    writeFileSync(cachePath, stringify(freshRows, { header: true }));
    return freshRows;
  }

  // ── Merge fresh rows with existing CSV (preserve old records) ────────────
  const existingRows = existsSync(cachePath)
    ? parse(readFileSync(cachePath, "utf8"), { columns: true, skip_empty_lines: true })
    : [];

  // Put fresh rows first so they "win" on merge (newer data preferred)
  const merged = dedupeRaw([...freshRows, ...existingRows]);

  // Count how many genuinely new records arrived
  const newCount = merged.length - existingRows.length;
  if (newCount > 0) {
    console.log(`[scraper] Merged ${newCount} new record(s) into ${cachePath}`);
    writeFileSync(cachePath, stringify(merged, { header: true }));
  } else {
    console.log(`[scraper] No new records found — CSV unchanged`);
    // CSV is NOT written: same data → no modification
  }

  return merged;
}