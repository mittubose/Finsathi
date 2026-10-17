import React, { useState } from 'react';
import { usePlanningStore, type BudgetBucket } from '../../shared/hooks/usePlanningStore';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { toPaise } from '../../shared/lib/currency';

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function BudgetBuckets() {
  const { buckets, addBucket, deleteBucket } = usePlanningStore();
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [color, setColor] = useState('var(--positive)');

  const handleAdd = () => {
    if (!name || !amount) return;
    addBucket({
      id: generateId(),
      name,
      allocatedPaise: toPaise(Number(amount)),
      color
    });
    setName('');
    setAmount('');
  };

  const totalAllocated = buckets.reduce((acc, b) => acc + b.allocatedPaise, 0);

  return (
    <div className="budget-buckets animate-in" style={{ padding: '24px' }}>
      <header className="ledger-header" style={{ marginBottom: '24px' }}>
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">BUDGET_BUCKETS</h1>
          <div className="status-line">
            <span className="pulse-dot" style={{ background: 'var(--positive)' }}></span>
            <span className="text-label-mono color-muted">ENVELOPE_ALLOCATION_SYSTEM</span>
          </div>
        </div>
      </header>

      <div className="terminal-command-bar glass-surface-elevated">
        <div className="cmd-prefix">ADD_BUCKET &gt;</div>
        <div className="cmd-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="cmd-input-group">
            <label>BUCKET_NAME</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Needs, Vacations" />
          </div>
          <div className="cmd-input-group">
            <label>ALLOCATED_AMOUNT (Rs)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="cmd-input-group">
            <label>COLOR_THEME</label>
            <select value={color} onChange={e => setColor(e.target.value)}>
              <option value="var(--positive)">Green (Positive)</option>
              <option value="var(--warning)">Yellow (Warning)</option>
              <option value="var(--error)">Red (Error)</option>
              <option value="var(--accent)">Blue (Accent)</option>
            </select>
          </div>
        </div>
        <button className="cmd-execute" onClick={handleAdd}>EXECUTE</button>
      </div>

      <div className="glass-surface" style={{ marginTop: '24px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="text-label-mono-sm color-muted" style={{ marginBottom: '16px' }}>TOTAL_ALLOCATED: <CurrencyValue paise={totalAllocated} /></div>
        
        {buckets.map(bucket => (
          <div key={bucket.id} className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderLeft: `4px solid ${bucket.color}` }}>
            <div>
              <div className="text-data-display" style={{ color: bucket.color }}>{bucket.name}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="text-data-display"><CurrencyValue paise={bucket.allocatedPaise} /></div>
              <button className="tool-icon-btn" style={{ color: 'var(--error)' }} onClick={() => deleteBucket(bucket.id)}>
                <span className="material-symbols-outlined icon-sm">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
