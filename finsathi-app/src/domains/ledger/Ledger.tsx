import { useState, useMemo, useEffect } from 'react';
import { useAppStore, type LedgerItem } from '../../shared/hooks/useAppStore';
import { toPaise, formatINR } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { relativeTime, getCurrentFY, getFYRange, getFY } from '../../shared/lib/dates';
import { LedgerDetail } from './LedgerDetail';
import { FinancialChecklist } from '../checklist/FinancialChecklist';
import { Recurring } from '../recurring/Recurring';
import { SalaryStructure } from '../salary/SalaryStructure';
import './Ledger.css';

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Healthcare', 'Education', 'Utilities', 'Entertainment', 'Shopping', 'Insurance', 'Savings', 'SIP', 'RD', 'Other'];
const INCOME_HEADS = ['salary', 'freelance', 'interest', 'dividend', 'rental', 'other'] as const;

type FormMode = 'none' | 'income' | 'expense';
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function getIconForTransaction(t: any): string {
  const cat = t.type === 'income' ? t.head : (t.type === 'expense' ? t.category : 'trade');
  const name = (t.type === 'income' ? (t.source || t.head) : (t.type === 'expense' ? (t.merchant || t.category) : t.instrument))?.toLowerCase() || '';
  const c = cat?.toLowerCase() || '';

  // Name overrides
  if (name.includes('credit card') || name.includes('sbi') || name.includes('hdfc')) return 'credit_card';
  if (name.includes('internet') || name.includes('wifi') || name.includes('jio') || name.includes('bsnl')) return 'wifi';
  if (name.includes('recharge') || name.includes('mobile')) return 'phone_iphone';
  if (name.includes('chitt')) return 'group';
  if (name.includes('ksfe') || name.includes('electricity') || name.includes('kseb')) return 'bolt';
  if (name.includes('kwa') || name.includes('water')) return 'water_drop';
  if (name.includes('petrol') || name.includes('fuel')) return 'local_gas_station';

  // Category overrides
  if (c.includes('saving') || c.includes('sip') || c.includes('rd')) return 'savings';
  if (c.includes('food') || c.includes('grocery')) return 'local_grocery_store';
  if (c.includes('transport') || c.includes('travel')) return 'directions_car';
  if (c.includes('housing')) return 'home';
  if (c.includes('health')) return 'medical_services';
  if (c.includes('education')) return 'school';
  if (c.includes('util')) return 'build';
  if (c.includes('entertain')) return 'movie';
  if (c.includes('shop')) return 'shopping_bag';
  if (c.includes('insur')) return 'health_and_safety';
  
  if (c === 'salary') return 'account_balance_wallet';
  if (c === 'freelance') return 'work';
  if (c === 'interest') return 'trending_up';
  if (c === 'dividend') return 'pie_chart';
  if (c === 'rental') return 'real_estate_agent';

  return t.type === 'income' ? 'add_box' : 'indeterminate_check_box';
}

