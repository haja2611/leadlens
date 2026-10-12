const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function fetchMeta() {
  const r = await fetch(`${BASE}/api/meta`);
  if (!r.ok) throw new Error("Failed to fetch meta");
  return r.json();
}

export async function fetchLeads(category, city, refresh = false) {
  const url = `${BASE}/api/leads?category=${category}&city=${city}${refresh ? "&refresh=true" : ""}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch leads");
  }
  return r.json();
}

export function exportCsv(category, city, tier = "all") {
  window.open(`${BASE}/api/leads/export?category=${category}&city=${city}&tier=${tier}`);
}