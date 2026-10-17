import React, { useState, useMemo } from 'react';
import { useAppStore, type Reminder } from '../../shared/hooks/useAppStore';
import { formatINR, toPaise } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import { relativeTime } from '../../shared/lib/dates';
import { useToast } from '../../shared/ui/Toast';
import './Checklist.css';

const TEMPLATES = [
  { title: 'Electricity Bill', type: 'payable', category: 'Bills', cadence: 'monthly', amount: 3500 },
  { title: 'Water Bill', type: 'payable', category: 'Bills', cadence: 'monthly', amount: 800 },
  { title: 'Jio Recharge', type: 'payable', category: 'Recharge', cadence: 'monthly', amount: 749 },
  { title: 'Airtel Bill', type: 'payable', category: 'Recharge', cadence: 'monthly', amount: 999 },
  { title: 'Chit Fund Pay', type: 'payable', category: 'Savings', cadence: 'monthly', amount: 5000 },
  { title: 'Credit Card Bill', type: 'payable', category: 'Finance', cadence: 'one-time', amount: 0 },
  { title: 'Freelance Payout', type: 'receivable', category: 'Income', cadence: 'one-time', amount: 0 },
  { title: 'Loan Receivable', type: 'receivable', category: 'Loans', cadence: 'monthly', amount: 2000 },
  { title: 'Grocery Budget', type: 'payable', category: 'Living', cadence: 'monthly', amount: 12000 },
  { title: 'Advance Tax', type: 'payable', category: 'Tax', cadence: 'quarterly', amount: 0 }
];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function FinancialChecklist() {
  const { reminders, addReminder, updateReminder, deleteReminder, addIncome, addExpense, deleteIncome, deleteExpense } = useAppStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'pending' | 'settled' | 'calendar'>('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'payable' | 'receivable'>('payable');
  const [category, setCategory] = useState('Bills');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Reminder['cadence']>('monthly');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [credentials, setCredentials] = useState('');
  const [portalUrl, setPortalUrl] = useState('');

  // Editable Amount State (per ID)
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});

  // Editable Date State (per ID)
  const [editingDates, setEditingDates] = useState<Record<string, string>>({});

  const enriched = useMemo(() => {
    return reminders.map(r => ({
      ...r,
      daysLeft: daysUntil(r.nextDue)
    })).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [reminders]);

  const filtered = useMemo(() => {
    if (activeTab === 'calendar') return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Calculate last working day of current month
    const lastWorkingDay = new Date(currentYear, currentMonth + 1, 0);
    if (lastWorkingDay.getDay() === 6) lastWorkingDay.setDate(lastWorkingDay.getDate() - 1);
    else if (lastWorkingDay.getDay() === 0) lastWorkingDay.setDate(lastWorkingDay.getDate() - 2);
    lastWorkingDay.setHours(0, 0, 0, 0);

    const canSeeNextMonth = today.getTime() >= lastWorkingDay.getTime();

    return enriched.filter(r => {
      if (activeTab === 'pending') {
        if (r.status === 'paid') return false;
        
        const due = new Date(r.nextDue);
        const dueMonth = due.getMonth();
        const dueYear = due.getFullYear();
        
        if (dueYear < currentYear) return true;
        if (dueYear > currentYear) {
           if (currentMonth === 11 && dueMonth === 0 && canSeeNextMonth) return true;
           return false;
        }
        
        if (dueMonth <= currentMonth) return true;
        if (dueMonth === currentMonth + 1 && canSeeNextMonth) return true;
        
        return false;
      }
      return r.status === 'paid';
    });
  }, [enriched, activeTab]);

  const { pendingCount, stats } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currM = today.getMonth();
    const currY = today.getFullYear();

    const lastWorkingDay = new Date(currY, currM + 1, 0);
    if (lastWorkingDay.getDay() === 6) lastWorkingDay.setDate(lastWorkingDay.getDate() - 1);
    else if (lastWorkingDay.getDay() === 0) lastWorkingDay.setDate(lastWorkingDay.getDate() - 2);
    lastWorkingDay.setHours(0, 0, 0, 0);
    const canSeeNextMonth = today.getTime() >= lastWorkingDay.getTime();

    const actionable = reminders.filter(r => {
      if (r.status === 'paid') return false;
      const due = new Date(r.nextDue);
      const dueY = due.getFullYear();
      const dueM = due.getMonth();

      if (dueY < currY) return true;
      if (dueY > currY) {
         if (currM === 11 && dueM === 0 && canSeeNextMonth) return true;
         return false;
      }
      if (dueM <= currM) return true;
      if (dueM === currM + 1 && canSeeNextMonth) return true;
      return false;
    });

    const pendingPayable = actionable.filter(r => r.type === 'payable')
      .reduce((s, r) => s + (r.amountPaise || 0), 0);
    const pendingReceivable = actionable.filter(r => r.type === 'receivable')
      .reduce((s, r) => s + (r.amountPaise || 0), 0);
    
    // Settled Stats (Current Month)
    const settled = reminders.filter(r => {
      if (r.status !== 'paid' || !r.settledAt) return false;
      const sDate = new Date(r.settledAt);
      return sDate.getFullYear() === currY && sDate.getMonth() === currM;
    });

    const settledPayable = settled.filter(r => r.type === 'payable')
      .reduce((s, r) => s + (r.amountPaise || 0), 0);
    const settledReceivable = settled.filter(r => r.type === 'receivable')
      .reduce((s, r) => s + (r.amountPaise || 0), 0);

    const overdueCount = enriched.filter(r => r.status !== 'paid' && r.daysLeft < 0).length;
    
    return { 
      pendingCount: actionable.length,
      stats: { pendingPayable, pendingReceivable, settledPayable, settledReceivable, overdueCount } 
    };
  }, [reminders, enriched]);

  const handleAdd = (tpl?: typeof TEMPLATES[0]) => {
    const finalTitle = tpl?.title || title;
    if (!finalTitle) return;

    // Prevent duplicates if adding from template
    if (tpl) {
      const isDuplicate = reminders.some(r => 
        r.status !== 'paid' && 
        r.title.toLowerCase() === finalTitle.toLowerCase()
      );
      if (isDuplicate) {
        toast(`"${finalTitle}" is already in your pending list.`, 'warning');
        return;
      }
    }

    const reminderData = {
      title: finalTitle,
      type: (tpl?.type as any) || type,
      category: tpl?.category || category,
      amountPaise: toPaise(Number(tpl?.amount || amount)),
      cadence: (tpl?.cadence as any) || cadence,
      nextDue: dueDate,
      endDate: endDate || undefined,
      leadDays: [3, 1],
      status: 'upcoming' as const,
      notes,
      credentials,
      portalUrl,
      createdAt: new Date().toISOString()
    };

    if (editingId) {
      updateReminder(editingId, reminderData);
      setEditingId(null);
    } else {
      addReminder({
        id: crypto.randomUUID(),
        ...reminderData
      });
    }
    
    resetForm();
    setShowAdd(false);
    toast(editingId ? `Updated obligation: ${finalTitle}` : `Added obligation: ${finalTitle}`, 'success');
  };

  const handleEdit = (r: Reminder) => {
    setEditingId(r.id);
    setTitle(r.title);
    setType(r.type);
    setCategory(r.category);
    setAmount(r.amountPaise ? (r.amountPaise / 100).toString() : '');
    setCadence(r.cadence);
    setDueDate(r.nextDue);
    setEndDate(r.endDate || '');
    setNotes(r.notes || '');
    setCredentials(r.credentials || '');
    setPortalUrl(r.portalUrl || '');
    setShowAdd(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle(''); setAmount(''); setCategory('Bills'); setType('payable'); setCadence('monthly');
    setDueDate(new Date().toISOString().split('T')[0]); setEndDate('');
    setNotes(''); setCredentials(''); setPortalUrl('');
  };

  const handleSettle = (r: Reminder) => {
    const editableAmount = editingAmounts[r.id];
    const finalAmountPaise = editableAmount ? toPaise(Number(editableAmount)) : (r.amountPaise || 0);
    const defaultSettleDate = new Date(r.nextDue) < new Date() ? r.nextDue.split('T')[0] : new Date().toISOString().split('T')[0];
    const settlementDate = editingDates[r.id] || defaultSettleDate;
    const ledgerId = crypto.randomUUID();
    
    // 1. Create Ledger Entry
    if (r.type === 'payable') {
      addExpense({
        id: ledgerId,
        type: 'expense',
        category: r.category || 'Bills',
        amountPaise: finalAmountPaise,
        date: settlementDate,
        merchant: r.title,
        notes: `Settled from checklist: ${r.title}${r.notes ? ` | ${r.notes}` : ''}`,
        tags: ['checklist'],
        isRecurring: r.cadence !== 'one-time',
        createdAt: new Date().toISOString()
      });
    } else {
      addIncome({
        id: ledgerId,
        type: 'income',
        head: 'other',
        amountPaise: finalAmountPaise,
        source: r.title,
        fy: 'FY2425',
        isTaxable: true,
        notes: `Received from checklist: ${r.title}${r.notes ? ` | ${r.notes}` : ''}`,
        tags: ['checklist'],
        date: settlementDate,
        createdAt: new Date().toISOString()
      });
    }

    // 2. Create next occurrence ONLY if recurring (not one-time)
    let nextId: string | undefined;
    if (r.cadence !== 'one-time') {
      const nextDate = new Date(r.nextDue);
      if (r.cadence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      else if (r.cadence === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
      else if (r.cadence === 'annual') nextDate.setFullYear(nextDate.getFullYear() + 1);
      else if (r.cadence === 'custom') nextDate.setDate(nextDate.getDate() + 60);

      const nextDateStr = nextDate.toISOString().split('T')[0];
      if (!r.endDate || new Date(nextDateStr) <= new Date(r.endDate)) {
        nextId = crypto.randomUUID();
        addReminder({
          ...r,
          id: nextId,
          nextDue: nextDateStr,
          status: 'upcoming',
          linkedLedgerId: undefined,
          autoCreatedNextId: undefined,
          createdAt: new Date().toISOString()
        });
      }
    }

    // 3. Update current
    updateReminder(r.id, { 
      status: 'paid', 
      linkedLedgerId: ledgerId, 
      amountPaise: finalAmountPaise,
      settledAt: settlementDate,
      autoCreatedNextId: nextId 
    });

    toast(`Settled ${r.title} on ${settlementDate}`, 'success');
  };

  const handleEditSettledDate = (r: Reminder, newDate: string) => {
    if (!r.linkedLedgerId) return;

    // Update Reminder
    updateReminder(r.id, { settledAt: newDate });

    // Update Ledger Entry
    const { updateIncome, updateExpense } = useAppStore.getState();
    if (r.type === 'payable') {
      updateExpense(r.linkedLedgerId, { date: newDate });
    } else {
      updateIncome(r.linkedLedgerId, { date: newDate });
    }
    toast('Settlement date updated', 'info');
  };

  const handleRevert = (r: Reminder) => {
    if (!r.linkedLedgerId) {
      toast('No linked ledger entry found to revert', 'error');
      return;
    }

    // 1. Delete Ledger Entry
    if (r.type === 'payable') deleteExpense(r.linkedLedgerId);
    else deleteIncome(r.linkedLedgerId);

    // 2. Delete auto-created next occurrence
    if (r.autoCreatedNextId) {
      deleteReminder(r.autoCreatedNextId);
    }

    // 3. Revert Status
    updateReminder(r.id, { 
      status: 'upcoming', 
      linkedLedgerId: undefined,
      autoCreatedNextId: undefined
    });

    toast(`Reverted settlement: ${r.title}`, 'info');
  };

  return (
    <div className="checklist-page animate-in">
      <header className="checklist-header">
        <div className="checklist-stats">
          <div className="stat-pill payable">
            <span className="text-label-mono-sm color-muted">TO_PAY</span>
            <span className="text-body-sm"><CurrencyValue paise={stats.pendingPayable} /></span>
          </div>
          <div className="stat-pill paid">
            <span className="text-label-mono-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>PAID</span>
            <span className="text-body-sm" style={{ color: 'var(--on-surface-variant)' }}><CurrencyValue paise={stats.settledPayable} /></span>
          </div>
          <div className="stat-pill receivable">
            <span className="text-label-mono-sm">TO_RECEIVE</span>
            <span className="text-body-sm"><CurrencyValue paise={stats.pendingReceivable} /></span>
          </div>
          <div className="stat-pill received">
            <span className="text-label-mono-sm" style={{ color: 'rgba(0,255,65,0.4)' }}>RECEIVED</span>
            <span className="text-body-sm" style={{ color: 'var(--primary-container)' }}><CurrencyValue paise={stats.settledReceivable} /></span>
          </div>
          {stats.overdueCount > 0 && (
            <div className="stat-pill overdue" style={{ borderLeft: '3px solid var(--error)' }}>
              <span className="text-label-mono-sm color-muted">OVERDUE</span>
              <span className="text-body-sm color-negative">{stats.overdueCount} TASKS</span>
            </div>
          )}
        </div>
      </header>

      <div className="checklist-controls">
        <div className="checklist-tabs">
          <button className={`checklist-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            PENDING <span className="tab-count">{pendingCount}</span>
          </button>
          <button className={`checklist-tab ${activeTab === 'settled' ? 'active' : ''}`} onClick={() => setActiveTab('settled')}>
            SETTLED <span className="tab-count">{reminders.filter(r => r.status === 'paid').length}</span>
          </button>
          <button className={`checklist-tab ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
            CALENDAR
          </button>
        </div>
        <button className="checklist-btn-add" onClick={() => { resetForm(); setShowAdd(true); }}>
          <span className="material-symbols-outlined icon-sm">add_task</span>
          ADD_OBLIGATION
        </button>
      </div>

      <div className="checklist-content">
        {activeTab !== 'calendar' ? (
          <div className="checklist-list glass-surface">
            {filtered.length === 0 ? (
              <div className="checklist-empty">
                <span className="material-symbols-outlined icon-xl color-muted">check_circle</span>
                <p className="text-label-mono-sm color-muted">ZERO_{activeTab.toUpperCase()}_TASKS</p>
              </div>
            ) : (
              filtered.map(r => (
                <div key={r.id} className={`glass-row checklist-row ${r.status}`}>
                  <div className="checklist-row-main">
                    <div className={`checklist-type-indicator ${r.type}`} />
                    <div className="checklist-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="text-body">{r.title}</span>
                        <span className="checklist-cat-tag">{r.category}</span>
                        <span className="checklist-period-badge">
                          {new Date(r.nextDue).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }).toUpperCase()}
                        </span>
                        {r.portalUrl && (
                          <a href={r.portalUrl} target="_blank" rel="noopener noreferrer" className="checklist-portal-link" onClick={e => e.stopPropagation()}>
                            <span className="material-symbols-outlined icon-xs">open_in_new</span>
                          </a>
                        )}
                      </div>
                      <div className="text-label-mono-sm color-muted">
                        {r.daysLeft < 0 ? `LATE BY ${Math.abs(r.daysLeft)}D` : r.daysLeft === 0 ? 'DUE TODAY' : `DUE IN ${r.daysLeft}D`}
                        {` · ${r.cadence.toUpperCase()}`}
                        {r.credentials && ` · ${r.credentials}`}
                      </div>
                      {r.notes && (
                        <p className="checklist-notes text-body-xs color-muted">{r.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="checklist-row-meta">
                    {r.status !== 'paid' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="text-label-mono-sm color-muted">₹</span>
                          <input 
                            className="checklist-amount-input"
                            type="number" 
                            value={editingAmounts[r.id] ?? (r.amountPaise ? r.amountPaise / 100 : '')}
                            onChange={e => setEditingAmounts({ ...editingAmounts, [r.id]: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <input 
                          className="checklist-amount-input"
                          style={{ width: '110px', fontSize: '10px' }}
                          type="date"
                          value={editingDates[r.id] || (new Date(r.nextDue) < new Date() ? r.nextDue.split('T')[0] : new Date().toISOString().split('T')[0])}
                          onChange={e => setEditingDates({ ...editingDates, [r.id]: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                        <span className={`text-data-display ${r.type === 'receivable' ? 'color-positive' : ''}`}>
                          <CurrencyValue paise={r.amountPaise || 0} />
                        </span>
                        <input 
                          className="checklist-amount-input"
                          style={{ width: '110px', fontSize: '10px', border: 'none', background: 'transparent' }}
                          type="date"
                          value={r.settledAt || ''}
                          onChange={e => handleEditSettledDate(r, e.target.value)}
                        />
                      </div>
                    )}
                    
                    <div className="checklist-actions">
                      {r.status !== 'paid' ? (
                        <>
                          <button className="checklist-btn-edit" onClick={() => handleEdit(r)}>
                            <span className="material-symbols-outlined icon-xs">edit</span>
                          </button>
                          <button className="checklist-btn-settle" onClick={() => handleSettle(r)}>
                            <span className="material-symbols-outlined icon-sm">done</span>
                            SETTLE
                          </button>
                        </>
                      ) : (
                        <button className="checklist-btn-revert" onClick={() => handleRevert(r)}>
                          REVERT
                        </button>
                      )}
                      <button className="checklist-btn-del" onClick={() => deleteReminder(r.id)}>×</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="glass-surface" style={{ padding: '32px' }}>
             <h2 className="text-label-mono color-muted">TACTICAL_CALENDAR_OVERVIEW</h2>
             <div className="checklist-calendar-view">
                {Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1;
                  const hasPaid = reminders.filter(r => r.status === 'paid' && new Date(r.nextDue).getDate() === day);
                  const hasPending = reminders.filter(r => r.status !== 'paid' && new Date(r.nextDue).getDate() === day);
                  return (
                    <div key={i} className={`calendar-day ${day === new Date().getDate() ? 'today' : ''}`}>
                      <span className="text-label-mono-xs">{day}</span>
                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                        {hasPaid.map(p => (
                          <div key={p.id} className={`calendar-dot ${p.type}`} title={`Settled: ${p.title}`} />
                        ))}
                        {hasPending.map(p => (
                          <div key={p.id} className="calendar-dot" style={{ background: 'var(--outline-variant)' }} title={`Pending: ${p.title}`} />
                        ))}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        <aside className="checklist-templates">
          <div className="glass-surface-elevated tpl-card">
            <div className="glass-card-header">
              <span className="text-label-mono color-subtle">QUICK_TEMPLATES</span>
            </div>
            <div className="tpl-list">
              {TEMPLATES.map((tpl, i) => (
                <button key={i} className="tpl-btn" onClick={() => handleAdd(tpl)}>
                  <div className="tpl-btn-info">
                    <span className="text-body-sm">{tpl.title}</span>
                    <span className="text-label-mono-xs color-muted">{tpl.category}</span>
                  </div>
                  <span className="material-symbols-outlined icon-xs">bolt</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {showAdd && (
        <div className="salary-modal-overlay" onClick={() => { resetForm(); setShowAdd(false); }}>
          <div className="glass-surface-elevated salary-modal" style={{ width: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="glass-card-header">
              <span className="text-label-mono">{editingId ? 'EDIT_OBLIGATION' : 'NEW_FINANCIAL_OBLIGATION'}</span>
            </div>
            <div className="salary-modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="salary-field" style={{ gridColumn: '1 / -1' }}>
                <label className="text-label-mono-sm color-muted">TITLE</label>
                <input className="salary-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. BSNL Recharge" />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">CATEGORY</label>
                <input className="salary-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Bills, Loans" />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">TYPE</label>
                <div className="checklist-type-toggle">
                  <button className={`toggle-btn ${type === 'payable' ? 'active' : ''}`} onClick={() => setType('payable')}>PAYABLE</button>
                  <button className={`toggle-btn ${type === 'receivable' ? 'active' : ''}`} onClick={() => setType('receivable')}>RECEIVABLE</button>
                </div>
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">AMOUNT (₹)</label>
                <input className="salary-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">CADENCE</label>
                <select className="salary-input" value={cadence} onChange={e => setCadence(e.target.value as any)}>
                  <option value="one-time">ONE-TIME</option>
                  <option value="monthly">MONTHLY</option>
                  <option value="quarterly">QUARTERLY</option>
                  <option value="annual">ANNUAL</option>
                  <option value="custom">CUSTOM (60D)</option>
                </select>
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  DUE_DATE
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 1); setDueDate(d.toISOString().split('T')[0]); }}>Past Mo</span>
                    <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setDueDate(new Date().toISOString().split('T')[0])}>Today</span>
                  </div>
                </label>
                <input className="salary-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">CREDENTIALS (e.g. Cust ID)</label>
                <input className="salary-input" value={credentials} onChange={e => setCredentials(e.target.value)} placeholder="Optional" />
              </div>
              <div className="salary-field">
                <label className="text-label-mono-sm color-muted">PORTAL_URL</label>
                <input className="salary-input" value={portalUrl} onChange={e => setPortalUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="salary-field" style={{ gridColumn: '1 / -1' }}>
                <label className="text-label-mono-sm color-muted">NOTES</label>
                <textarea 
                  className="salary-input" 
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Additional details..." 
                />
              </div>
            </div>
            <div className="salary-modal-actions">
              <button className="salary-btn-primary" onClick={() => handleAdd()}>{editingId ? 'UPDATE_OBLIGATION' : 'SAVE_TASK'}</button>
              <button className="salary-btn-secondary" onClick={() => { resetForm(); setShowAdd(false); }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