function TransactionLedger() {
  const { addIncome, addExpense, updateExpense, deleteIncome, deleteExpense, getAllTransactions } = useAppStore();
  const [formMode, setFormMode] = useState<FormMode>('none');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [fyFilter, setFyFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetCategory, setBulkTargetCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [selectedRecord, setSelectedRecord] = useState<LedgerItem | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Distilled Form State
  const [head, setHead] = useState<string>(INCOME_HEADS[0]);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const allTx = getAllTransactions();
  
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allTx.forEach(t => {
      const txDate = 'date' in t ? new Date(t.date) : new Date(t.sellDate);
      if (!isNaN(txDate.getTime())) {
        years.add(getFY(txDate));
      }
    });
    return Array.from(years).sort().reverse();
  }, [allTx]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    allTx.forEach(t => {
      if (fyFilter !== 'all') {
        const txDate = 'date' in t ? new Date(t.date) : new Date(t.sellDate);
        if (getFY(txDate) !== fyFilter) return;
      }
      const txDate = 'date' in t ? new Date(t.date) : new Date(t.sellDate);
      if (!isNaN(txDate.getTime())) {
        months.add(txDate.getMonth().toString());
      }
    });
    return Array.from(months).sort((a, b) => parseInt(a) - parseInt(b));
  }, [allTx, fyFilter]);

  const transactions = useMemo(() => {
    let filtered = allTx;
    if (filter !== 'all') {
      filtered = filtered.filter(t => t.type === filter);
    }

    if (fyFilter !== 'all') {
      filtered = filtered.filter(t => {
        const txDate = 'date' in t ? new Date(t.date) : new Date(t.sellDate);
        return getFY(txDate) === fyFilter;
      });
    }

    if (monthFilter !== 'all') {
      filtered = filtered.filter(t => {
        const txDate = 'date' in t ? new Date(t.date) : new Date(t.sellDate);
        return txDate.getMonth().toString() === monthFilter;
      });
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => {
        const cat = t.type === 'income' ? t.head : (t.type === 'expense' ? t.category : 'trade');
        return cat === categoryFilter;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const str = t.type === 'income' ? `${t.source} ${t.head}` : (t.type === 'expense' ? `${t.merchant} ${t.category}` : t.instrument);
        return str.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q);
      });
    }

    return filtered;
  }, [allTx, filter, fyFilter, monthFilter, categoryFilter, searchQuery]);

  // Reset lazy load limit when filters change
  useEffect(() => {
    setVisibleCount(50);
  }, [filter, fyFilter, monthFilter, categoryFilter, searchQuery]);

  const visibleTransactions = transactions.slice(0, visibleCount);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, { items: typeof transactions, net: number, income: number, expense: number }> = {};
    for (const t of visibleTransactions) {
      const dateStr = 'date' in t ? t.date : t.sellDate;
      const monthKey = dateStr.slice(0, 7); // YYYY-MM
      if (!groups[monthKey]) groups[monthKey] = { items: [], net: 0, income: 0, expense: 0 };
      groups[monthKey].items.push(t);
      if (t.type === 'income') {
        groups[monthKey].income += t.amountPaise;
        groups[monthKey].net += t.amountPaise;
      } else if (t.type === 'expense') {
        groups[monthKey].expense += t.amountPaise;
        groups[monthKey].net -= t.amountPaise;
      }
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [visibleTransactions]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      if (visibleCount < transactions.length) {
        setVisibleCount(prev => prev + 50);
      }
    }
  };

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allTx.forEach(t => {
      if (t.type === 'income') cats.add(t.head);
      else if (t.type === 'expense') cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [allTx]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') income += t.amountPaise;
      else if (t.type === 'expense') expense += t.amountPaise;
      else if (t.type === 'trade') {
        if (t.realizedPnlPaise > 0) income += t.realizedPnlPaise;
        else expense += Math.abs(t.realizedPnlPaise);
      }
    });
    return { income, expense, net: income - expense };
  }, [transactions]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const deleteSelected = () => {
    if (!window.confirm(`PERMANENTLY_DELETE_${selectedIds.length}_RECORDS?`)) return;
    selectedIds.forEach(id => {
      const t = transactions.find(x => x.id === id);
      if (t) t.type === 'income' ? deleteIncome(t.id) : deleteExpense(t.id);
    });
    setSelectedIds([]);
  };

  const findDuplicates = () => {
    const dups: string[] = [];
    const seen = new Map();
    transactions.forEach(t => {
      const amt = 'amountPaise' in t ? t.amountPaise : t.realizedPnlPaise;
      const d = 'date' in t ? t.date : t.sellDate;
      const name = t.type === 'income' ? t.source : t.type === 'expense' ? t.merchant : t.instrument;
      const key = `${t.type}-${amt}-${d}-${name}`;
      seen.has(key) ? dups.push(t.id) : seen.set(key, t.id);
    });
    if (dups.length) { setSelectedIds(dups); alert(`FOUND_${dups.length}_DUPLICATES`); }
    else alert("CLEAN_LEDGER_DETECTED");
  };

  const handleBulkCategoryChange = () => {
    let count = 0;
    selectedIds.forEach(id => {
      const t = transactions.find(x => x.id === id);
      if (t && t.type === 'expense') {
        updateExpense(t.id, { category: bulkTargetCategory });
        count++;
      }
    });
    setSelectedIds([]);
    alert(`CATEGORY_UPDATED: ${count} expense records assigned to "${bulkTargetCategory.toUpperCase()}"`);
  };

  const exportCsv = () => {
    const targetRows = selectedIds.length > 0
      ? transactions.filter(t => selectedIds.includes(t.id))
      : transactions;

    if (targetRows.length === 0) {
      alert("NO_RECORDS_AVAILABLE_FOR_EXPORT");
      return;
    }

    const headers = ['Date', 'Type', 'Merchant_or_Source', 'Category_or_Head', 'Amount_INR'];
    const rows = targetRows.map(t => {
      const d = 'date' in t ? t.date : t.sellDate;
      const desc = t.type === 'income' ? t.source : (t.type === 'expense' ? t.merchant : t.instrument);
      const cat = t.type === 'income' ? t.head : (t.type === 'expense' ? t.category : 'trade');
      const amt = (('amountPaise' in t ? t.amountPaise : t.realizedPnlPaise) || 0) / 100;
      return `"${d}","${t.type}","${(desc || '').replace(/"/g, '""')}","${cat}",${amt}`;
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finsathi-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="transaction-ledger animate-in">
      <header className="ledger-header">
        <div className="header-meta">
          <h1 className="text-headline-md tracking-tighter">FINSATHI_VAULT</h1>
          <div className="status-line">
            <span className="pulse-dot"></span>
            <span className="text-label-mono color-muted">SYSTEM_ONLINE // {transactions.length}_RECORDS</span>
          </div>
        </div>
        
        <div className="ledger-actions">
          <button className={`terminal-btn ${formMode === 'income' ? 'active' : ''}`} onClick={() => setFormMode(formMode === 'income' ? 'none' : 'income')}>
            <span className="material-symbols-outlined icon-xs">add</span> INCOME
          </button>
          <button className={`terminal-btn ${formMode === 'expense' ? 'active' : ''}`} onClick={() => setFormMode(formMode === 'expense' ? 'none' : 'expense')}>
            <span className="material-symbols-outlined icon-xs">remove</span> EXPENSE
          </button>
        </div>
      </header>

      {/* Distilled Command Form */}
      {formMode !== 'none' && (
        <div className="terminal-command-bar glass-surface-elevated animate-in">
          <div className="cmd-prefix">{formMode.toUpperCase()} &gt;</div>
          <div className="cmd-grid">
            <div className="cmd-input-group">
              <label>AMOUNT</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div className="cmd-input-group">
              <label>{formMode === 'income' ? 'SOURCE' : 'MERCHANT'}</label>
              <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="..." />
            </div>
            <div className="cmd-input-group">
              <label>DATE</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="cmd-input-group">
              <label>TAG</label>
              <select value={formMode === 'income' ? head : category} onChange={e => formMode === 'income' ? setHead(e.target.value) : setCategory(e.target.value)}>
                {(formMode === 'income' ? INCOME_HEADS : EXPENSE_CATEGORIES).map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <button className="cmd-execute" onClick={() => {
            const num = parseFloat(amount);
            if (isNaN(num) || num <= 0) {
              alert("PLEASE_ENTER_AMOUNT_GREATER_THAN_ZERO");
              return;
            }
            const paise = toPaise(num);
            const cleanSource = source.trim() || (formMode === 'income' ? head : category);

            // Duplicate detection check
            const duplicate = allTx.find(t => {
              const tDate = 'date' in t ? t.date : t.sellDate;
              const tAmt = 'amountPaise' in t ? t.amountPaise : t.realizedPnlPaise;
              const tDesc = t.type === 'income' ? t.source : (t.type === 'expense' ? t.merchant : t.instrument);
              return tDate === date && tAmt === paise && (tDesc || '').toLowerCase() === cleanSource.toLowerCase();
            });

            if (duplicate) {
              if (!window.confirm(`DUPLICATE_WARNING: An entry of ₹${num} for "${cleanSource}" on ${date} already exists in the ledger. Proceed anyway?`)) {
                return;
              }
            }

            const data = { id: generateId(), amountPaise: paise, date, notes: '', tags: [], createdAt: new Date().toISOString() };
            if (formMode === 'income') addIncome({ ...data, type: 'income', head: head as any, source: cleanSource, fy: getCurrentFY(), isTaxable: true });
            else addExpense({ ...data, type: 'expense', category, merchant: cleanSource, isRecurring: false });
            setFormMode('none'); setAmount(''); setSource('');
          }}>EXECUTE</button>
        </div>
      )}

      {/* Tools & Filter */}
      <div className="ledger-tools glass-surface" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="filter-segment">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button key={f} className={`segment-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f as any)}>{f.toUpperCase()}</button>
          ))}
        </div>
        
        <input 
          type="text" 
          placeholder="Search..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', padding: '0 12px', borderRadius: '4px', height: '32px', width: '150px' }}
        />

        <select 
          className="settings-select" 
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', padding: '0 12px', borderRadius: '4px', height: '32px' }}
          value={categoryFilter} 
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="all">ALL CATEGORIES</option>
          {availableCategories.map(c => (
            <option key={c} value={c}>{c.toUpperCase()}</option>
          ))}
        </select>
        
        <select 
          className="settings-select" 
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', padding: '0 12px', borderRadius: '4px', height: '32px' }}
          value={fyFilter} 
          onChange={e => setFyFilter(e.target.value)}
        >
          <option value="all">ALL YEARS</option>
          {availableYears.map(f => (
            <option key={f} value={f}>FY {f}</option>
          ))}
        </select>

        <select 
          className="settings-select" 
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', padding: '0 12px', borderRadius: '4px', height: '32px' }}
          value={monthFilter} 
          onChange={e => setMonthFilter(e.target.value)}
        >
          <option value="all">ALL MONTHS</option>
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
            availableMonths.includes(i.toString()) && <option key={i} value={i.toString()}>{m.toUpperCase()}</option>
          ))}
        </select>

        <div style={{ flex: 1 }}></div>
        <button className="tool-icon-btn" onClick={findDuplicates} title="FIND_DUPLICATES">
          <span className="material-symbols-outlined icon-xs">content_copy</span>
        </button>
      </div>

      {/* Summary Section */}
      <div className="glass-surface" style={{ display: 'flex', gap: '24px', padding: '16px', marginBottom: '16px', borderRadius: '8px' }}>
        <div style={{ flex: 1 }}>
          <div className="text-label-mono-sm color-muted">TOTAL INCOME</div>
          <div className="text-headline-md" style={{ color: 'var(--positive)' }}><CurrencyValue paise={summary.income} /></div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="text-label-mono-sm color-muted">TOTAL EXPENSE</div>
          <div className="text-headline-md" style={{ color: 'var(--error)' }}><CurrencyValue paise={summary.expense} /></div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="text-label-mono-sm color-muted">NET BALANCE</div>
          <div className="text-headline-md" style={{ color: summary.net >= 0 ? 'var(--positive)' : 'var(--error)' }}><CurrencyValue paise={summary.net} /></div>
        </div>
      </div>

      <div className="ledger-container glass-surface">
        <div className="ledger-grid-header text-label-mono-xs color-muted">
          <span onClick={() => setSelectedIds(selectedIds.length === transactions.length ? [] : transactions.map(t => t.id))} style={{ cursor: 'pointer' }}>
            <span className="material-symbols-outlined icon-xs">{selectedIds.length === transactions.length && transactions.length > 0 ? 'check_box' : 'check_box_outline_blank'}</span>
          </span>
          <span>TYPE</span>
          <span>IDENTIFIER</span>
          <span>TIMESTAMP</span>
          <span style={{ textAlign: 'right' }}>VALUATION</span>
          <span></span>
        </div>

        <div className="ledger-scroll-area" onScroll={handleScroll}>
          {groupedTransactions.map(([monthKey, group]) => {
            const dateObj = new Date(`${monthKey}-01`);
            const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
            
            return (
              <div key={monthKey} className="ledger-group" style={{ marginBottom: '16px' }}>
                <div className="ledger-group-header" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="text-label-mono color-subtle" style={{ fontWeight: 'bold' }}>{monthName}</span>
                  <div className="ledger-group-summary" style={{ display: 'flex', gap: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                     <span style={{ color: 'var(--positive)' }}>+{formatINR(group.income)}</span>
                     <span style={{ color: 'var(--error)' }}>-{formatINR(group.expense)}</span>
                     <span style={{ color: group.net >= 0 ? 'var(--positive)' : 'var(--error)', marginLeft: '8px', fontWeight: 'bold', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                       {group.net > 0 ? '+' : ''}{formatINR(group.net)}
                     </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {group.items.map(t => (
                    <div key={t.id} className={`ledger-row ${selectedIds.includes(t.id) ? 'selected' : ''}`} onClick={() => setSelectedRecord(t)}>
                      <div className="cell-select" onClick={e => toggleSelect(t.id, e)}>
                        <span className="material-symbols-outlined icon-xs">{selectedIds.includes(t.id) ? 'check_box' : 'check_box_outline_blank'}</span>
                      </div>
                      <div className="cell-type">
                        <span className="material-symbols-outlined icon-xs">{getIconForTransaction(t)}</span>
                      </div>
                      <div className="cell-info">
                        <span className="text-data-display truncate" style={{ fontSize: '13px' }}>{t.type === 'income' ? (t.source || t.head) : (t.type === 'expense' ? (t.merchant || t.category) : t.instrument)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="text-label-mono-xs color-muted">{t.type === 'income' ? t.head : (t.type === 'expense' ? t.category : 'trade')}</span>
                          {('amountPaise' in t && t.amountPaise >= 5000000) && (
                            <span style={{ fontSize: '9px', padding: '1px 5px', background: 'rgba(255,171,0,0.15)', color: '#ffab00', borderRadius: '3px', fontWeight: 700 }}>
                              ⚡ HIGH_VALUE
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="cell-date text-label-mono-sm color-muted">
                        {relativeTime(new Date('date' in t ? t.date : t.sellDate))}
                      </div>
                      <div className="cell-amount text-data-display" style={{ textAlign: 'right', color: t.type === 'income' || (t.type === 'trade' && t.realizedPnlPaise > 0) ? 'var(--primary-container)' : 'inherit' }}>
                        {t.type === 'trade' ? (t.realizedPnlPaise > 0 ? '+' : '') : (t.type === 'income' ? '+' : '-')}<CurrencyValue paise={t.type === 'trade' ? t.realizedPnlPaise : t.amountPaise} />
                      </div>
                      <div className="cell-actions">
                        <button className="row-delete" onClick={e => { e.stopPropagation(); if (window.confirm("ERASE_RECORD?")) t.type === 'income' ? deleteIncome(t.id) : deleteExpense(t.id); }}>
                          <span className="material-symbols-outlined icon-xs">close</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="floating-action-bar animate-in" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="bar-info">
            <span className="text-label-mono color-primary-container">{selectedIds.length}_ITEMS_LOCKED</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={bulkTargetCategory}
              onChange={e => setBulkTargetCategory(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
            >
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c} value={c} style={{ background: '#111' }}>{c}</option>
              ))}
            </select>
            <button className="bar-btn" onClick={handleBulkCategoryChange}>SET_CATEGORY</button>
          </div>

          <div className="bar-actions" style={{ display: 'flex', gap: '6px' }}>
            <button className="bar-btn" onClick={exportCsv}>EXPORT_CSV</button>
            <button className="bar-btn danger" onClick={deleteSelected}>ERASE_SELECTED</button>
            <button className="bar-btn" onClick={() => setSelectedIds([])}>RELEASE</button>
          </div>
        </div>
      )}

      <LedgerDetail record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}

export function Ledger() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'checklist' | 'recurring' | 'salary'>('transactions');
  return (
    <div className="ledger-hub">
      <nav className="terminal-nav">
        {(['transactions', 'checklist', 'recurring', 'salary'] as const).map(tab => (
          <button key={tab} className={`nav-item ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            <span className="nav-label">{tab.toUpperCase()}</span>
            <span className="nav-indicator"></span>
          </button>
        ))}
      </nav>
      <div className="ledger-hub-content">
        {activeTab === 'transactions' && <TransactionLedger />}
        {activeTab === 'checklist' && <FinancialChecklist />}
        {activeTab === 'recurring' && <Recurring />}
        {activeTab === 'salary' && <SalaryStructure />}
      </div>
    </div>
  );
}
