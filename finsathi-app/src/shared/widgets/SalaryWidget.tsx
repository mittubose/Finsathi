import { useState } from 'react';
import { useSalaryStore } from '../hooks/useSalaryStore';
import { formatINR, toPaise, toRupees } from '../lib/currency';
import { useNavigate } from 'react-router-dom';

export function SalaryWidget() {
  const navigate = useNavigate();
  const { revisions, addRevision, updateRevision, calculateNet } = useSalaryStore();
  const [isEditing, setIsEditing] = useState(false);
  
  const activeStructure = revisions[0] || null;
  const annualGross = activeStructure?.ctcPaise || (activeStructure
    ? activeStructure.components.filter(c => c.type === 'earning').reduce((acc, c) => acc + (c.amountPaise * (c.applicableMonths?.length || 12)), 0)
    : 120000000);
  const [inputVal, setInputVal] = useState(toRupees(annualGross).toString());

  const now = new Date();
  const calculatedNet = activeStructure ? calculateNet(now.getFullYear(), now.getMonth()) : 0;
  const monthlyTakeHome = calculatedNet > 0 ? calculatedNet : Math.round(annualGross * 0.85 / 12);
  const stdDeductionPaise = 7500000; // FY25-26 budget 75k standard deduction

  const handleSave = () => {
    const paise = toPaise(Number(inputVal) || 0);
    const defaultComponents = [
      { id: crypto.randomUUID(), label: 'Basic Salary', amountPaise: Math.round(paise * 0.5 / 12), type: 'earning' as const, category: 'basic' as const },
      { id: crypto.randomUUID(), label: 'House Rent Allowance', amountPaise: Math.round(paise * 0.2 / 12), type: 'earning' as const, category: 'hra' as const },
      { id: crypto.randomUUID(), label: 'Special Allowance', amountPaise: Math.round(paise * 0.3 / 12), type: 'earning' as const, category: 'special_allowance' as const },
      { id: crypto.randomUUID(), label: 'Employee PF', amountPaise: Math.round(paise * 0.06 / 12), type: 'deduction' as const, category: 'pf' as const },
    ];

    if (activeStructure) {
      updateRevision(activeStructure.id, {
        ctcPaise: paise,
        components: defaultComponents
      });
    } else {
      addRevision({
        effectiveFrom: new Date().toISOString().slice(0, 10),
        companyName: 'Primary Employer',
        payCycleDay: 1,
        ctcPaise: paise,
        components: defaultComponents
      });
    }
    setIsEditing(false);
  };

  return (
    <div className="salary-widget-content">
      {isEditing ? (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
          <input
            type="number"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Annual Gross CTC (₹)"
            style={{
              flex: 1,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--primary-container)',
              padding: '6px 10px',
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '13px'
            }}
          />
          <button 
            onClick={handleSave}
            style={{
              background: 'var(--primary-container)',
              color: '#000',
              border: 'none',
              padding: '6px 12px',
              fontFamily: 'monospace',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            UPDATE
          </button>
          <button 
            onClick={() => setIsEditing(false)}
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '6px 10px',
              fontFamily: 'monospace',
              cursor: 'pointer'
            }}
          >
            CANCEL
          </button>
        </div>
      ) : (
        <div className="widget-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-label-mono-sm color-muted">ANNUAL_GROSS</span>
            <div className="text-data-display color-positive" style={{ fontSize: '18px', marginTop: '4px' }}>
              {formatINR(annualGross)}
            </div>
            <span className="text-label-mono-xs color-muted">CTC Pipeline Input</span>
          </div>

          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-label-mono-sm color-muted">EST_MONTHLY_NET</span>
            <div className="text-data-display" style={{ fontSize: '16px', marginTop: '4px', color: '#ffd79b' }}>
              {formatINR(monthlyTakeHome)}
            </div>
            <span className="text-label-mono-xs color-muted">Take-home per month</span>
          </div>

          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-label-mono-sm color-muted">STD_DEDUCTION</span>
            <div className="text-data-display" style={{ fontSize: '16px', marginTop: '4px', color: 'rgba(255,255,255,0.8)' }}>
              {formatINR(stdDeductionPaise)}
            </div>
            <span className="text-label-mono-xs color-positive">Sec 16(ia) Applied</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setIsEditing(true)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
        >
          ✎ QUICK EDIT CTC
        </button>

        <button 
          onClick={() => navigate('/salary')}
          style={{ background: 'none', border: 'none', color: 'var(--primary-container)', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
        >
          VIEW PAYSLIP BREAKDOWN →
        </button>
      </div>
    </div>
  );
}
