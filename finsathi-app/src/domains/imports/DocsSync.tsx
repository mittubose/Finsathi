import React, { useState } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { parsePastedHtml } from './docsParser';
import type { ParsedDocMonth, ParsedDocItem } from './docsParser';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const resolveCategory = (item: ParsedDocItem): string => {
  if (item.category) return item.category;
  if (item.type === 'loan') return 'Loan Repayment';
  if (item.type === 'expense') {
    const nameLower = item.name.toLowerCase();
    if (nameLower.includes('zerodha') || nameLower.includes('zeroda') || nameLower.includes('groww') || nameLower.includes('ksfe')) {
      return 'Savings';
    }
    if (nameLower.includes('electricity') || nameLower.includes('kwa') || nameLower.includes('broadband') || nameLower.includes('jio') || nameLower.includes('bsnl')) {
      return 'Utilities';
    }
    if (nameLower.includes('travel') || nameLower.includes('bus') || nameLower.includes('petrol')) {
      return 'Travel';
    }
    if (nameLower.includes('insurance')) {
      return 'Insurance';
    }
    if (nameLower.includes('hospital')) {
      return 'Health';
    }
  }
  return 'Other';
};

const getCategoryIcon = (category: string, type: string) => {
  if (type === 'income' || type === 'credit') return 'payments';
  if (type === 'loan') return 'account_balance';
  if (category === 'Savings') return 'savings';
  if (category === 'Utilities') return 'bolt';
  if (category === 'Travel') return 'flight';
  if (category === 'Insurance') return 'health_and_safety';
  if (category === 'Health') return 'medical_services';
  return 'receipt_long';
};

