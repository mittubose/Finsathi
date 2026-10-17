import { useState, useMemo, useEffect } from 'react';
import { useAuditStore, type AuditAction, type AuditEntity } from '../../shared/hooks/useAuditStore';
import { formatINR } from '../../shared/lib/currency';
import { 
  getStoredErrors, 
  clearSystemErrors, 
  markErrorResolved, 
  type ErrorLogEntry, 
  type ErrorSeverity 
} from '../../shared/lib/errorLog';
import { useToast } from '../../shared/ui/Toast';
import './AuditTrail.css';

const ACTION_CONFIG: Record<AuditAction, { label: string; icon: string; class: string }> = {
  CREATE: { label: 'ADD', icon: 'add', class: 'audit-action--create' },
  UPDATE: { label: 'MOD', icon: 'edit', class: 'audit-action--update' },
  DELETE: { label: 'DEL', icon: 'delete', class: 'audit-action--delete' },
  IMPORT: { label: 'INP', icon: 'upload_file', class: 'audit-action--import' },
  EXPORT: { label: 'OUT', icon: 'download', class: 'audit-action--export' },
};

const ENTITY_ICONS: Record<AuditEntity, string> = {
  income: 'payments',
  expense: 'shopping_cart',
  trade: 'query_stats',
  reminder: 'notifications',
  settings: 'settings',
  import: 'dataset',
};

type ViewMode = 'mutations' | 'errors' | 'improvement';

interface ImprovementPlan {
  auditedAt: string;
  healthScore: number;
  totalErrors: number;
  errors24h: number;
  errors7d: number;
  severityBreakdown: { fatal: number; error: number; warn: number };
  componentBreakdown: Record<string, number>;
  topSignatures: Array<{
    component: string;
    message: string;
    count: number;
    lastSeen: string;
    level: string;
  }>;
  improvementItems: Array<{
    id: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
    issue: string;
    recommendation: string;
    status: string;
  }>;
}

