export const CATEGORIES = {
  software: {
    label: "Software & IT",
    // Run all of these queries; merge + dedupe results
    searchTerms: [
      "software companies",
      "IT companies",
      "software development",
    ],
    // Which Google categories count as a match
    matchedCategories: [
      "software company", "software development", "it company",
      "information technology", "internet", "computer software",
    ],
    // Names that are too generic to be a real lead
    genericNamePatterns: [
      /^software (company|solutions?|services?)$/i,
      /^it (company|solutions?|services?)$/i,
      /^(erp|mlm|hrms|crm) software/i,
    ],
    // Names that mean the business is NOT what we're looking for
    negativeNamePatterns: [/training|institute|academy|course/i],
  },

  restaurant: {
    label: "Food & Beverage",
    searchTerms: ["restaurants", "cafes", "bakeries"],
    matchedCategories: [
      "restaurant", "cafe", "coffee", "bar", "pub",
      "bakery", "fast food", "food court", "pizza", "ice cream", "cake shop",
    ],
    genericNamePatterns: [/^restaurant$/i, /^cafe$/i, /^food$/i, /^hotel$/i],
    negativeNamePatterns: [/grocery|supermarket|wholesale/i],
  },

  hospital: {
    label: "Healthcare",
    searchTerms: ["hospitals", "clinics", "pharmacies"],
    matchedCategories: [
      "hospital", "clinic", "medical", "doctor", "dentist",
      "pharmacy", "health", "diagnostic", "pathology",
    ],
    genericNamePatterns: [/^hospital$/i, /^clinic$/i, /^pharmacy$/i],
    negativeNamePatterns: [/veterinary|pet clinic|animal/i],
  },

  hotel: {
    label: "Hospitality",
    searchTerms: ["hotels", "lodges", "guest houses"],
    matchedCategories: ["hotel", "lodge", "resort", "guest house", "hostel", "motel"],
    genericNamePatterns: [/^hotel$/i, /^lodge$/i, /^resort$/i],
    negativeNamePatterns: [/restaurant|dhaba/i],
  },

  education: {
    label: "Education",
    searchTerms: ["schools", "colleges", "coaching centers"],
    matchedCategories: ["school", "college", "university", "coaching", "institute", "academy"],
    genericNamePatterns: [/^school$/i, /^college$/i, /^academy$/i],
    negativeNamePatterns: [/training center for software/i], // edge case
  },
};

export const CITIES = {
  // ── India ──
  chennai: { label: "Chennai", country: "IN", matchers: ["chennai", "madras"] },
  bangalore: { label: "Bangalore", country: "IN", matchers: ["bangalore", "bengaluru"] },
  hyderabad: { label: "Hyderabad", country: "IN", matchers: ["hyderabad", "secunderabad"] },
  mumbai: { label: "Mumbai", country: "IN", matchers: ["mumbai", "bombay"] },
  delhi: { label: "Delhi", country: "IN", matchers: ["delhi", "new delhi"] },
  pune: { label: "Pune", country: "IN", matchers: ["pune"] },
  kolkata: { label: "Kolkata", country: "IN", matchers: ["kolkata", "calcutta"] },
  ahmedabad: { label: "Ahmedabad", country: "IN", matchers: ["ahmedabad"] },

  // ── USA ──
  newyork: { label: "New York", country: "US", matchers: ["new york", "nyc"] },
  losangeles: { label: "Los Angeles", country: "US", matchers: ["los angeles", "la"] },
  chicago: { label: "Chicago", country: "US", matchers: ["chicago"] },
  houston: { label: "Houston", country: "US", matchers: ["houston"] },
  phoenix: { label: "Phoenix", country: "US", matchers: ["phoenix"] },
  dallas: { label: "Dallas", country: "US", matchers: ["dallas"] },
  miami: { label: "Miami", country: "US", matchers: ["miami"] },
  seattle: { label: "Seattle", country: "US", matchers: ["seattle"] },
  austin: { label: "Austin", country: "US", matchers: ["austin"] },
  boston: { label: "Boston", country: "US", matchers: ["boston"] },
};

export const COUNTRIES = {
  IN: { label: "India", flag: "🇮🇳" },
  US: { label: "United States", flag: "🇺🇸" },
};