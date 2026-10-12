import { CATEGORIES, CITIES } from "../config/categories.js";

function parseAddress(raw) {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

function normalizeWebsite(url) {
  if (!url) return null;
  // Reject socials/aggregators — not real company sites
  if (/facebook\.com|instagram\.com|linkedin\.com|twitter\.com|wa\.me|wa\.link|calendly\.com|zohobookings\.com/i.test(url)) {
    return null;
  }
  return url.trim();
}

export function normalizeRow(row) {
  const addr = parseAddress(row.complete_address);
  return {
    placeId: row.place_id || null,
    cid: row.cid || null,
    name: (row.title || "").trim(),
    category: (row.category || "Unknown").trim(),
    city: addr.city || "",
    state: addr.state || "",
    country: addr.country || "",
    address: row.address || "",
    phone: (row.phone || "").trim() || null,
    website: normalizeWebsite(row.website),
    rawWebsite: row.website || null,
    email: (row.emails || "").trim() || null,
    rating: parseFloat(row.review_rating) || 0,
    reviewCount: parseInt(row.review_count, 10) || 0,
    latitude: parseFloat(row.latitude) || null,
    longitude: parseFloat(row.longitude) || null,
    source: "Google Maps",
    sourceUrl: row.link || null,
  };
}

// ============================================================
// DEDUPLICATION — universal, works across every category
// ============================================================
function fingerprint(lead) {
  // Priority 1: Google's own stable IDs
  if (lead.placeId) return `pid:${lead.placeId}`;
  if (lead.cid)     return `cid:${lead.cid}`;

  // Priority 2: normalized name + phone
  const nameKey = lead.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (lead.phone) {
    const phoneKey = lead.phone.replace(/\D/g, "");
    return `np:${nameKey}:${phoneKey}`;
  }

  // Priority 3: name + rounded coordinates (~11m precision)
  if (lead.latitude != null && lead.longitude != null) {
    const lat = Math.round(lead.latitude * 10000) / 10000;
    const lon = Math.round(lead.longitude * 10000) / 10000;
    return `ngeo:${nameKey}:${lat}:${lon}`;
  }

  // Last resort: name only
  return `n:${nameKey}`;
}

export function deduplicate(leads) {
  const seen = new Map();
  for (const lead of leads) {
    const fp = fingerprint(lead);
    if (!seen.has(fp)) {
      seen.set(fp, lead);
    } else {
      // Merge: prefer the record with more contact info
      const existing = seen.get(fp);
      const merged = {
        ...existing,
        website: existing.website || lead.website,
        phone: existing.phone || lead.phone,
        email: existing.email || lead.email,
        rating: Math.max(existing.rating, lead.rating),
        reviewCount: Math.max(existing.reviewCount, lead.reviewCount),
      };
      seen.set(fp, merged);
    }
  }
  return Array.from(seen.values());
}

// ============================================================
// SCORING — universal; category config drives the patterns
// ============================================================
export function scoreLead(lead, categoryKey, cityKey) {
  const config = CATEGORIES[categoryKey];
  const cityConfig = CITIES[cityKey];
  if (!config || !cityConfig) return { ...lead, score: 0, tier: "disqualified", reasons: [], flags: ["Unknown category or city"] };

  const reasons = [];
  const flags = [];
  let score = 0;

  const nameLower = lead.name.toLowerCase();
  const categoryLower = lead.category.toLowerCase();
  const addressLower = (lead.address + " " + lead.city).toLowerCase();

  // --- 1. Category match (30 pts) ---
  const categoryMatch = config.matchedCategories.some(gc => categoryLower.includes(gc));
  if (categoryMatch) {
    score += 30;
    reasons.push(`Category matches "${config.label}"`);
  } else {
    flags.push(`Category "${lead.category}" not in target set`);
  }

  // --- 2. City match (20 pts) ---
  const cityMatch = cityConfig.matchers.some(m => addressLower.includes(m));
  if (cityMatch) {
    score += 20;
    reasons.push(`Located in ${cityConfig.label}`);
  } else {
    flags.push(`City mismatch (expected ${cityConfig.label})`);
  }

  // --- 3. Name quality (15 pts) ---
  const isGeneric  = config.genericNamePatterns.some(re => re.test(nameLower));
  const isNegative = config.negativeNamePatterns.some(re => re.test(nameLower));

  if (isNegative) {
    flags.push(`Name pattern suggests wrong business type`);
  } else if (isGeneric) {
    flags.push(`Generic name — likely not a real target`);
  } else if (lead.name.length > 4) {
    score += 15;
    reasons.push("Identifiable business name");
  }

  // --- 4. Contactability (25 pts) ---
  if (lead.website) {
    score += 15;
    reasons.push("Has website");
  } else {
    flags.push("No website");
  }
  if (lead.phone) {
    score += 10;
    reasons.push("Has phone");
  } else {
    flags.push("No phone");
  }

  // --- 5. Credibility (10 pts) ---
  if (lead.reviewCount >= 20 && lead.rating >= 4.0) {
    score += 10;
    reasons.push(`Strong reputation (${lead.rating}★, ${lead.reviewCount} reviews)`);
  } else if (lead.reviewCount >= 5) {
    score += 5;
    reasons.push(`Established (${lead.reviewCount} reviews)`);
  } else if (lead.reviewCount === 0) {
    flags.push("No reviews — unverified");
  }

  // --- Tier assignment ---
  let tier;
  if (isNegative || isGeneric) {
    tier = "disqualified";               // hard reject
  } else if (score >= 75 && categoryMatch && cityMatch) {
    tier = "qualified";
  } else if (score >= 45) {
    tier = "review";
  } else {
    tier = "disqualified";
  }

  return { ...lead, score, tier, reasons, flags };
}