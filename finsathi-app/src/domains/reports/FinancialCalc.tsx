import React, { useState, useMemo } from 'react';
import { formatINR } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import './FinancialCalc.css';

type CalcType = 'sip' | 'loan' | 'savings';

export function FinancialCalc() {
  const [type, setType] = useState<CalcType>('sip');
  
  // SIP State
  const [sipAmount, setSipAmount] = useState(10000);
  const [sipRate, setSipRate] = useState(12);
  const [sipYears, setSipYears] = useState(10);
  
  // Loan State
  const [loanAmount, setLoanAmount] = useState(5000000);
  const [loanRate, setLoanRate] = useState(8.5);
  const [loanYears, setLoanYears] = useState(20);
  
  // Savings State
  const [goalAmount, setGoalAmount] = useState(1000000);
  const [goalRate, setGoalRate] = useState(8);
  const [goalYears, setGoalYears] = useState(5);

  const sipResult = useMemo(() => {
    const p = sipAmount;
    const r = sipRate / 100 / 12;
    const n = sipYears * 12;
    const futureValue = p * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const invested = p * n;
    return { invested: Math.round(invested), wealth: Math.round(futureValue - invested), total: Math.round(futureValue) };
  }, [sipAmount, sipRate, sipYears]);

  const loanResult = useMemo(() => {
    const p = loanAmount;
    const r = loanRate / 100 / 12;
    const n = loanYears * 12;
    const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayable = emi * n;
    return { emi: Math.round(emi), interest: Math.round(totalPayable - p), total: Math.round(totalPayable) };
  }, [loanAmount, loanRate, loanYears]);

  const savingsResult = useMemo(() => {
    const fv = goalAmount;
    const r = goalRate / 100 / 12;
    const n = goalYears * 12;
    const sipRequired = (fv * r) / ((Math.pow(1 + r, n) - 1) * (1 + r));
    return { sipRequired: Math.round(sipRequired) };
  }, [goalAmount, goalRate, goalYears]);

  return (
    <div className="calc-container animate-in">
      <header className="calc-header">
        <h1 className="text-headline-md">FINANCIAL_CALCULATORS</h1>
        <p className="text-body-sm color-muted">Deterministic modeling for tactical goal execution</p>
      </header>

      <div className="calc-tabs">
        <button className={`calc-tab ${type === 'sip' ? 'active' : ''}`} onClick={() => setType('sip')}>
          <span className="material-symbols-outlined">trending_up</span> SIP_GROWTH
        </button>
        <button className={`calc-tab ${type === 'loan' ? 'active' : ''}`} onClick={() => setType('loan')}>
          <span className="material-symbols-outlined">account_balance</span> LOAN_EMI
        </button>
        <button className={`calc-tab ${type === 'savings' ? 'active' : ''}`} onClick={() => setType('savings')}>
          <span className="material-symbols-outlined">ads_click</span> SAVINGS_GOAL
        </button>
      </div>

      <div className="calc-content">
        <div className="glass-surface calc-inputs">
          {type === 'sip' && (
            <>
              <div className="calc-field">
                <label className="text-label-mono-sm">MONTHLY_SIP_AMOUNT</label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input type="number" value={sipAmount} onChange={e => setSipAmount(Number(e.target.value))} />
                </div>
                <input type="range" min="500" max="1000000" step="500" value={sipAmount} onChange={e => setSipAmount(Number(e.target.value))} />
              </div>
              <div className="calc-field">
                <label className="text-label-mono-sm">RETURN_RATE (%)</label>
                <div className="calc-input-wrapper">
                  <input type="number" value={sipRate} onChange={e => setSipRate(Number(e.target.value))} />
                  <span className="calc-input-prefix">%</span>
                </div>
                <input type="range" min="1" max="30" step="0.5" value={sipRate} onChange={e => setSipRate(Number(e.target.value))} />
              </div>
              <div className="calc-field">
                <label className="text-label-mono-sm">PERIOD (YEARS)</label>
                <div className="calc-input-wrapper">
                  <input type="number" value={sipYears} onChange={e => setSipYears(Number(e.target.value))} />
                  <span className="calc-input-prefix">Y</span>
                </div>
                <input type="range" min="1" max="40" step="1" value={sipYears} onChange={e => setSipYears(Number(e.target.value))} />
              </div>
            </>
          )}

          {type === 'loan' && (
            <>
              <div className="calc-field">
                <label className="text-label-mono-sm">LOAN_AMOUNT</label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input type="number" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} />
                </div>
                <input type="range" min="100000" max="50000000" step="100000" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} />
              </div>
              <div className="calc-field">
                <label className="text-label-mono-sm">INTEREST_RATE (%)</label>
                <div className="calc-input-wrapper">
                  <input type="number" value={loanRate} onChange={e => setLoanRate(Number(e.target.value))} />
                  <span className="calc-input-prefix">%</span>
                </div>
                <input type="range" min="1" max="20" step="0.1" value={loanRate} onChange={e => setLoanRate(Number(e.target.value))} />
              </div>
              <div className="calc-field">
                <label className="text-label-mono-sm">TENURE (YEARS)</label>
                <div className="calc-input-wrapper">
                  <input type="number" value={loanYears} onChange={e => setLoanYears(Number(e.target.value))} />
                  <span className="calc-input-prefix">Y</span>
                </div>
                <input type="range" min="1" max="30" step="1" value={loanYears} onChange={e => setLoanYears(Number(e.target.value))} />
              </div>
            </>
          )}

          {type === 'savings' && (
            <>
              <div className="calc-field">
                <label className="text-label-mono-sm">TARGET_GOAL_AMOUNT</label>
                <div className="calc-input-wrapper">
                  <span className="calc-input-prefix">₹</span>
                  <input type="number" value={goalAmount} onChange={e => setGoalAmount(Number(e.target.value))} />
                </div>
                <input type="range" min="10000" max="100000000" step="50000" value={goalAmount} onChange={e => setGoalAmount(Number(e.target.value))} />
              </div>
              <div className="calc-field">
                <label className="text-label-mono-sm">EXPECTED_RETURN (%)</label>
                <div className="calc-input-wrapper">
                  <input type="number" value={goalRate} onChange={e => setGoalRate(Number(e.target.value))} />
                  <span className="calc-input-prefix">%</span>
                </div>
                <input type="range" min="1" max="30" step="0.5" value={goalRate} onChange={e => setGoalRate(Number(e.target.value))} />
              </div>
              <div className="calc-field">
                <label className="text-label-mono-sm">TIME_HORIZON (YEARS)</label>
                <div className="calc-input-wrapper">
                  <input type="number" value={goalYears} onChange={e => setGoalYears(Number(e.target.value))} />
                  <span className="calc-input-prefix">Y</span>
                </div>
                <input type="range" min="1" max="40" step="1" value={goalYears} onChange={e => setGoalYears(Number(e.target.value))} />
              </div>
            </>
          )}
        </div>

        <div className="calc-results">
          {type === 'sip' && (
            <div className="glass-surface result-card">
              <div className="result-main">
                <span className="text-label-mono-sm color-muted">ESTIMATED_WEALTH_AT_MATURITY</span>
                <h2 className="text-headline-lg color-positive">
                  <CurrencyValue paise={sipResult.total * 100} />
                </h2>
              </div>
              <div className="result-grid">
                <div className="result-item">
                  <span className="text-label-mono-sm color-subtle">TOTAL_INVESTED</span>
                  <p className="text-body-lg"><CurrencyValue paise={sipResult.invested * 100} /></p>
                </div>
                <div className="result-item">
                  <span className="text-label-mono-sm color-subtle">ESTIMATED_GAINS</span>
                  <p className="text-body-lg color-positive">+<CurrencyValue paise={sipResult.wealth * 100} /></p>
                </div>
              </div>
              <div className="result-footer">
                <span className="insight-tag">Compound Power</span>
                <span className="insight-tag">Inflation Adjusted: NO</span>
              </div>
            </div>
          )}

          {type === 'loan' && (
            <div className="glass-surface result-card">
              <div className="result-main">
                <span className="text-label-mono-sm color-muted">MONTHLY_EMI_OUTFLOW</span>
                <h2 className="text-headline-lg color-info">
                  <CurrencyValue paise={loanResult.emi * 100} />
                </h2>
              </div>
              <div className="result-grid">
                <div className="result-item">
                  <span className="text-label-mono-sm color-subtle">PRINCIPAL_BORROWED</span>
                  <p className="text-body-lg"><CurrencyValue paise={loanAmount * 100} /></p>
                </div>
                <div className="result-item">
                  <span className="text-label-mono-sm color-subtle">TOTAL_INTEREST_COST</span>
                  <p className="text-body-lg color-negative">-<CurrencyValue paise={loanResult.interest * 100} /></p>
                </div>
              </div>
              <div className="result-footer">
                <span className="insight-tag">Amortization Optimized</span>
                <span className="insight-tag">Cost of Debt: {loanRate}%</span>
              </div>
            </div>
          )}

          {type === 'savings' && (
            <div className="glass-surface result-card">
              <div className="result-main">
                <span className="text-label-mono-sm color-muted">REQUIRED_MONTHLY_COMMITMENT</span>
                <h2 className="text-headline-lg color-warning">
                  <CurrencyValue paise={savingsResult.sipRequired * 100} />
                </h2>
              </div>
              <div className="result-grid">
                <div className="result-item">
                  <span className="text-label-mono-sm color-subtle">TARGET_ACCUMULATION</span>
                  <p className="text-body-lg"><CurrencyValue paise={goalAmount * 100} /></p>
                </div>
                <div className="result-item">
                  <span className="text-label-mono-sm color-subtle">TIME_HORIZON</span>
                  <p className="text-body-lg">{goalYears} YEARS</p>
                </div>
              </div>
              <div className="result-footer">
                <span className="insight-tag">Goal Seeking</span>
                <span className="insight-tag">Backwards Modeling</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
