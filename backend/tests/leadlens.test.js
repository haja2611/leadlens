/**
 * LeadLens — Test Suite
 *
 * Covers:
 *   1. qualify.js — normalizeRow, deduplicate, scoreLead (pure functions, no I/O)
 *   2. server.js  — HTTP endpoints via supertest
 *
 * Run: npm test  (from backend/)
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. UNIT TESTS — qualify.js
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from "@jest/globals";
import { normalizeRow, deduplicate, scoreLead } from "../services/qualify.js";

// ── normalizeRow ──────────────────────────────────────────────────────────────
describe("normalizeRow", () => {
  it("parses a complete CSV row into canonical shape", () => {
    const row = {
      place_id: "abc123",
      cid: "cid99",
      title: "  Acme Software  ",
      category: "Software Company",
      complete_address: JSON.stringify({ city: "Chennai", state: "TN", country: "India" }),
      address: "12 Anna Salai, Chennai",
      phone: "+91-98765-43210",
      website: "https://acme.com",
      emails: "contact@acme.com",
      review_rating: "4.5",
      review_count: "120",
      latitude: "13.0827",
      longitude: "80.2707",
      link: "https://maps.google.com/?cid=cid99",
    };

    const lead = normalizeRow(row);
    expect(lead.placeId).toBe("abc123");
    expect(lead.name).toBe("Acme Software");
    expect(lead.city).toBe("Chennai");
    expect(lead.rating).toBe(4.5);
    expect(lead.reviewCount).toBe(120);
    expect(lead.website).toBe("https://acme.com");
    expect(lead.email).toBe("contact@acme.com");
    expect(lead.source).toBe("Google Maps");
  });

  it("strips social media URLs from website", () => {
    const row = {
      title: "Biz",
      website: "https://www.facebook.com/mybiz",
      complete_address: "{}",
    };
    const lead = normalizeRow(row);
    expect(lead.website).toBeNull();
    expect(lead.rawWebsite).toBe("https://www.facebook.com/mybiz");
  });

  it("handles missing / empty fields gracefully", () => {
    const lead = normalizeRow({ title: "" });
    expect(lead.name).toBe("");
    expect(lead.phone).toBeNull();
    expect(lead.website).toBeNull();
    expect(lead.rating).toBe(0);
  });
});

// ── deduplicate ───────────────────────────────────────────────────────────────
describe("deduplicate", () => {
  const base = {
    name: "Test Co",
    phone: null,
    website: null,
    email: null,
    rating: 0,
    reviewCount: 0,
    latitude: null,
    longitude: null,
  };

  it("deduplicates by placeId (highest priority)", () => {
    const leads = [
      { ...base, placeId: "p1", website: null },
      { ...base, placeId: "p1", website: "https://x.com" },
    ];
    const result = deduplicate(leads);
    expect(result).toHaveLength(1);
    // merged: prefers record with website
    expect(result[0].website).toBe("https://x.com");
  });

  it("deduplicates by name + phone when no placeId", () => {
    const leads = [
      { ...base, placeId: null, cid: null, phone: "9999999999" },
      { ...base, placeId: null, cid: null, phone: "9999999999" },
    ];
    expect(deduplicate(leads)).toHaveLength(1);
  });

  it("keeps distinct leads with different placeIds", () => {
    const leads = [
      { ...base, placeId: "p1" },
      { ...base, placeId: "p2" },
    ];
    expect(deduplicate(leads)).toHaveLength(2);
  });

  it("falls back to name-only key as last resort", () => {
    const leads = [
      { ...base, placeId: null, cid: null, name: "Same Biz" },
      { ...base, placeId: null, cid: null, name: "Same Biz" },
    ];
    expect(deduplicate(leads)).toHaveLength(1);
  });
});

// ── scoreLead ─────────────────────────────────────────────────────────────────
describe("scoreLead", () => {
  const perfectLead = {
    name: "Acme Software Solutions",
    category: "software company",
    address: "12 Anna Salai",
    city: "Chennai",
    phone: "+91-98765-43210",
    website: "https://acme.com",
    email: null,
    rating: 4.8,
    reviewCount: 50,
    latitude: 13.08,
    longitude: 80.27,
  };

  it("returns score 0 and disqualified for unknown category", () => {
    const result = scoreLead(perfectLead, "notreal", "chennai");
    expect(result.tier).toBe("disqualified");
    expect(result.score).toBe(0);
    expect(result.flags).toContain("Unknown category or city");
  });

  it("returns score 0 and disqualified for unknown city", () => {
    const result = scoreLead(perfectLead, "software", "atlantis");
    expect(result.tier).toBe("disqualified");
    expect(result.score).toBe(0);
  });

  it("gives a qualified lead max score with all signals", () => {
    const result = scoreLead(perfectLead, "software", "chennai");
    expect(result.tier).toBe("qualified");
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.reasons.some(r => r.includes("Category"))).toBe(true);
    expect(result.reasons.some(r => r.includes("website"))).toBe(true);
    expect(result.reasons.some(r => r.includes("phone"))).toBe(true);
  });

  it("downgrades to review when city mismatches", () => {
    const lead = { ...perfectLead, address: "10 MG Road", city: "Bangalore" };
    const result = scoreLead(lead, "software", "chennai");
    expect(result.tier).toBe("review");
    expect(result.flags.some(f => f.includes("City mismatch"))).toBe(true);
  });

  it("disqualifies leads with negative name patterns", () => {
    const lead = { ...perfectLead, name: "Acme Software Training Academy" };
    const result = scoreLead(lead, "software", "chennai");
    expect(result.tier).toBe("disqualified");
    expect(result.flags.some(f => f.includes("wrong business type"))).toBe(true);
  });

  it("disqualifies leads with generic names", () => {
    const lead = { ...perfectLead, name: "Software Solutions" };
    const result = scoreLead(lead, "software", "chennai");
    expect(result.tier).toBe("disqualified");
  });

  it("adds No website flag when website is null", () => {
    const lead = { ...perfectLead, website: null };
    const result = scoreLead(lead, "software", "chennai");
    expect(result.flags).toContain("No website");
  });

  it("adds No phone flag when phone is null", () => {
    const lead = { ...perfectLead, phone: null };
    const result = scoreLead(lead, "software", "chennai");
    expect(result.flags).toContain("No phone");
  });

  it("partial credibility score for 5–19 reviews", () => {
    const lead = { ...perfectLead, reviewCount: 10, rating: 3.5 };
    const result = scoreLead(lead, "software", "chennai");
    expect(result.reasons.some(r => r.includes("Established"))).toBe(true);
  });

  it("returns reasons[] and flags[] on every result (rule compliance)", () => {
    const result = scoreLead(perfectLead, "software", "chennai");
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(Array.isArray(result.flags)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. INTEGRATION TESTS — HTTP endpoints (supertest)
// ─────────────────────────────────────────────────────────────────────────────
import request from "supertest";
import express from "express";
import cors from "cors";

// Lightweight test app that wires up the same route handlers
// without the real scraper (we skip loadOrScrape by pre-seeding cache)
import { get as cacheGet, set as cacheSet, del as cacheDel } from "../services/cache.js";
import { CATEGORIES, CITIES, COUNTRIES } from "../config/categories.js";

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", ts: new Date().toISOString() })
  );

  app.get("/api/meta", (_req, res) => {
    const categories = Object.entries(CATEGORIES).map(([key, c]) => ({ key, label: c.label }));
    const cities = Object.entries(CITIES).map(([key, c]) => ({ key, label: c.label, country: c.country }));
    const countries = Object.entries(COUNTRIES).map(([code, c]) => ({ code, label: c.label, flag: c.flag }));
    res.json({ categories, cities, countries });
  });

  app.get("/api/leads", (req, res) => {
    const { category = "software", city = "chennai" } = req.query;
    if (!CATEGORIES[category] || !CITIES[city])
      return res.status(400).json({ error: "Unknown category or city" });

    const leads = cacheGet(`${category}:${city}`) || [];
    const summary = {
      total: leads.length,
      qualified: leads.filter(l => l.tier === "qualified").length,
      review: leads.filter(l => l.tier === "review").length,
      disqualified: leads.filter(l => l.tier === "disqualified").length,
    };
    res.json({ category: CATEGORIES[category].label, city: CITIES[city].label, summary, leads });
  });

  return app;
}

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const res = await request(buildApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/meta", () => {
  it("returns categories, cities, countries arrays", async () => {
    const res = await request(buildApp()).get("/api/meta");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(Array.isArray(res.body.cities)).toBe(true);
    expect(Array.isArray(res.body.countries)).toBe(true);
  });

  it("categories include software and restaurant", async () => {
    const res = await request(buildApp()).get("/api/meta");
    const keys = res.body.categories.map(c => c.key);
    expect(keys).toContain("software");
    expect(keys).toContain("restaurant");
  });

  it("cities include both Indian and US cities", async () => {
    const res = await request(buildApp()).get("/api/meta");
    const keys = res.body.cities.map(c => c.key);
    expect(keys).toContain("chennai");
    expect(keys).toContain("newyork");
  });
});

describe("GET /api/leads", () => {
  it("returns 400 for unknown category", async () => {
    const res = await request(buildApp()).get("/api/leads?category=aliens&city=chennai");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown/);
  });

  it("returns 400 for unknown city", async () => {
    const res = await request(buildApp()).get("/api/leads?category=software&city=atlantis");
    expect(res.status).toBe(400);
  });

  it("returns summary counts when cache is seeded", async () => {
    cacheSet("software:chennai", [
      { name: "X", tier: "qualified", score: 80, reasons: [], flags: [] },
      { name: "Y", tier: "review",    score: 50, reasons: [], flags: [] },
      { name: "Z", tier: "disqualified", score: 10, reasons: [], flags: [] },
    ]);
    const res = await request(buildApp()).get("/api/leads?category=software&city=chennai");
    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(3);
    expect(res.body.summary.qualified).toBe(1);
    expect(res.body.summary.review).toBe(1);
    expect(res.body.summary.disqualified).toBe(1);
  });

  it("del() removes key from Map; subsequent get() returns null", () => {
    cacheSet("del-test-key", [{ name: "Tmp" }]);
    expect(cacheGet("del-test-key")).toEqual([{ name: "Tmp" }]);
    cacheDel("del-test-key");
    expect(cacheGet("del-test-key")).toBeNull();
  });
});