export function AuditTrail() {
  const { entries } = useAuditStore();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('mutations');
  const [filterAction, setFilterAction] = useState<AuditAction | 'ALL'>('ALL');
  const [filterEntity, setFilterEntity] = useState<AuditEntity | 'ALL'>('ALL');
  const [errorLevel, setErrorLevel] = useState<ErrorSeverity | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  
  // Error log state
  const [systemErrors, setSystemErrors] = useState<ErrorLogEntry[]>([]);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  // Improvement plan state
  const [plan, setPlan] = useState<ImprovementPlan | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  const refreshErrors = () => {
    setSystemErrors(getStoredErrors().reverse());
  };

  const fetchPlan = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/audit/improvement-plan');
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      }
    } catch {
      // offline / sync daemon not reachable
    }
  };

  const triggerAuditScan = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('http://127.0.0.1:3001/api/audit/run-scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        toast('Diagnostic cron scan completed. Health report updated.', 'success');
      } else {
        toast('Audit daemon unreachable on port 3001', 'error');
      }
    } catch (err: any) {
      toast(`Failed to run audit cron: ${err.message}`, 'error');
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    refreshErrors();
    fetchPlan();
  }, []);

  const filteredMutations = useMemo(() => {
    return entries.filter((e) => {
      if (filterAction !== 'ALL' && e.action !== filterAction) return false;
      if (filterEntity !== 'ALL' && e.entity !== filterEntity) return false;
      if (search && !e.label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterAction, filterEntity, search]);

  const filteredErrors = useMemo(() => {
    return systemErrors.filter((e) => {
      if (errorLevel !== 'ALL' && e.level !== errorLevel) return false;
      if (search && !`${e.component} ${e.message}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [systemErrors, errorLevel, search]);

  const stats = useMemo(() => ({
    total: entries.length,
    creates: entries.filter((e) => e.action === 'CREATE').length,
    updates: entries.filter((e) => e.action === 'UPDATE').length,
    deletes: entries.filter((e) => e.action === 'DELETE').length,
    errorCount: systemErrors.length,
    fatalCount: systemErrors.filter(e => e.level === 'fatal').length,
  }), [entries, systemErrors]);

  const handleClearErrors = () => {
    clearSystemErrors();
    refreshErrors();
    fetch('http://127.0.0.1:3001/api/logs/clear', { method: 'POST' }).catch(() => {});
    toast('System error logs cleared', 'info');
  };

  const handleExportErrors = () => {
    const blob = new Blob([JSON.stringify(systemErrors, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finsathi-errors-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="audit-page animate-in">
      <header className="audit-header">
        <div className="audit-title">
          <h1 className="text-headline-md">AUDIT & SYSTEM DIAGNOSTICS</h1>
          <span className="text-label-mono-sm color-muted">TRANSACTION MUTATIONS • RUNTIME ERROR LOGS • HEALTH PLAN</span>
        </div>
        <div className="audit-quick-stats">
          <div className="audit-pill"><span className="text-label-mono-xs color-muted">MUTATIONS</span> {stats.total}</div>
          <div className={`audit-pill ${stats.errorCount > 0 ? 'color-warning' : 'color-positive'}`}>
            <span className="text-label-mono-xs color-muted">ERRORS</span> {stats.errorCount}
          </div>
          {plan && (
            <div className="audit-pill color-positive">
              <span className="text-label-mono-xs color-muted">STABILITY</span> {plan.healthScore}%
            </div>
          )}
        </div>
      </header>

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
        <button
          onClick={() => setViewMode('mutations')}
          style={{
            background: viewMode === 'mutations' ? 'var(--primary-container, #00ff41)' : 'rgba(255,255,255,0.03)',
            color: viewMode === 'mutations' ? '#000' : 'rgba(255,255,255,0.7)',
            border: 'none',
            padding: '6px 14px',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
            borderRadius: '2px',
          }}
        >
          1. BUSINESS AUDIT TRAIL ({stats.total})
        </button>
        <button
          onClick={() => setViewMode('errors')}
          style={{
            background: viewMode === 'errors' ? 'var(--primary-container, #00ff41)' : 'rgba(255,255,255,0.03)',
            color: viewMode === 'errors' ? '#000' : 'rgba(255,255,255,0.7)',
            border: 'none',
            padding: '6px 14px',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
            borderRadius: '2px',
          }}
        >
          2. RUNTIME ERROR LOGS ({stats.errorCount})
        </button>
        <button
          onClick={() => setViewMode('improvement')}
          style={{
            background: viewMode === 'improvement' ? 'var(--primary-container, #00ff41)' : 'rgba(255,255,255,0.03)',
            color: viewMode === 'improvement' ? '#000' : 'rgba(255,255,255,0.7)',
            border: 'none',
            padding: '6px 14px',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
            borderRadius: '2px',
          }}
        >
          3. CRON AUDITOR & IMPROVEMENT PLAN
        </button>
      </div>

      {/* TAB 1: MUTATIONS */}
      {viewMode === 'mutations' && (
        <>
          <div className="audit-controls glass-surface">
            <div className="audit-search-bar">
              <span className="material-symbols-outlined icon-xs color-muted">search</span>
              <input 
                className="audit-input" 
                placeholder="FILTER_BY_LABEL..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="audit-filter-segmented">
              {(['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const).map(a => (
                <button 
                  key={a}
                  className={`filter-tab ${filterAction === a ? 'active' : ''}`}
                  onClick={() => setFilterAction(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="audit-table glass-surface">
            <div className="audit-table-header">
              <span className="text-label-mono-xs color-subtle">TIMESTAMP</span>
              <span className="text-label-mono-xs color-subtle">ACTION</span>
              <span className="text-label-mono-xs color-subtle">ENTITY</span>
              <span className="text-label-mono-xs color-subtle">DESCRIPTION</span>
              <span className="text-label-mono-xs color-subtle" style={{ textAlign: 'right' }}>VALUE</span>
            </div>
            
            <div className="audit-rows">
              {filteredMutations.length === 0 ? (
                <div className="audit-empty">
                  <span className="text-label-mono-sm color-muted">ZERO_MATCHING_ENTRIES</span>
                </div>
              ) : (
                filteredMutations.map((entry) => {
                  const config = ACTION_CONFIG[entry.action];
                  return (
                    <div key={entry.id} className="audit-row glass-row">
                      <div className="audit-cell timestamp">
                        <span className="text-label-mono-sm color-muted">
                          {new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-label-mono-xs color-muted" style={{ opacity: 0.5 }}>
                          {new Date(entry.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="audit-cell action">
                        <div className={`audit-action-pip ${config.class}`}>
                          <span className="material-symbols-outlined">{config.icon}</span>
                          <span className="text-label-mono-xs">{config.label}</span>
                        </div>
                      </div>

                      <div className="audit-cell entity">
                        <span className="material-symbols-outlined icon-xs color-muted">{ENTITY_ICONS[entry.entity]}</span>
                        <span className="text-label-mono-xs color-muted">{entry.entity.toUpperCase()}</span>
                      </div>

                      <div className="audit-cell label">
                        <span className="text-body-sm">{entry.label}</span>
                        {entry.details && <span className="text-label-mono-xs color-muted truncate">{entry.details}</span>}
                      </div>

                      <div className="audit-cell value" style={{ textAlign: 'right' }}>
                        {entry.amountPaise !== undefined ? (
                          <span className="text-data-display" style={{ fontSize: '12px' }}>
                            {formatINR(entry.amountPaise)}
                          </span>
                        ) : (
                          <span className="text-label-mono-xs color-muted">—</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: SYSTEM ERROR LOGS */}
      {viewMode === 'errors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="audit-controls glass-surface" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <div className="audit-search-bar">
              <span className="material-symbols-outlined icon-xs color-muted">search</span>
              <input 
                className="audit-input" 
                placeholder="SEARCH_ERRORS_BY_COMPONENT_OR_MSG..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="audit-filter-segmented">
                {(['ALL', 'fatal', 'error', 'warn'] as const).map(lvl => (
                  <button 
                    key={lvl}
                    className={`filter-tab ${errorLevel === lvl ? 'active' : ''}`}
                    onClick={() => setErrorLevel(lvl)}
                  >
                    {lvl.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExportErrors}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  borderRadius: '2px',
                }}
              >
                EXPORT JSON
              </button>

              <button
                onClick={handleClearErrors}
                style={{
                  background: 'rgba(255,68,68,0.15)',
                  border: '1px solid #ff4444',
                  color: '#ffb3ba',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  borderRadius: '2px',
                }}
              >
                CLEAR LOGS
              </button>
            </div>
          </div>

          <div className="audit-table glass-surface">
            <div className="audit-table-header" style={{ gridTemplateColumns: '130px 90px 180px 1fr 100px' }}>
              <span className="text-label-mono-xs color-subtle">TIMESTAMP</span>
              <span className="text-label-mono-xs color-subtle">SEVERITY</span>
              <span className="text-label-mono-xs color-subtle">COMPONENT</span>
              <span className="text-label-mono-xs color-subtle">MESSAGE / TRACE</span>
              <span className="text-label-mono-xs color-subtle" style={{ textAlign: 'right' }}>ACTION</span>
            </div>

            <div className="audit-rows">
              {filteredErrors.length === 0 ? (
                <div className="audit-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#00ff41', marginBottom: '8px' }}>
                    check_circle
                  </span>
                  <div className="text-label-mono color-positive">NO SYSTEM ERRORS RECORDED</div>
                  <span className="text-label-mono-xs color-muted">All client processes and services operating within normal parameters.</span>
                </div>
              ) : (
                filteredErrors.map((err) => {
                  const isExpanded = expandedErrorId === err.id;
                  const isFatal = err.level === 'fatal';
                  const isWarn = err.level === 'warn';
                  const badgeColor = isFatal ? '#ff4444' : (isWarn ? '#ffd79b' : '#ff8533');

                  return (
                    <div 
                      key={err.id} 
                      className="audit-row glass-row"
                      style={{ 
                        gridTemplateColumns: '130px 90px 180px 1fr 100px',
                        background: err.resolved ? 'rgba(0,0,0,0.2)' : undefined,
                        opacity: err.resolved ? 0.6 : 1,
                      }}
                    >
                      <div className="audit-cell timestamp">
                        <span className="text-label-mono-sm color-muted">
                          {new Date(err.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-label-mono-xs color-muted">
                          {new Date(err.timestamp).toLocaleDateString([], { month: 'short', day: '2-digit' })}
                        </span>
                      </div>

                      <div className="audit-cell">
                        <span
                          style={{
                            fontSize: '9px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '2px',
                            background: `${badgeColor}22`,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}44`,
                          }}
                        >
                          {err.level.toUpperCase()}
                        </span>
                      </div>

                      <div className="audit-cell">
                        <span className="text-label-mono-xs" style={{ color: '#fff' }}>
                          {err.component}
                        </span>
                      </div>

                      <div className="audit-cell label" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="text-body-sm" style={{ color: isFatal ? '#ffb3ba' : '#fff' }}>
                            {err.message}
                          </span>
                          {err.stack && (
                            <button
                              onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary-container)',
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {isExpanded ? 'Hide Trace' : 'View Trace'}
                            </button>
                          )}
                        </div>

                        {isExpanded && err.stack && (
                          <pre
                            style={{
                              marginTop: '8px',
                              padding: '8px',
                              background: '#050505',
                              border: '1px solid rgba(255,255,255,0.1)',
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              color: '#ffb3ba',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: '140px',
                              overflowY: 'auto',
                              width: '100%',
                            }}
                          >
                            {err.stack}
                          </pre>
                        )}
                      </div>

                      <div className="audit-cell value" style={{ textAlign: 'right' }}>
                        {!err.resolved ? (
                          <button
                            onClick={() => {
                              markErrorResolved(err.id);
                              refreshErrors();
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: 'rgba(255,255,255,0.6)',
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              padding: '2px 6px',
                              cursor: 'pointer',
                              borderRadius: '2px',
                            }}
                          >
                            RESOLVE ✓
                          </button>
                        ) : (
                          <span className="text-label-mono-xs color-positive">RESOLVED</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CRON AUDITOR & IMPROVEMENT PLAN */}
      {viewMode === 'improvement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Action Card */}
          <div
            className="glass-surface"
            style={{
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>
                  schedule
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: '#fff' }}>
                  Automated Background Error Audit (Cron Service)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                Runs hourly in background via daemon. Audits errors.jsonl, computes stability score, and synthesizes architectural improvement steps.
              </p>
            </div>

            <button
              onClick={triggerAuditScan}
              disabled={isAuditing}
              style={{
                background: 'var(--primary-container, #00ff41)',
                color: '#000',
                border: 'none',
                padding: '8px 16px',
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {isAuditing ? 'sync' : 'refresh'}
              </span>
              <span>{isAuditing ? 'AUDITING...' : 'RUN CRON AUDIT SCAN NOW'}</span>
            </button>
          </div>

          {/* Health Score Overview */}
          {plan ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div className="glass-surface" style={{ padding: '16px' }}>
                <span className="text-label-mono-sm color-muted">STABILITY_SCORE</span>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#00ff41', marginTop: '6px', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {plan.healthScore}%
                </div>
                <span className="text-label-mono-xs color-muted">
                  Audited: {new Date(plan.auditedAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="glass-surface" style={{ padding: '16px' }}>
                <span className="text-label-mono-sm color-muted">ERRORS_LAST_24H</span>
                <div style={{ fontSize: '28px', fontWeight: 800, color: plan.errors24h > 0 ? '#ff8533' : '#00ff41', marginTop: '6px', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {plan.errors24h}
                </div>
                <span className="text-label-mono-xs color-muted">
                  7-Day Total: {plan.errors7d} errors
                </span>
              </div>

              <div className="glass-surface" style={{ padding: '16px' }}>
                <span className="text-label-mono-sm color-muted">SEVERITY_BREAKDOWN</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#ff4444' }}>
                    FATAL: {plan.severityBreakdown.fatal}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#ff8533' }}>
                    ERR: {plan.severityBreakdown.error}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#ffd79b' }}>
                    WARN: {plan.severityBreakdown.warn}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-surface" style={{ padding: '24px', textAlign: 'center' }}>
              <span className="text-label-mono color-muted">Audit daemon is initializing... Click "RUN CRON AUDIT SCAN NOW" to generate plan.</span>
            </div>
          )}

          {/* Actionable Improvement Plan */}
          {plan && plan.improvementItems && (
            <div className="glass-surface" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span className="text-label-mono color-subtle">ACTIONABLE_REMEDIATION_PLAN</span>
                <span className="text-label-mono-sm color-positive">{plan.improvementItems.length} ACTIONS PLANNED</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {plan.improvementItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '3px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '2px',
                            background: item.priority === 'HIGH' ? 'rgba(255,68,68,0.2)' : 'rgba(0,255,65,0.1)',
                            color: item.priority === 'HIGH' ? '#ff4444' : '#00ff41',
                            border: item.priority === 'HIGH' ? '1px solid #ff4444' : '1px solid #00ff41',
                          }}
                        >
                          {item.priority}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
                          {item.issue}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          color: 'rgba(255,255,255,0.5)',
                        }}
                      >
                        [{item.category}] • {item.status}
                      </span>
                    </div>

                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                      💡 <strong style={{ color: '#fff' }}>Remediation:</strong> {item.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