export function DocsSync() {
  const { addIncome, addExpense, expenseItems, incomeItems, importHistory, addImportSession, undoImport, emergencyRevertGDocsSync } = useAppStore();
  const [months, setMonths] = useState<ParsedDocMonth[]>([]);

  // Calculate existing signatures for duplicate detection
  const existingSignatures = new Set([
    ...expenseItems.map(e => `${e.amountPaise}-${e.date.split('T')[0]}`),
    ...incomeItems.map(i => `${i.amountPaise}-${i.date.split('T')[0]}`)
  ]);

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
    if (!html) {
      alert("No HTML or Text found in clipboard.");
      return;
    }
    try {
      const parsed = parsePastedHtml(html);
      setMonths(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newMonths = parsed.filter(p => !existingIds.has(p.id));
        return [...newMonths, ...prev];
      });
    } catch (err: any) {
      alert(`Failed to parse: ${err.message}`);
    }
  };

  const handleItemChange = (monthIndex: number, itemIndex: number, field: keyof ParsedDocItem, value: any) => {
    setMonths(prev => {
      const next = [...prev];
      const items = [...next[monthIndex].items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      next[monthIndex] = { ...next[monthIndex], items };
      return next;
    });
  };

  const handleRemoveItem = (monthIndex: number, itemIndex: number) => {
    setMonths(prev => {
      const next = [...prev];
      const items = [...next[monthIndex].items];
      items.splice(itemIndex, 1);
      next[monthIndex] = { ...next[monthIndex], items };
      return next;
    });
  };

  const handleApproveMonth = (month: ParsedDocMonth) => {
    const now = new Date().toISOString();
    let count = 0;
    let duplicateCount = 0;
    let nullCount = 0;
    
    const incomeIds: string[] = [];
    const expenseIds: string[] = [];

    month.items.forEach(item => {
      // Skip null and unknown items entirely
      if (item.type === 'null' || item.type === 'unknown' || item.amountPaise <= 0) {
        nullCount++;
        return;
      }
      
      const itemDateKey = (item.dateStr || now).split('T')[0];
      const sig = `${item.amountPaise}-${itemDateKey}`;
      
      if (existingSignatures.has(sig) && !item.importAnyway) {
        // Skip duplicate
        duplicateCount++;
        console.warn('Skipping likely duplicate:', item.name);
        return;
      }

      if (item.type === 'expense' || item.type === 'loan') {
        const resolvedCategory = resolveCategory(item);
        const newId = generateId();
        expenseIds.push(newId);

        addExpense({
          id: newId,
          type: 'expense',
          category: resolvedCategory as any,
          amountPaise: item.amountPaise,
          date: item.dateStr || new Date().toISOString().split('T')[0],
          merchant: item.name || 'Unknown',
          notes: `Imported from Google Docs: ${month.monthYear}\nRaw: ${item.originalText}`,
          tags: ['gdocs-sync'],
          isRecurring: false,
          createdAt: now,
        });
      } else {
        const newId = generateId();
        incomeIds.push(newId);
        addIncome({
          id: newId,
          type: 'income',
          head: 'other',
          amountPaise: item.amountPaise,
          source: item.name || 'Unknown',
          fy: '',
          isTaxable: false,
          notes: `Imported from Google Docs: ${month.monthYear}\nRaw: ${item.originalText}`,
          tags: ['gdocs-sync'],
          date: item.dateStr || new Date().toISOString().split('T')[0],
          createdAt: now,
        });
      }
      count++;
    });

    // Remove approved month from UI
    setMonths(prev => prev.filter(m => m.id !== month.id));
    
    if (incomeIds.length > 0 || expenseIds.length > 0) {
      addImportSession({
        id: generateId(),
        date: now,
        fileName: `Smart Paste - ${month.monthYear}`,
        intent: 'Google Docs Sync',
        rowCount: count,
        recordIds: { trades: [], income: incomeIds, expenses: expenseIds },
        summary: { nullSkipped: nullCount, duplicatesSkipped: duplicateCount }
      });
    }

    alert(`Import Summary:\n✅ ${count} items inserted into Ledger.\n\nSkipped:\n- ${duplicateCount} duplicate items\n- ${nullCount} null/unknown items`);
  };

  return (
    <div className="docs-sync-container">
      <div className="glass-surface settings-section" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 className="text-headline-md" style={{ marginBottom: '8px' }}>Smart Paste</h3>
        <p className="text-body color-muted" style={{ marginBottom: '16px' }}>
          Open your Notes or Google Doc, select the text, press <code>Cmd+C</code> to copy, and paste it into the box below.
        </p>
        <div 
          contentEditable 
          onPaste={handlePaste}
          style={{ 
            minHeight: '100px', 
            border: '2px dashed rgba(255,255,255,0.2)', 
            borderRadius: '8px', 
            padding: '16px',
            color: 'var(--text)',
            background: 'rgba(0,0,0,0.2)',
            outline: 'none',
            cursor: 'text'
          }}
          data-placeholder="Click here and press Cmd+V to paste..."
          onFocus={(e) => {
            if (e.currentTarget.textContent === 'Click here and press Cmd+V to paste...') {
              e.currentTarget.textContent = '';
            }
          }}
        >Click here and press Cmd+V to paste...</div>
      </div>

      <div className="docs-sync-results">
        {months.map((m, mIdx) => (
          <div key={m.id} className="glass-surface settings-section" style={{ marginBottom: '16px' }}>
            <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.4)' }}>
              <span className="text-label-mono color-subtle">{m.monthYear.toUpperCase()}</span>
              <button className="btn-primary" onClick={() => handleApproveMonth(m)} style={{ padding: '4px 12px', fontSize: '11px' }}>
                APPROVE MONTH [{m.items.length}]
              </button>
            </div>
            
            {/* Summary Bar */}
            {(() => {
              const incomeCount = m.items.filter(i => i.type === 'income' || i.type === 'credit').length;
              const expenseCount = m.items.filter(i => i.type === 'expense' || i.type === 'loan').length;
              const nullCount = m.items.filter(i => i.type === 'null' || i.type === 'unknown').length;
              return (
                <div style={{ display: 'flex', gap: '16px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined icon-xs color-subtle">receipt_long</span>
                    <span className="text-label-mono-sm color-muted">Total: {m.items.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined icon-xs" style={{ color: 'var(--positive)' }}>arrow_downward</span>
                    <span className="text-label-mono-sm" style={{ color: 'var(--positive)' }}>Incomes: {incomeCount}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined icon-xs" style={{ color: 'var(--error)' }}>arrow_upward</span>
                    <span className="text-label-mono-sm" style={{ color: 'var(--error)' }}>Expenses: {expenseCount}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined icon-xs" style={{ color: 'orange' }}>help_outline</span>
                    <span className="text-label-mono-sm" style={{ color: 'orange' }}>Unknown/Null: {nullCount}</span>
                  </div>
                </div>
              );
            })()}

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {m.items.length === 0 && <span className="text-label-mono-sm color-muted">No items extracted.</span>}
              {m.items.map((item, iIdx) => (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '4px' }}>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} title={resolveCategory(item)}>
                      <span className="material-symbols-outlined icon-sm" style={{ color: item.type === 'income' || item.type === 'credit' ? 'var(--positive)' : item.type === 'expense' || item.type === 'loan' ? 'var(--error)' : 'var(--muted)' }}>
                         {getCategoryIcon(resolveCategory(item), item.type)}
                      </span>
                    </div>
                    <input 
                      type="text" 
                      value={item.name} 
                      onChange={e => handleItemChange(mIdx, iIdx, 'name', e.target.value)}
                      style={{ flex: 2, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', padding: '4px 8px', borderRadius: '4px', textDecoration: item.isStrikethrough ? 'line-through' : 'none' }}
                      placeholder="Name/Description"
                    />
                    
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0 8px' }}>
                      <span className="text-label-mono-sm color-muted">₹</span>
                      <input 
                        type="number" 
                        value={item.amountPaise / 100} 
                        onChange={e => handleItemChange(mIdx, iIdx, 'amountPaise', parseFloat(e.target.value) * 100)}
                        style={{ width: '80px', background: 'transparent', border: 'none', color: 'var(--text)', padding: '4px 8px', outline: 'none' }}
                      />
                    </div>

                    <input 
                      type="text" 
                      value={item.dateStr} 
                      onChange={e => handleItemChange(mIdx, iIdx, 'dateStr', e.target.value)}
                      style={{ width: '100px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', padding: '4px 8px', borderRadius: '4px' }}
                      placeholder="Date"
                    />
                    
                    <select
                      value={item.type}
                      onChange={e => handleItemChange(mIdx, iIdx, 'type', e.target.value)}
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: item.type === 'expense' || item.type === 'loan' ? 'var(--error)' : item.type === 'income' || item.type === 'credit' ? 'var(--positive)' : 'var(--muted)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="credit">Credit</option>
                      <option value="loan">Loan</option>
                      <option value="null">Null</option>
                      <option value="unknown">Unknown</option>
                    </select>

                    {(item.type === 'expense' || item.type === 'loan') && (
                      <>
                        <input
                          list="expense-categories"
                          value={resolveCategory(item)}
                          onChange={e => handleItemChange(mIdx, iIdx, 'category', e.target.value)}
                          placeholder="Category"
                          style={{
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            outline: 'none',
                            width: '120px'
                          }}
                        />
                        <datalist id="expense-categories">
                          <option value="Savings" />
                          <option value="Utilities" />
                          <option value="Travel" />
                          <option value="Insurance" />
                          <option value="Health" />
                          <option value="Food" />
                          <option value="Loan Repayment" />
                          <option value="Other" />
                        </datalist>
                      </>
                    )}

                    <button 
                      onClick={() => handleRemoveItem(mIdx, iIdx)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Remove item"
                    >
                      <span className="material-symbols-outlined icon-sm">close</span>
                    </button>
                  </div>
                  
                  {/* Note Section for Original Text & Duplicate Warnings */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(() => {
                      const itemDateKey = (item.dateStr || new Date().toISOString()).split('T')[0];
                      const sig = `${item.amountPaise}-${itemDateKey}`;
                      const isDuplicate = existingSignatures.has(sig);
                      if (isDuplicate) {
                        return (
                          <div style={{ padding: '8px', background: 'rgba(255,165,0,0.1)', color: 'orange', borderRadius: '4px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-symbols-outlined icon-xs">warning</span>
                              Potential Duplicate (Already in Ledger)
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={!!item.importAnyway}
                                onChange={e => handleItemChange(mIdx, iIdx, 'importAnyway', e.target.checked)}
                              />
                              Import Anyway
                            </label>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span className="material-symbols-outlined icon-xs color-subtle" style={{ marginTop: '2px' }}>notes</span>
                      <textarea 
                        value={item.originalText} 
                        onChange={e => handleItemChange(mIdx, iIdx, 'originalText', e.target.value)}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--subtle)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', resize: 'vertical', minHeight: '30px' }}
                        placeholder="Original Raw Entry..."
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Syncs History */}
      {importHistory.filter(h => h.intent === 'Google Docs Sync').length > 0 && (
        <div className="glass-surface settings-section" style={{ marginTop: '24px' }}>
          <h3 className="text-headline-md" style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Recent Syncs</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {importHistory.filter(h => h.intent === 'Google Docs Sync').map(session => (
              <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div className="text-data-display">{session.fileName}</div>
                  <div className="text-label-mono-sm color-muted">
                    {new Date(session.date).toLocaleString()} • {session.rowCount} items imported
                  </div>
                </div>
                <button 
                  className="btn-secondary" 
                  style={{ color: 'var(--error)', borderColor: 'rgba(255,100,100,0.3)', padding: '4px 12px' }}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to undo this import? This will delete the imported items.')) {
                      undoImport(session.id);
                    }
                  }}
                >
                  UNDO
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Fallback */}
      <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,100,100,0.05)', border: '1px dashed rgba(255,100,100,0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="text-data-display" style={{ color: 'var(--error)' }}>Emergency Cleanup</div>
          <div className="text-label-mono-sm color-muted" style={{ maxWidth: '400px', lineHeight: 1.4 }}>If you made a sync mistake recently (before the new log system was added), click this to automatically wipe any unsaved syncs from the past 24 hours.</div>
        </div>
        <button 
          className="btn-primary" 
          style={{ background: 'var(--error)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px' }}
          onClick={() => {
            if (window.confirm('This will delete all Google Docs imports from the last 24 hours. Continue?')) {
              emergencyRevertGDocsSync();
              alert('Emergency cleanup complete! Your ledger has been reverted.');
            }
          }}
        >
          REVERT RECENT MISTAKE
        </button>
      </div>

    </div>
  );
}
