import { useAppStore } from '../hooks/useAppStore';
import { useSalaryStore } from '../hooks/useSalaryStore';
import { compareRegimes, type TaxInput } from '../../domains/tax/engine';
import { formatINR } from '../lib/currency';
import { useNavigate } from 'react-router-dom';

export function TaxWidget() {
  const navigate = useNavigate();
  const { currentFY, preferredRegime, setRegime, tradeItems } = useAppStore();
  const revisions = useSalaryStore((s) => s.revisions);
  const activeStructure = revisions[0] || null;

  const grossSalary = activeStructure?.ctcPaise || (activeStructure
    ? activeStructure.components.filter(c => c.type === 'earning').reduce((acc, c) => acc + (c.amountPaise * (c.applicableMonths?.length || 12)), 0)
    : 120000000); // Default 12L if not entered
  const tradingGains = tradeItems.reduce((acc, t) => acc + Math.max(0, t.realizedPnlPaise), 0);

  const taxInput: TaxInput = {
    salary: {
      basicPaise: Math.round(grossSalary * 0.5),
      hraPaise: 0,
      specialAllowancePaise: Math.round(grossSalary * 0.5),
      conveyancePaise: 0,
      ltaPaise: 0,
      bonusPaise: 0,
      otherTaxablePaise: 0,
      employerPfPaise: 0,
      professionTaxPaise: 0,
    },
    deductions: {
      section80C_paise: 0,
      section80D_paise: 0,
      section80E_paise: 0,
      section80TTA_paise: 0,
      homeLoanInterestPaise: 0,
      nps80CCD_paise: 0,
      otherDeductionsPaise: 0,
    },
    tdsDeductedPaise: 0,
    fy: currentFY || '2025-26',
    capitalGains: tradingGains > 0 ? {
      stcgPaise: tradingGains,
      ltcgPaise: 0,
      intradayPaise: 0,
      stcgTaxPaise: Math.round(tradingGains * 0.20),
      ltcgTaxPaise: 0,
      intradayTaxPaise: 0,
    } : undefined
  };

  const comparison = compareRegimes(taxInput);
  const activeTax = preferredRegime === 'old' ? comparison.oldRegime.totalTaxPaise : comparison.newRegime.totalTaxPaise;
  const savings = comparison.savingsPaise;
  const betterRegime = comparison.recommendation === 'old' ? 'OLD REGIME' : 'NEW REGIME';

  return (
    <div className="tax-widget-content">
      <div className="widget-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">ESTIMATED_TAX</span>
          <div className="text-data-display color-positive" style={{ fontSize: '18px', marginTop: '4px' }}>
            {formatINR(activeTax)}
          </div>
          <span className="text-label-mono-xs color-muted">FY {currentFY} ({preferredRegime.toUpperCase()})</span>
        </div>

        <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">REGIME_OPTIMIZER</span>
          <div className="text-data-display" style={{ fontSize: '14px', marginTop: '4px', color: '#ffd79b' }}>
            {betterRegime}
          </div>
          <span className="text-label-mono-xs color-positive">Saves {formatINR(savings)}</span>
        </div>

        {tradingGains > 0 && (
          <div className="stat-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-label-mono-sm color-muted">CAPITAL_GAINS</span>
            <div className="text-data-display color-positive" style={{ fontSize: '16px', marginTop: '4px' }}>
              {formatINR(tradingGains)}
            </div>
            <span className="text-label-mono-xs color-muted">Schedule CG pipeline</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['new', 'old', 'compare'] as const).map(reg => (
            <button
              key={reg}
              onClick={() => setRegime(reg)}
              style={{
                background: preferredRegime === reg ? 'var(--primary-container, #00ff41)' : 'rgba(255,255,255,0.04)',
                color: preferredRegime === reg ? '#000' : 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '3px 8px',
                fontSize: '10px',
                fontFamily: 'monospace',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '2px'
              }}
            >
              {reg.toUpperCase()}
            </button>
          ))}
        </div>

        <button 
          onClick={() => navigate('/tax')}
          style={{ background: 'none', border: 'none', color: 'var(--primary-container)', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
        >
          OPEN TAX ENGINE →
        </button>
      </div>
    </div>
  );
}
