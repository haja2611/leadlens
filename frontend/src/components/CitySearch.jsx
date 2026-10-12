/**
 * CitySearch — country selector + city typeahead
 *
 * Props:
 *   countries  – [{ code, label, flag }]
 *   cities     – [{ key, label, country }]
 *   country    – selected country code (state)
 *   city       – selected city key (state)
 *   onCountry  – (code) => void
 *   onCity     – (key) => void
 */
import { useState, useRef, useEffect } from "react";

export default function CitySearch({ countries, cities, country, city, onCountry, onCity }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Filter cities by selected country + search query
  const filtered = cities.filter(
    (c) =>
      c.country === country &&
      c.label.toLowerCase().includes(query.toLowerCase())
  );

  // Display label for the current selected city
  const selectedLabel = cities.find((c) => c.key === city)?.label || "";

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(c) {
    onCity(c.key);
    setQuery(c.label);
    setOpen(false);
  }

  function handleFocus() {
    setQuery("");   // clear so user can type fresh
    setOpen(true);
  }

  function handleCountryChange(e) {
    const code = e.target.value;
    onCountry(code);
    // Reset city when country changes
    const firstCity = cities.find((c) => c.country === code);
    if (firstCity) { onCity(firstCity.key); setQuery(firstCity.label); }
    else { onCity(""); setQuery(""); }
    setOpen(false);
  }

  return (
    <div className="city-search-group" ref={ref}>
      {/* Country selector */}
      <select
        className="country-select"
        value={country}
        onChange={handleCountryChange}
        aria-label="Country"
      >
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.label}
          </option>
        ))}
      </select>

      {/* City typeahead */}
      <div className="city-typeahead">
        <input
          type="text"
          className="city-input"
          placeholder="Search city…"
          value={open ? query : selectedLabel}
          onFocus={handleFocus}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          aria-label="City search"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {open && filtered.length > 0 && (
          <ul className="city-dropdown" role="listbox">
            {filtered.map((c) => (
              <li
                key={c.key}
                role="option"
                aria-selected={c.key === city}
                className={`city-option${c.key === city ? " selected" : ""}`}
                onMouseDown={() => handleSelect(c)}
              >
                {c.label}
              </li>
            ))}
          </ul>
        )}
        {open && filtered.length === 0 && query.length > 0 && (
          <ul className="city-dropdown">
            <li className="city-option city-no-result">No cities found</li>
          </ul>
        )}
      </div>
    </div>
  );
}
