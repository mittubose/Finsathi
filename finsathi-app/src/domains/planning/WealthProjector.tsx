import React, { useState } from 'react';
import { useSettingsStore } from '../../shared/hooks/useSettingsStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { toPaise } from '../../shared/lib/currency';

export function WealthProjector() {
  const { baseInflationRate, expectedEquityReturn } = useSettingsStore();
  
  const [currentSavings, setCurrentSavings] = useState('100000');
  const [monthlySip, setMonthlySip] = useState('10000');
  const [years, setYears] = useState('10');

  const calculateProjection = () => {
    const P = Number(currentSavings) || 0;
    const M = Number(monthlySip) || 0;
    const Y = Number(years) || 0;
    const R = expectedEquityReturn / 100;
    const I = baseInflationRate / 100;

    const n = Y * 12;
    const r = R / 12; // Monthly return rate

    // Future Value of Lumpsum
    const fvLumpsum = P * Math.pow(1 + R, Y);
    
    // Future Value of SIP
    const fvSip = M * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);

    const totalFv = fvLumpsum + fvSip;

    // Inflation adjusted value (Purchasing Power)
    const inflationAdjusted = totalFv / Math.pow(1 + I, Y);

    return {
      totalFvPaise: toPaise(totalFv),
      inflationAdjustedPaise: toPaise(inflationAdjusted)
    };
  };

  const projection = calculateProjection();

  return (
    <div className="wealth-projector animate-in" style={{ padding: '24px' }}>
      <header className="ledger-header" style={{ marginBottom: '24px' }}>
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">WEALTH_PROJECTOR</h1>
          <div className="status-line">
            <span className="pulse-dot" style={{ background: 'var(--positive)' }}></span>
            <span className="text-label-mono color-muted">COMPOUNDING_VS_INFLATION</span>
          </div>
        </div>
      </header>

      <div className="terminal-command-bar glass-surface-elevated" style={{ marginBottom: '24px' }}>
        <div className="cmd-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="cmd-input-group">
            <label>CURRENT_SAVINGS (Rs)</label>
            <input type="number" value={currentSavings} onChange={e => setCurrentSavings(e.target.value)} />
          </div>
          <div className="cmd-input-group">
            <label>MONTHLY_SIP (Rs)</label>
            <input type="number" value={monthlySip} onChange={e => setMonthlySip(e.target.value)} />
          </div>
          <div className="cmd-input-group">
            <label>TIME_HORIZON (YEARS)</label>
            <input type="number" value={years} onChange={e => setYears(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="glass-surface" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="text-label-mono color-muted">ASSUMPTIONS &gt; EQUITY_RETURN: {expectedEquityReturn}% | INFLATION: {baseInflationRate}%</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-card-header" style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-label-mono-sm color-muted" style={{ marginBottom: '8px' }}>FUTURE_VALUE_NOMINAL</div>
            <div className="text-headline-lg" style={{ color: 'var(--positive)' }}>
              <CurrencyValue paise={projection.totalFvPaise} />
            </div>
            <p className="text-body-sm color-subtle" style={{ marginTop: '8px' }}>Absolute number you will see in your bank account in {years} years.</p>
          </div>

          <div className="glass-card-header" style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-label-mono-sm color-muted" style={{ marginBottom: '8px' }}>PURCHASING_POWER_TODAY</div>
            <div className="text-headline-lg" style={{ color: 'var(--warning)' }}>
              <CurrencyValue paise={projection.inflationAdjustedPaise} />
            </div>
            <p className="text-body-sm color-subtle" style={{ marginTop: '8px' }}>What this money is actually worth in today's terms (adjusted for {baseInflationRate}% inflation).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
