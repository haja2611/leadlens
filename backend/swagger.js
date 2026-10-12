import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LeadLens API",
      version: "1.0.0",
      description:
        "Intelligent lead-generation API that scrapes Google Maps, deduplicates, and scores business leads for cold-calling.\n\n" +
        "**Base URL:** `http://localhost:4000`\n\n" +
        "All category and city keys are fetched from `GET /api/meta`.",
    },
    tags: [
      { name: "Leads",  description: "Lead search, scoring and export" },
      { name: "Meta",   description: "Available categories, cities and countries" },
      { name: "System", description: "Health and status" },
    ],
  },
  apis: ["./server.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
