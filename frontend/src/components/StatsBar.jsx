export default function StatsBar({ summary, filter, setFilter }) {
  const tabs = [
    { key: "all",          label: "All",           count: summary.total,         color: "tab-all" },
    { key: "qualified",    label: "✓ Qualified",   count: summary.qualified,     color: "tab-qualified" },
    { key: "review",       label: "⚠ Review",      count: summary.review,        color: "tab-review" },
    { key: "disqualified", label: "✕ Disqualified",count: summary.disqualified,  color: "tab-disqualified" },
  ];
  return (
    <div className="stats-bar" role="tablist" aria-label="Filter leads by tier">
      {tabs.map(({ key, label, count, color }) => (
        <button
          key={key}
          role="tab"
          aria-selected={filter === key}
          onClick={() => setFilter(key)}
          className={`tab ${color}${filter === key ? " active" : ""}`}
        >
          {label}
          <span className="tab-count">{count}</span>
        </button>
      ))}
    </div>
  );
}