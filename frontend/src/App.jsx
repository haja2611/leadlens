import { useState, useEffect } from "react";
import "./styles.css";
import { fetchMeta, fetchLeads, exportCsv } from "./api";
import LeadCard from "./components/LeadCard";
import StatsBar from "./components/StatsBar";
import CitySearch from "./components/CitySearch";

export default function App() {
  // ── Meta (loaded once from /api/meta) ──────────────────────────────────────
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);

  useEffect(() => {
    fetchMeta()
      .then(setMeta)
      .catch(() => setMetaError("Cannot reach API. Is the backend running?"));
  }, []);

  // ── Selection state ────────────────────────────────────────────────────────
  const [category, setCategory] = useState("software");
  const [country, setCountry]   = useState("IN");
  const [city, setCity]         = useState("chennai");

  // ── Results state ──────────────────────────────────────────────────────────
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");

  // When country changes, default city to the first city in that country
  function handleCountry(code) {
    setCountry(code);
    const first = meta?.cities.find(c => c.country === code);
    if (first) setCity(first.key);
  }

  async function handleSearch(refresh = false) {
    if (!city) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLeads(category, city, refresh);
      setData(result);
      setFilter("all");
      setSearch("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const visible = (data?.leads || []).filter(
    (l) =>
      (filter === "all" || l.tier === filter) &&
      (search === "" || l.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="container">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <span className="header-icon">🔍</span>
          <h1>LeadLens</h1>
        </div>
        <p className="header-sub">
          Intelligent Lead Generation · Real businesses, ranked by relevance
        </p>
      </header>

      {/* ── Meta error ── */}
      {metaError && (
        <div className="error-banner" role="alert">⚠ {metaError}</div>
      )}

      {/* ── Search bar ── */}
      <div className="search-bar">
        {/* Category */}
        <select
          id="category-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Business category"
        >
          {(meta?.categories || [
            { key: "software", label: "Software & IT" },
            { key: "restaurant", label: "Food & Beverage" },
            { key: "hospital", label: "Healthcare" },
            { key: "hotel", label: "Hospitality" },
            { key: "education", label: "Education" },
          ]).map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        {/* Country + City typeahead */}
        {meta ? (
          <CitySearch
            countries={meta.countries}
            cities={meta.cities}
            country={country}
            city={city}
            onCountry={handleCountry}
            onCity={setCity}
          />
        ) : (
          <select disabled><option>Loading…</option></select>
        )}

        {/* Action buttons */}
        <div className="search-actions">
          <button
            id="find-leads-btn"
            className="btn btn-primary"
            onClick={() => handleSearch(false)}
            disabled={loading || !city}
          >
            {loading ? <span className="spinner" /> : "Find Leads"}
          </button>
          {data && (
            <>
              <button
                id="refresh-btn"
                className="btn btn-ghost"
                title="Re-scrape (clears cache)"
                onClick={() => handleSearch(true)}
                disabled={loading}
              >
                ↺
              </button>
              <button
                id="export-btn"
                className="btn btn-secondary"
                onClick={() => exportCsv(category, city, filter)}
              >
                ⬇ Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Error state ── */}
      {error && !loading && (
        <div className="error-banner" role="alert">⚠ {error}</div>
      )}

      {/* ── Loading skeletons ── */}
      {loading && (
        <div aria-live="polite" aria-label="Loading leads">
          {[1,2,3].map(i => (
            <div key={i} className="skeleton">
              <div className="skeleton-line" style={{ width: "55%" }} />
              <div className="skeleton-line" style={{ width: "35%" }} />
              <div className="skeleton-line" style={{ width: "70%" }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {data && !loading && (
        <>
          {/* Result heading */}
          <div className="results-header">
            <p className="results-label">
              <strong>{data.summary.total}</strong> leads found in{" "}
              <strong>{data.city}</strong>, {data.country} — {data.category}
            </p>
            <input
              id="lead-search-input"
              type="text"
              className="lead-search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <StatsBar summary={data.summary} filter={filter} setFilter={setFilter} />

          <div id="lead-results">
            {visible.map((l, i) => (
              <LeadCard key={l.placeId || l.name + i} lead={l} />
            ))}
            {visible.length === 0 && (
              <div className="empty" role="status">
                <p style={{ fontSize: 32, margin: 0 }}>🔍</p>
                <p style={{ margin: "8px 0 0" }}>No leads match this filter.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}