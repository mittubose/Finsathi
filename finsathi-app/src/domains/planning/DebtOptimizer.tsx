import React, { useState } from 'react';
import { usePlanningStore } from '../../shared/hooks/usePlanningStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { toPaise } from '../../shared/lib/currency';

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function DebtOptimizer() {
  const { loans, addLoan, deleteLoan } = usePlanningStore();
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');
  
  const handleAdd = () => {
    if (!name || !amount || !rate || !tenure) return;
    addLoan({
      id: generateId(),
      name,
      principalAmountPaise: toPaise(Number(amount)),
      interestRate: Number(rate),
      tenureMonths: Number(tenure),
      startDate: new Date().toISOString().split('T')[0]
    });
    setName('');
    setAmount('');
    setRate('');
    setTenure('');
  };

  // Basic EMI calc: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
  const calculateEMI = (principal: number, annualRate: number, months: number) => {
    if (!annualRate || !months) return 0;
    const monthlyRate = annualRate / 12 / 100;
    const p = principal / 100; // Rs
    const emi = p * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
    return Math.round(emi) * 100; // Back to paise
  };

  return (
    <div className="debt-optimizer animate-in" style={{ padding: '24px' }}>
      <header className="ledger-header" style={{ marginBottom: '24px' }}>
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">DEBT_OPTIMIZER</h1>
          <div className="status-line">
            <span className="pulse-dot" style={{ background: 'var(--warning)' }}></span>
            <span className="text-label-mono color-muted">LOAN_&_EMI_TRACKING</span>
          </div>
        </div>
      </header>

      <div className="terminal-command-bar glass-surface-elevated">
        <div className="cmd-prefix">ADD_LOAN &gt;</div>
        <div className="cmd-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="cmd-input-group">
            <label>LOAN_NAME</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Home Loan" />
          </div>
          <div className="cmd-input-group">
            <label>PRINCIPAL (Rs)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="cmd-input-group">
            <label>ANNUAL_RATE (%)</label>
            <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="8.5" />
          </div>
          <div className="cmd-input-group">
            <label>TENURE (MONTHS)</label>
            <input type="number" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="240" />
          </div>
        </div>
        <button className="cmd-execute" onClick={handleAdd}>EXECUTE</button>
      </div>

      <div className="ledger-scroll-area glass-surface" style={{ marginTop: '24px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loans.length === 0 && <span className="text-label-mono-sm color-muted">No active loans found.</span>}
        
        {loans.map(loan => {
          const emiPaise = calculateEMI(loan.principalAmountPaise, loan.interestRate, loan.tenureMonths);
          const totalPaid = emiPaise * loan.tenureMonths;
          const totalInterest = totalPaid - loan.principalAmountPaise;

          return (
            <div key={loan.id} className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderLeft: '4px solid var(--warning)' }}>
              <div>
                <div className="text-data-display">{loan.name}</div>
                <div className="text-label-mono-sm color-muted">
                  {loan.interestRate}% | {loan.tenureMonths} Months
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-label-mono-sm color-muted">MONTHLY_EMI</div>
                <div className="text-data-display" style={{ color: 'var(--warning)' }}><CurrencyValue paise={emiPaise} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-label-mono-sm color-muted">TOTAL_INTEREST</div>
                <div className="text-data-display" style={{ color: 'var(--error)' }}><CurrencyValue paise={totalInterest} /></div>
              </div>
              <button className="tool-icon-btn" style={{ color: 'var(--error)' }} onClick={() => deleteLoan(loan.id)}>
                <span className="material-symbols-outlined icon-sm">delete</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
