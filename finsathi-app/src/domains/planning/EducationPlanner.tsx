import React, { useState } from 'react';
import { useSettingsStore } from '../../shared/hooks/useSettingsStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { toPaise } from '../../shared/lib/currency';

export function EducationPlanner() {
  const { educationInflationRate, expectedEquityReturn } = useSettingsStore();
  
  const [currentCost, setCurrentCost] = useState('2000000'); // E.g. 20 Lakhs today
  const [yearsToCollege, setYearsToCollege] = useState('15');
  const [currentSaved, setCurrentSaved] = useState('0');

  const calculateRequiredSip = () => {
    const C = Number(currentCost) || 0;
    const Y = Number(yearsToCollege) || 0;
    const S = Number(currentSaved) || 0;
    
    const I = educationInflationRate / 100;
    const R = expectedEquityReturn / 100;

    // 1. Future Cost of Education
    const futureCost = C * Math.pow(1 + I, Y);

    // 2. Future Value of current savings
    const futureSavings = S * Math.pow(1 + R, Y);

    // 3. Shortfall
    const shortfall = Math.max(0, futureCost - futureSavings);

    // 4. Required monthly SIP to meet shortfall
    const r = R / 12; // Monthly return
    const n = Y * 12; // Total months
    
    let requiredSip = 0;
    if (n > 0 && r > 0) {
      requiredSip = shortfall / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
    }

    return {
      futureCostPaise: toPaise(futureCost),
      shortfallPaise: toPaise(shortfall),
      requiredSipPaise: toPaise(requiredSip)
    };
  };

  const plan = calculateRequiredSip();

  return (
    <div className="education-planner animate-in" style={{ padding: '24px' }}>
      <header className="ledger-header" style={{ marginBottom: '24px' }}>
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">EDUCATION_PLANNER</h1>
          <div className="status-line">
            <span className="pulse-dot" style={{ background: 'var(--accent)' }}></span>
            <span className="text-label-mono color-muted">KIDS_COLLEGE_FUNDING</span>
          </div>
        </div>
      </header>

      <div className="terminal-command-bar glass-surface-elevated" style={{ marginBottom: '24px' }}>
        <div className="cmd-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="cmd-input-group">
            <label>CURRENT_COST_OF_DEGREE (Rs)</label>
            <input type="number" value={currentCost} onChange={e => setCurrentCost(e.target.value)} />
          </div>
          <div className="cmd-input-group">
            <label>YEARS_TO_COLLEGE</label>
            <input type="number" value={yearsToCollege} onChange={e => setYearsToCollege(e.target.value)} />
          </div>
          <div className="cmd-input-group">
            <label>ALREADY_SAVED (Rs)</label>
            <input type="number" value={currentSaved} onChange={e => setCurrentSaved(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="glass-surface" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="text-label-mono color-muted">ASSUMPTIONS &gt; EDUCATION_INFLATION: {educationInflationRate}% | EQUITY_RETURN: {expectedEquityReturn}%</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          <div className="glass-card-header" style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-label-mono-sm color-muted" style={{ marginBottom: '8px' }}>FUTURE_COST_OF_EDUCATION</div>
            <div className="text-headline-lg" style={{ color: 'var(--error)' }}>
              <CurrencyValue paise={plan.futureCostPaise} />
            </div>
            <p className="text-body-sm color-subtle" style={{ marginTop: '8px' }}>Due to high education inflation, this is what you will need in {yearsToCollege} years.</p>
          </div>

          <div className="glass-card-header" style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-label-mono-sm color-muted" style={{ marginBottom: '8px' }}>PROJECTED_SHORTFALL</div>
            <div className="text-headline-lg" style={{ color: 'var(--warning)' }}>
              <CurrencyValue paise={plan.shortfallPaise} />
            </div>
            <p className="text-body-sm color-subtle" style={{ marginTop: '8px' }}>Gap between what you need and what your current savings will grow to.</p>
          </div>

          <div className="glass-card-header" style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--accent)' }}>
            <div className="text-label-mono-sm color-muted" style={{ marginBottom: '8px' }}>REQUIRED_MONTHLY_SIP</div>
            <div className="text-headline-lg" style={{ color: 'var(--accent)' }}>
              <CurrencyValue paise={plan.requiredSipPaise} />
            </div>
            <p className="text-body-sm color-subtle" style={{ marginTop: '8px' }}>Invest this amount monthly in an equity fund to meet your target.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
