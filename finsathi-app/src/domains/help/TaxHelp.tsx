import { useState, useMemo } from 'react';
import { useHelpStore } from '../../shared/hooks/useHelpStore';
import { TAX_GLOSSARY } from './taxGlossary';
import './TaxHelp.css';

export function TaxHelp() {
  const { isOpen, activeTerm, closeHelp } = useHelpStore();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return TAX_GLOSSARY.filter(
      (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    );
  }, [search]);

  if (!isOpen) return null;

  return (
    <div className="tax-help-overlay" onClick={closeHelp}>
      <div className="tax-help-panel glass-surface-elevated animate-in-right" onClick={(e) => e.stopPropagation()}>
        <div className="tax-help-header">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-label-mono color-positive">TAX_GLOSSARY</h2>
            <span className="text-label-mono-sm color-muted">KNOWLEDGE_BASE_V1.0</span>
          </div>
          <button className="tax-help-close" onClick={closeHelp}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="tax-help-search">
          <span className="material-symbols-outlined icon-sm">search</span>
          <input 
            type="text" 
            placeholder="Search terms or definitions..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="tax-help-content">
          {activeTerm && !search && (
            <div className="tax-help-active glass-surface">
              <span className="text-label-mono-sm color-positive" style={{ marginBottom: '4px', display: 'block' }}>CONTEXTUAL_HELP:</span>
              <TermCard term={TAX_GLOSSARY.find(t => t.term.includes(activeTerm)) || TAX_GLOSSARY[0]} />
              <div className="tax-help-separator">OTHER_TERMS</div>
            </div>
          )}

          <div className="tax-help-list">
            {filtered.map((t) => (
              <TermCard key={t.term} term={t} highlight={activeTerm === t.term} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="tax-help-empty">
              <span className="text-label-mono-sm color-muted">NO_MATCHING_TERMS</span>
            </div>
          )}
        </div>

        <div className="tax-help-footer">
          <span className="text-label-mono-sm color-muted">Finsathi Tax Intelligence — Empowering your financial journey.</span>
        </div>
      </div>
    </div>
  );
}

function TermCard({ term, highlight }: { term: typeof TAX_GLOSSARY[0], highlight?: boolean }) {
  return (
    <div className={`term-card ${highlight ? 'highlight' : ''}`}>
      <h3 className="text-label-mono term-title">{term.term}</h3>
      <p className="text-body term-definition">{term.definition}</p>
      <div className="term-relevance">
        <span className="material-symbols-outlined icon-xs color-positive">lightbulb</span>
        <p className="text-label-mono-sm color-muted">{term.relevance}</p>
      </div>
    </div>
  );
}
