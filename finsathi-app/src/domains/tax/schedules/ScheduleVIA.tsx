import { useState, useMemo } from 'react';
import { useAppStore } from '../../../shared/hooks/useAppStore';
import { computeScheduleVIA, type DeductionEntry } from '../itr3Engine';
import { InfoTooltip } from '../../../shared/ui/InfoTooltip';
import './schedules.css';

export function ScheduleVIA() {
  const currentFY = useAppStore(s => s.currentFY);
  const itr3Data = useAppStore(s => s.itr3Data);
  const preferredRegime = useAppStore(s => s.preferredRegime);
  const addDeduction = useAppStore(s => s.addDeduction);
  const deleteDeduction = useAppStore(s => s.deleteDeduction);
  const privacyMode = useAppStore(s => s.privacyMode);

  const [newDed, setNewDed] = useState<Partial<DeductionEntry>>({
    section: '80C',
    amountPaise: 0,
    notes: '',
  });

  const regime = preferredRegime === 'compare' ? 'old' : preferredRegime;
  const scheduleVIA = useMemo(() => computeScheduleVIA(itr3Data.deductionEntries, regime), [itr3Data.deductionEntries, regime]);

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
  const displayVal = (paise: number) => privacyMode ? '₹ •••••' : fmt(paise);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDed.amountPaise) return;
    
    // Determine eligibility based on section
    const regimeEligibility = newDed.section === '80CCD2' ? 'both' : 'old_only';
    
    addDeduction({
      id: crypto.randomUUID(),
      section: newDed.section as any,
      amountPaise: newDed.amountPaise || 0,
      limitPaise: 0, // Assigned by engine
      proofStatus: 'pending',
      regimeEligibility,
      notes: newDed.notes || '',
    });
    
    setNewDed({
      section: '80C',
      amountPaise: 0,
      notes: '',
    });
  };

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <h1 className="schedule-page-title">SCHEDULE VI-A</h1>
          <div className="schedule-page-subtitle">Deductions under Chapter VI-A</div>
        </div>
        <div className="wizard-fy-badge">FY {currentFY}</div>
      </div>

      {regime === 'new' && (
        <div className="audit-warning">
          <span className="material-symbols-outlined" aria-hidden="true">info</span>
          <strong>NEW REGIME SELECTED:</strong> Most Chapter VI-A deductions are disabled. Only Section 80CCD(2) is available.
        </div>
      )}

      <div className="schedule-section">
        <div className="schedule-section-title" style={{ display: 'flex', alignItems: 'center' }}>
          YOUR DEDUCTIONS
          <InfoTooltip 
            title="Chapter VI-A Deductions" 
            description="Investments or expenses that can reduce your taxable income. Most are only applicable if you opt for the Old Tax Regime."
            dateContext="Investments made between 1st April and 31st March of the financial year."
            example="If you invested ₹1.5L in PPF, enter it under 80C to save tax."
          />
        </div>
        
        {itr3Data.deductionEntries.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {itr3Data.deductionEntries.map((ded) => {
              const isAllowed = regime === 'old' || ded.regimeEligibility === 'both';
              return (
                <div key={ded.id} className="portal-mapping-item" style={{ opacity: isAllowed ? 1 : 0.5 }}>
                  <div>
                    <span className="asset-badge" style={{ marginRight: '8px', borderColor: '#8ab4f8', color: '#8ab4f8', background: 'rgba(138,180,248,0.1)' }}>
                      {ded.section}
                    </span>
                    <span className="schedule-field-label" style={{ display: 'inline' }}>
                      {ded.notes || 'Deduction Entry'}
                    </span>
                    {!isAllowed && (
                      <div style={{ fontSize: '10px', color: '#ffb4ab', marginTop: '4px' }}>
                        Not applicable in New Regime
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="schedule-field-value" style={{ color: isAllowed ? '#e2e2e2' : 'rgba(255,255,255,0.4)' }}>
                      {displayVal(ded.amountPaise)}
                    </span>
                    <button className="field-copy-btn" onClick={() => deleteDeduction(ded.id)}>
                      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: '#ffb4ab' }}>delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleAdd} className="schedule-grid" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '8px', gridColumn: '1 / -1', flexWrap: 'wrap' }}>
            <select 
              className="wizard-select" 
              value={newDed.section} 
              onChange={e => setNewDed({...newDed, section: e.target.value as any})}
            >
              <option value="80C">80C (PPF, ELSS, EPF, LIC)</option>
              <option value="80D">80D (Health Insurance)</option>
              <option value="80CCD1B">80CCD(1B) (Additional NPS ₹50k)</option>
              <option value="80CCD2">80CCD(2) (Employer NPS)</option>
              <option value="80TTA">80TTA (Savings Interest)</option>
              <option value="80G">80G (Donations)</option>
              <option value="80E">80E (Education Loan Interest)</option>
              <option value="80EEA">80EEA (Affordable Housing Int)</option>
            </select>
            <input 
              type="text" 
              className="wizard-select" 
              style={{ flex: 1, minWidth: '150px' }} 
              placeholder="Description / Notes" 
              value={newDed.notes}
              onChange={e => setNewDed({...newDed, notes: e.target.value})}
            />
            <input 
              type="number" 
              className="wizard-select" 
              style={{ width: '120px' }} 
              placeholder="Amount (₹)" 
              value={newDed.amountPaise ? newDed.amountPaise / 100 : ''}
              onChange={e => setNewDed({...newDed, amountPaise: (parseFloat(e.target.value) || 0) * 100})}
            />
            <button type="submit" className="wizard-nav-btn primary" style={{ padding: '8px 16px' }}>Add</button>
          </div>
        </form>
      </div>

      <div className="schedule-summary">
        <div className="schedule-summary-row">
          <span className="schedule-field-label">
            TOTAL ALLOWABLE DEDUCTIONS (After Limits)
            <InfoTooltip 
              title="Allowable Deductions" 
              description="The final amount you can claim after applying income tax rules (like the max ₹1.5L limit for 80C)."
            />
          </span>
          <span className="schedule-field-value" style={{ fontSize: '24px', color: '#00ff41' }}>
            {displayVal(scheduleVIA.totalAllowedPaise)}
          </span>
        </div>
      </div>

      <div className="assumption-list" style={{ marginTop: '24px' }}>
        <div className="schedule-section-title">NOTES & ASSUMPTIONS</div>
        <div className="assumption-item">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
          {scheduleVIA.regimeNote}
        </div>
        <div className="assumption-item">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
          80C, 80CCC, and 80CCD(1) are subject to an aggregate limit of ₹1,50,000.
        </div>
        <div className="assumption-item">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>circle</span>
          Ensure you have valid proofs (receipts, statements) for all deductions claimed.
        </div>
      </div>
    </div>
  );
}
