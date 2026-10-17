import React, { useState, useEffect } from 'react';
import { getAnalyticsSummary, clearAnalytics, type AnalyticsSummary } from '../../shared/lib/apiAnalytics';
import { useToast } from '../../shared/ui/Toast';

export function ApiAnalyticsView() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<AnalyticsSummary>(getAnalyticsSummary());

  const refresh = () => {
    setSummary(getAnalyticsSummary());
  };

  const handleClear = () => {
    clearAnalytics();
    setSummary(getAnalyticsSummary());
    toast('API telemetry log cleared', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Privacy Guarantee Header */}
      <div 
        style={{
          padding: '12px 16px',
          background: 'rgba(0, 255, 65, 0.05)',
          border: '1px solid rgba(0, 255, 65, 0.25)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary-container, #00ff41)', fontSize: '20px' }}>
            verified_user
          </span>
          <span className="text-label-mono-sm" style={{ color: '#fff' }}>
            100% PRIVATE • ZERO OUTBOUND CLOUD PINGS • STRICT LOCAL METRICS
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="settings-action-btn" onClick={refresh} style={{ fontSize: '11px', padding: '3px 8px' }}>
            REFRESH ↺
          </button>
          <button className="settings-action-btn settings-action-btn--danger" onClick={handleClear} style={{ fontSize: '11px', padding: '3px 8px' }}>
            CLEAR LOG
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="glass-surface" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-label-mono-xs color-muted">TOTAL API & OCR CALLS</span>
          <div className="text-headline-md" style={{ marginTop: '6px' }}>{summary.totalCalls}</div>
          <span className="text-label-mono-xs color-muted">Executed on laptop</span>
        </div>

        <div className="glass-surface" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-label-mono-xs color-muted">AVERAGE LATENCY</span>
          <div className="text-headline-md color-positive" style={{ marginTop: '6px' }}>
            {summary.avgLatencyMs} <span style={{ fontSize: '14px' }}>ms</span>
          </div>
          <span className="text-label-mono-xs color-muted">Zero network roundtrips</span>
        </div>

        <div className="glass-surface" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-label-mono-xs color-muted">SUCCESS / FALLBACK RATE</span>
          <div className="text-headline-md color-positive" style={{ marginTop: '6px' }}>
            {summary.successRatePct}%
          </div>
          <span className="text-label-mono-xs color-muted">Graceful local resilience</span>
        </div>

        <div className="glass-surface" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-label-mono-xs color-muted">DETERMINISTIC FALLBACKS</span>
          <div className="text-headline-md" style={{ marginTop: '6px' }}>
            {summary.fallbackCount}
          </div>
          <span className="text-label-mono-xs color-muted">Offline regex copilot saves</span>
        </div>
      </div>

      {/* Endpoint Calls Breakdown */}
      <div className="glass-surface" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-label-mono-sm color-muted">BREAKDOWN BY CAPABILITY</span>
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(summary.callsByEndpoint).length === 0 ? (
            <div className="text-label-mono-xs color-muted" style={{ padding: '8px 0' }}>
              No API calls recorded yet. Query the AI Assistant or upload a receipt to generate telemetry.
            </div>
          ) : (
            Object.entries(summary.callsByEndpoint).map(([endpoint, count]) => {
              const pct = Math.round((count / Math.max(1, summary.totalCalls)) * 100);
              return (
                <div key={endpoint} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'monospace' }}>
                    <span style={{ color: '#fff' }}>{endpoint.toUpperCase()}</span>
                    <span style={{ color: 'var(--primary-container, #00ff41)' }}>{count} calls ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary-container, #00ff41)' }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent API Call Log */}
      <div className="glass-surface" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-label-mono-sm color-muted">RECENT 10 API CALLS (DEVICE AUDIT)</span>
        <div style={{ marginTop: '12px', overflowX: 'auto' }}>
          {summary.recentCalls.length === 0 ? (
            <div className="text-label-mono-xs color-muted" style={{ padding: '8px 0' }}>
              No recent calls recorded.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                  <th style={{ padding: '6px 8px' }}>TIMESTAMP</th>
                  <th style={{ padding: '6px 8px' }}>ENDPOINT</th>
                  <th style={{ padding: '6px 8px' }}>TARGET / FILE</th>
                  <th style={{ padding: '6px 8px' }}>LATENCY</th>
                  <th style={{ padding: '6px 8px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentCalls.map((call) => (
                  <tr key={call.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.7)' }}>
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#fff', fontWeight: 600 }}>
                      {call.endpoint}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.8)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {call.target}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--primary-container, #00ff41)' }}>
                      {call.durationMs}ms
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span 
                        style={{
                          padding: '1px 6px',
                          borderRadius: '2px',
                          fontSize: '10px',
                          background: call.status === 'success' ? 'rgba(0,255,65,0.15)' : call.status === 'fallback' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                          color: call.status === 'success' ? 'var(--positive, #00ff41)' : call.status === 'fallback' ? 'var(--warning, #eab308)' : 'var(--error, #ef4444)',
                        }}
                      >
                        {call.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
