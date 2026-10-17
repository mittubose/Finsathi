import { useState, useMemo } from 'react';
import { useAppStore } from '../../../shared/hooks/useAppStore';
import { computeScheduleOS, generatePortalFieldMappings, type OtherSourceEntry } from '../itr3Engine';
import { InfoTooltip } from '../../../shared/ui/InfoTooltip';
import './schedules.css';

export function ScheduleOS() {
  const currentFY = useAppStore(s => s.currentFY);
  const itr3Data = useAppStore(s => s.itr3Data);
  const addOtherSource = useAppStore(s => s.addOtherSource);
  const deleteOtherSource = useAppStore(s => s.deleteOtherSource);
  const privacyMode = useAppStore(s => s.privacyMode);

  const [newOS, setNewOS] = useState<Partial<OtherSourceEntry>>({
    type: 'fd_interest',
    amountPaise: 0,
    tdsPaidPaise: 0,
    source: '',
  });

  const scheduleOS = useMemo(() => computeScheduleOS(itr3Data.otherSourceIncome), [itr3Data.otherSourceIncome]);

  const portalMappings = useMemo(() => {
    return generatePortalFieldMappings({
      assessmentYear: '',
      financialYear: currentFY,
      filingSection: '139(1)',
      form10IEA: { filed: false, regime: 'new' },
      scheduleCG: { preSplit: {} as any, postSplit: {} as any, assumptions: [], tradeResults: [] } as any,
      scheduleBP: { totalTurnoverPaise: 0 } as any,
      scheduleHP: { totalIncomePaise: 0 } as any,
      scheduleOS,
      scheduleVIA: { totalAllowedPaise: 0 } as any,
      totalIncomePaise: 0,
      totalTaxPaise: 0,
      totalTDSPaise: 0,
      balanceTaxPaise: 0,
    }).filter(m => m.scheduleName === 'Schedule OS');
  }, [scheduleOS, currentFY]);

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
  const displayVal = (paise: number) => privacyMode ? '₹ •••••' : fmt(paise);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOS.amountPaise) return;
    addOtherSource({
      id: crypto.randomUUID(),
      type: newOS.type as any,
      amountPaise: newOS.amountPaise || 0,
      tdsPaidPaise: newOS.tdsPaidPaise || 0,
      source: newOS.source || 'Other',
    });
    setNewOS({
      type: 'fd_interest',
      amountPaise: 0,
      tdsPaidPaise: 0,
      source: '',
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <h1 className="schedule-page-title">SCHEDULE OS</h1>
          <div className="schedule-page-subtitle">Income from Other Sources</div>
        </div>
        <div className="wizard-fy-badge">FY {currentFY}</div>
      </div>

      <div className="schedule-section">
        <div className="schedule-section-title" style={{ display: 'flex', alignItems: 'center' }}>
          OTHER INCOME SOURCES
          <InfoTooltip 
            title="Other Sources" 
            description="Any income that does not fall under Salary, Business, House Property, or Capital Gains."
            dateContext="Received/accrued between 1st April and 31st March."
            example="Includes FD interest, savings bank interest, dividends, gifts above ₹50,000 from non-relatives."
          />
        </div>
        
        {itr3Data.otherSourceIncome.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {itr3Data.otherSourceIncome.map((os) => (
              <div key={os.id} className="portal-mapping-item">
                <div>
                  <span className="asset-badge" style={{ marginRight: '8px', borderColor: '#fbbc04', color: '#fbbc04', background: 'rgba(251,188,4,0.1)' }}>
                    {os.type.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="schedule-field-label" style={{ display: 'inline' }}>{os.source}</span>
                  {os.tdsPaidPaise > 0 && (
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                      TDS: {displayVal(os.tdsPaidPaise)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="schedule-field-value" style={{ color: '#00ff41' }}>{displayVal(os.amountPaise)}</span>
                  <button className="field-copy-btn" onClick={() => deleteOtherSource(os.id)}>
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: '#ffb4ab' }}>delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="schedule-grid" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '8px', gridColumn: '1 / -1', flexWrap: 'wrap' }}>
            <select 
              className="wizard-select" 
              value={newOS.type} 
              onChange={e => setNewOS({...newOS, type: e.target.value as any})}
            >
              <option value="fd_interest">FD Interest</option>
              <option value="savings_interest">Savings Interest (Sec 80TTA)</option>
              <option value="dividend">Dividend Income</option>
              <option value="gift">Gift</option>
              <option value="other">Other</option>
            </select>
            <input 
              type="text" 
              className="wizard-select" 
              style={{ flex: 1, minWidth: '150px' }} 
              placeholder="Source description" 
              value={newOS.source}
              onChange={e => setNewOS({...newOS, source: e.target.value})}
            />
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '120px' }} 
              placeholder="Amount (₹)" 
              value={newOS.amountPaise ? newOS.amountPaise / 100 : ''}
              onChange={e => setNewOS({...newOS, amountPaise: (parseFloat(e.target.value) || 0) * 100})}
            />
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '120px' }} 
              placeholder="TDS (₹)" 
              value={newOS.tdsPaidPaise ? newOS.tdsPaidPaise / 100 : ''}
              onChange={e => setNewOS({...newOS, tdsPaidPaise: (parseFloat(e.target.value) || 0) * 100})}
            />
            <button type="submit" className="wizard-nav-btn primary" style={{ padding: '8px 16px' }}>Add</button>
          </div>
        </form>
      </div>

      <div className="schedule-summary">
        <div className="schedule-summary-row">
          <span className="schedule-field-label">TOTAL INCOME FROM OTHER SOURCES</span>
          <span className="schedule-field-value" style={{ fontSize: '24px', color: '#00ff41' }}>
            {displayVal(scheduleOS.totalIncomePaise)}
          </span>
        </div>
        <div className="schedule-summary-row" style={{ marginTop: '8px' }}>
          <span className="schedule-field-label">TOTAL TDS DEDUCTED ON OTHER SOURCES</span>
          <span className="schedule-field-value" style={{ color: '#e2e2e2' }}>
            {displayVal(scheduleOS.totalTDSPaise)}
          </span>
        </div>
      </div>

      {portalMappings.length > 0 && (
        <div className="portal-mapping" style={{ marginTop: '24px' }}>
          <div className="portal-mapping-title">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '18px' }}>content_copy</span>
            PORTAL FIELD MAPPING
          </div>
          {portalMappings.map((m, i) => (
            <div key={i} className="portal-mapping-item">
              <div>
                <div className="schedule-field-label">{m.fieldLabel}</div>
                <div className="schedule-field-portal" style={{ marginTop: '4px' }}>
                  Portal: {m.portalFieldName}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="schedule-field-value">
                  {privacyMode ? '₹ •••••' : m.displayValue}
                </span>
                <button
                  className="field-copy-btn"
                  onClick={() => copyToClipboard(String(m.value / 100))}
                  title="Copy value"
                >
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px' }}>content_copy</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
