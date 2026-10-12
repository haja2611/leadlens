const tierClass = {
  qualified:    "tier-qualified",
  review:       "tier-review",
  disqualified: "tier-disqualified",
};

export default function LeadCard({ lead }) {
  const pct = Math.min(100, lead.score);

  return (
    <article className="lead-card">
      <div className="lead-header">
        {/* Left: name + meta */}
        <div style={{ minWidth: 0 }}>
          <h3 className="lead-title">{lead.name}</h3>
          <p className="lead-meta">{lead.category} · {lead.city}</p>
        </div>

        {/* Right: tier badge + score number + score bar */}
        <div className="lead-score-block">
          <span className={`tier-badge ${tierClass[lead.tier]}`}>{lead.tier}</span>
          <div className="score-number">
            {lead.score}<span>/100</span>
          </div>
          <div className="score-bar-wrap" title={`Score: ${lead.score}/100`}>
            <div
              className={`score-bar-fill ${lead.tier}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="lead-contact">
        {lead.website && (
          <div className="lead-contact-item">
            <span>🌐</span>
            <a href={lead.website} target="_blank" rel="noreferrer">
              {lead.website.replace(/^https?:\/\//, "").slice(0, 45)}
            </a>
          </div>
        )}
        {lead.phone && (
          <div className="lead-contact-item">
            <span>📞</span>
            <a href={`tel:${lead.phone}`}>{lead.phone}</a>
          </div>
        )}
        {lead.email && (
          <div className="lead-contact-item">
            <span>✉</span>
            <a href={`mailto:${lead.email}`}>{lead.email}</a>
          </div>
        )}
        {lead.rating > 0 && (
          <div className="lead-contact-item">
            <span>⭐</span>
            {lead.rating} ({lead.reviewCount} reviews)
          </div>
        )}
      </div>

      {/* Reasons + Flags chips */}
      {(lead.reasons.length > 0 || lead.flags.length > 0) && (
        <div className="reasons">
          {lead.reasons.map((r, i) => (
            <span key={`r${i}`} className="chip chip-good">✓ {r}</span>
          ))}
          {lead.flags.map((f, i) => (
            <span key={`f${i}`} className="chip chip-bad">⚠ {f}</span>
          ))}
        </div>
      )}

      {/* Google Maps source */}
      {lead.sourceUrl && (
        <a href={lead.sourceUrl} target="_blank" rel="noreferrer" className="source-link">
          View on Google Maps ↗
        </a>
      )}
    </article>
  );
}