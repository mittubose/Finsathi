import { useState } from 'react';
import { useAppStore, type ExpenseItem, type IncomeItem } from '../hooks/useAppStore';
import { formatINR, toPaise } from '../lib/currency';
import { useNavigate } from 'react-router-dom';

export function LedgerWidget() {
  const navigate = useNavigate();
  const { incomeItems, expenseItems, addExpense, addIncome, deleteExpense, deleteIncome, currentFY } = useAppStore();

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [txnType, setTxnType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [entity, setEntity] = useState('');
  const [category, setCategory] = useState('');

  const totalIncome = incomeItems.reduce((acc, i) => acc + i.amountPaise, 0);
  const totalExpense = expenseItems.reduce((acc, i) => acc + i.amountPaise, 0);
  const netSavings = totalIncome - totalExpense;

  const combinedRecent = [
    ...incomeItems.map(i => ({ ...i, sortDate: i.date || i.createdAt })),
    ...expenseItems.map(e => ({ ...e, sortDate: e.date || e.createdAt }))
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()).slice(0, 5);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !entity) return;

    const amountPaise = toPaise(Number(amount));
    const now = new Date().toISOString();
    const id = `${txnType}_${Date.now()}`;

    if (txnType === 'expense') {
      addExpense({
        id,
        type: 'expense',
        amountPaise,
        category: category || 'General',
        merchant: entity,
        notes: 'Quick logged from Dashboard widget',
        tags: [],
        date: now.split('T')[0],
        isRecurring: false,
        createdAt: now,
      });
    } else {
      addIncome({
        id,
        type: 'income',
        amountPaise,
        head: (category as any) || 'other',
        source: entity,
        fy: currentFY,
        isTaxable: true,
        notes: 'Quick logged from Dashboard widget',
        tags: [],
        date: now.split('T')[0],
        createdAt: now,
      });
    }

    setAmount('');
    setEntity('');
    setCategory('');
    setShowQuickAdd(false);
  };

  return (
    <div className="ledger-widget-content">
      {/* Cash Flow Summary */}
      <div className="widget-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">TOTAL_INFLOW</span>
          <div className="text-data-display color-positive" style={{ fontSize: '15px', marginTop: '4px' }}>
            +{formatINR(totalIncome)}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">TOTAL_OUTFLOW</span>
          <div className="text-data-display" style={{ fontSize: '15px', marginTop: '4px', color: 'rgba(255,255,255,0.7)' }}>
            -{formatINR(totalExpense)}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-label-mono-sm color-muted">NET_SAVINGS</span>
          <div className={`text-data-display ${netSavings >= 0 ? 'color-positive' : 'color-negative'}`} style={{ fontSize: '15px', marginTop: '4px' }}>
            {netSavings >= 0 ? '+' : ''}{formatINR(netSavings)}
          </div>
        </div>
      </div>

      {/* Quick Add Form */}
      {showQuickAdd ? (
        <form onSubmit={handleQuickSubmit} style={{ background: 'rgba(0,0,0,0.4)', padding: '10px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setTxnType('expense')}
              style={{
                flex: 1, padding: '4px', fontSize: '11px', fontFamily: 'monospace',
                background: txnType === 'expense' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: txnType === 'expense' ? '#fff' : 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              EXPENSE
            </button>
            <button
              type="button"
              onClick={() => setTxnType('income')}
              style={{
                flex: 1, padding: '4px', fontSize: '11px', fontFamily: 'monospace',
                background: txnType === 'income' ? 'var(--primary-container)' : 'transparent',
                color: txnType === 'income' ? '#000' : 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              INCOME
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <input
              type="number"
              placeholder="Amount (₹)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '6px', fontSize: '12px', fontFamily: 'monospace' }}
            />
            <input
              type="text"
              placeholder={txnType === 'expense' ? 'Merchant (e.g. Swiggy)' : 'Source (e.g. Client)'}
              value={entity}
              onChange={e => setEntity(e.target.value)}
              required
              style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '6px', fontSize: '12px', fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="submit" style={{ flex: 1, background: 'var(--primary-container)', color: '#000', border: 'none', padding: '6px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer' }}>
              RECORD TRANSACTION
            </button>
            <button type="button" onClick={() => setShowQuickAdd(false)} style={{ background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}>
              CANCEL
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            onClick={() => setShowQuickAdd(true)}
            style={{ background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.25)', color: 'var(--primary-container)', padding: '3px 8px', fontSize: '10px', fontFamily: 'monospace', cursor: 'pointer', borderRadius: '2px' }}
          >
            + QUICK ADD ENTRY
          </button>
        </div>
      )}

      {/* Recent Rows */}
      <div className="recent-tx-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {combinedRecent.map((tx) => (
          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span className="text-body-bold truncate" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                {'merchant' in tx ? tx.merchant : ('source' in tx ? tx.source : 'Record')}
              </span>
              <span className="text-label-mono-xs color-muted">
                {'category' in tx ? tx.category : ('head' in tx ? tx.head : '')} • {tx.sortDate}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`text-data-display ${tx.type === 'income' ? 'color-positive' : ''}`} style={{ fontSize: '13px' }}>
                {tx.type === 'income' ? '+' : '-'}{formatINR(tx.amountPaise)}
              </span>
              <button
                onClick={() => tx.type === 'income' ? deleteIncome(tx.id) : deleteExpense(tx.id)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: 0 }}
                title="Delete"
              >
                <span className="material-symbols-outlined icon-xs">close</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button 
          onClick={() => navigate('/ledger')}
          style={{ background: 'none', border: 'none', color: 'var(--primary-container)', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
        >
          VIEW FULL LEDGER →
        </button>
      </div>
    </div>
  );
}
