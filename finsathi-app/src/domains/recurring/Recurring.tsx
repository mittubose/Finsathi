import { useState, useMemo, useEffect, useRef } from 'react';
import {
  useRecurringStore,
  type RecurringRule,
  type RecurringType,
  type RecurringFrequency,
  type RecurringAmountRule,
} from '../../shared/hooks/useRecurringStore';
import { formatINR, toPaise, toRupees } from '../../shared/lib/currency';
import { relativeTime } from '../../shared/lib/dates';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { getCurrentFY } from '../../shared/lib/dates';
import { useSalaryStore } from '../../shared/hooks/useSalaryStore';
import { detectPatterns } from './patternAnalyzer';
import type { PatternSuggestion } from './patternAnalyzer';
import './Recurring.css';

const TYPE_OPTIONS: { value: RecurringType; label: string; icon: string; color: string }[] = [
  { value: 'income', label: 'INCOME', icon: 'trending_up', color: 'positive' },
  { value: 'expense', label: 'EXPENSE', icon: 'trending_down', color: 'warning' },
  { value: 'savings', label: 'SAVINGS', icon: 'savings', color: 'info' },
  { value: 'tax', label: 'TAX', icon: 'account_balance', color: 'negative' },
  { value: 'transfer', label: 'TRANSFER', icon: 'swap_horiz', color: 'neutral' },
];

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  yearly: 'YEARLY',
  custom: 'CUSTOM',
};

const STATUS_COLOR: Record<RecurringRule['status'], string> = {
  active: 'positive',
  paused: 'neutral',
  completed: 'muted',
  overdue: 'negative',
};

const EXPENSE_TEMPLATES = [
  'Rent', 'Electricity', 'Internet', 'Groceries', 'OTT Subscription',
  'Insurance', 'EMI', 'Transport', 'Mobile Bill', 'Gym Membership',
];

const SAVINGS_TEMPLATES = [
  'Equity SIP', 'Mutual Fund SIP', 'Chit Fund', 'Recurring Deposit',
  'PPF Contribution', 'NPS Contribution', 'ELSS Investment',
];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type FilterTab = 'all' | RecurringType;

export function Recurring() {
  const { rules, addRule, updateRule, pauseRule, resumeRule, deleteRule, triggerRule, getOverdueRules } = useRecurringStore();
  const { addIncome, addExpense } = useAppStore();
  const { calculateNet } = useSalaryStore();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [suggestions, setSuggestions] = useState<PatternSuggestion[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [triggerTarget, setTriggerTarget] = useState<RecurringRule | null>(null);
  const [triggerAmount, setTriggerAmount] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const triggerLock = useRef(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<RecurringType>('expense');
  const [formFreq, setFormFreq] = useState<RecurringFrequency>('monthly');
  const [formAmountRule, setFormAmountRule] = useState<RecurringAmountRule>('fixed');
  const [formAmount, setFormAmount] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCustomDays, setFormCustomDays] = useState('30');
  const [formIsSalaryLinked, setFormIsSalaryLinked] = useState(false);

  const overdue = getOverdueRules();

  // Update amount if salary linked
  useEffect(() => {
    if (formIsSalaryLinked && formType === 'income') {
      const now = new Date();
      const liveNet = calculateNet(now.getFullYear(), now.getMonth());
      setFormAmount(toRupees(liveNet).toString());
      setFormAmountRule('fixed');
      setFormTitle('Monthly Salary');
    }
  }, [formIsSalaryLinked, formType, calculateNet]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return rules;
    return rules.filter((r) => r.type === activeTab);
  }, [rules, activeTab]);

  const handleSaveRule = () => {
    if (!formTitle) return;
    const amountPaise = formAmountRule === 'variable' ? null : toPaise(Number(formAmount));
    
    const ruleData = {
      title: formTitle,
      type: formType,
      frequency: formFreq,
      customIntervalDays: formFreq === 'custom' ? Number(formCustomDays) : undefined,
      amountRule: formAmountRule,
      amountPaise,
      startDate: formStartDate,
      endDate: formEndDate || undefined,
      nextDueDate: formStartDate,
      source: 'manual' as const,
      status: 'active' as const,
      isSalaryLinked: formIsSalaryLinked,
      notes: formNotes,
    };

    if (editingId) {
      updateRule(editingId, ruleData);
    } else {
      addRule(ruleData);
    }
    resetForm();
    setShowForm(false);
  };

  const handleEdit = (rule: RecurringRule) => {
    setEditingId(rule.id);
    setFormTitle(rule.title);
    setFormType(rule.type);
    setFormFreq(rule.frequency);
    setFormAmountRule(rule.amountRule);
    setFormAmount(rule.amountPaise !== null ? toRupees(rule.amountPaise).toString() : '');
    setFormStartDate(rule.startDate);
    setFormEndDate(rule.endDate || '');
    setFormNotes(rule.notes);
    setFormCustomDays(rule.customIntervalDays?.toString() || '30');
    setFormIsSalaryLinked(rule.isSalaryLinked || false);
    setShowForm(true);
  };

  const handleTrigger = async (rule: RecurringRule) => {
    if (triggerLock.current) return;
    
    // Check if an entry for this rule already exists for the target month to prevent duplicates
    const { incomeItems, expenseItems } = useAppStore.getState();
    const { postedMonths, markMonthAsPosted } = useSalaryStore.getState();
    const targetMonth = rule.nextDueDate.slice(0, 7); // 'YYYY-MM'
    
    // Global check for salary-linked rules across BOTH modules
    if (rule.isSalaryLinked && postedMonths?.includes(targetMonth)) {
      alert(`Salary for ${targetMonth} has already been posted to the ledger (via Salary Architecture).`);
      return;
    }

    const duplicateIncome = incomeItems.find(i => i.recurringRuleId === rule.id && i.date.startsWith(targetMonth));
    const duplicateExpense = expenseItems.find(e => e.recurringRuleId === rule.id && e.date.startsWith(targetMonth));
    
    if (duplicateIncome || duplicateExpense) {
      alert(`Duplicate detected: Entry for ${targetMonth} already exists in the ledger.`);
      return;
    }

    let amount = rule.amountPaise;
    if (rule.isSalaryLinked) {
      // Pull net for the target month
      const targetMonthDate = new Date(rule.nextDueDate);
      amount = calculateNet(targetMonthDate.getFullYear(), targetMonthDate.getMonth());
    } else if (amount === null) {
      amount = toPaise(Number(triggerAmount));
    }

    if (!amount) return;

    triggerLock.current = true;
    setIsTriggering(true);
    
    try {
      const entryId = generateId();
      if (rule.type === 'income') {
        // For salary-linked, use 1st of NEXT month as receipt date
        let receiptDate = rule.nextDueDate;
        if (rule.isSalaryLinked) {
           const d = new Date(rule.nextDueDate);
           const disbursement = new Date(d.getFullYear(), d.getMonth() + 1, 1);
           receiptDate = disbursement.toISOString().split('T')[0];
        }

        addIncome({
          id: entryId,
          type: 'income',
          head: rule.isSalaryLinked ? 'salary' : 'other',
          amountPaise: amount,
          source: rule.title,
          fy: getCurrentFY(),
          isTaxable: true,
          notes: `Auto-triggered from rule: ${rule.title}`,
          tags: ['recurring', ...(rule.isSalaryLinked ? ['salary'] : [])],
          date: receiptDate,
          createdAt: new Date().toISOString(),
          recurringRuleId: rule.id
        });

        // Mark globally as posted in Salary Store if linked
        if (rule.isSalaryLinked) {
          markMonthAsPosted(targetMonth);
        }
      } else if (rule.type === 'expense') {
        addExpense({
          id: entryId,
          type: 'expense',
          category: rule.category ?? 'Other',
          amountPaise: amount,
          date: rule.nextDueDate,
          merchant: rule.title,
          notes: `Auto-triggered from rule: ${rule.title}`,
          tags: ['recurring'],
          isRecurring: true,
          createdAt: new Date().toISOString(),
          recurringRuleId: rule.id
        });
      }

      triggerRule(rule.id, amount, entryId, `Triggered for ${targetMonth}`);
      setTriggerTarget(null);
      setTriggerAmount('');
    } finally {
      setTimeout(() => {
        triggerLock.current = false;
        setIsTriggering(false);
      }, 500);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormTitle(''); setFormType('expense'); setFormFreq('monthly');
    setFormAmountRule('fixed'); setFormAmount(''); setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate(''); setFormNotes(''); setFormCustomDays('30');
    setFormIsSalaryLinked(false);
  };

  const handleAddSuggestion = (suggestion: PatternSuggestion) => {
    resetForm();
    setFormTitle(suggestion.title);
    setFormType(suggestion.type);
    setFormAmountRule('fixed');
    setFormAmount(toRupees(suggestion.averageAmountPaise).toString());
    setFormFreq('monthly');
    setShowForm(true);
    setSuggestions(null); // Close suggestions
  };

  const tabs: FilterTab[] = ['all', 'income', 'expense', 'savings', 'tax', 'transfer'];

  return (
    <div className="recurring-page">
      {/* Header */}
      <div className="recurring-header">
        <div>
          <h1 className="text-headline-md">RECURRING_RULES</h1>
          <p className="text-label-mono-sm color-muted" style={{ marginTop: '2px' }}>
            {rules.length} RULES · {overdue.length > 0 ? <span style={{ color: 'var(--error)' }}>{overdue.length} OVERDUE</span> : '0 OVERDUE'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="recurring-action-btn"
            style={{ padding: '0 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}
            onClick={() => setSuggestions(suggestions ? null : detectPatterns())}
          >
            <span className="material-symbols-outlined icon-sm">manage_search</span>
            <span className="text-label-mono">AUTO-DETECT</span>
          </button>
          <button
            className={`recurring-new-btn ${showForm ? 'active' : ''}`}
            onClick={() => { setShowForm(!showForm); resetForm(); }}
          >
            <span className="material-symbols-outlined icon-sm">{showForm ? 'close' : 'add'}</span>
            <span className="text-label-mono">{showForm ? 'CANCEL' : 'NEW_RULE'}</span>
          </button>
        </div>
      </div>

      {/* Pattern Suggestions */}
      {suggestions !== null && (
        <div className="glass-surface settings-section" style={{ marginBottom: '16px', background: 'rgba(59, 130, 246, 0.05)' }}>
          <div className="glass-card-header">
            <span className="text-label-mono color-info">DETECTED PATTERNS ({suggestions.length})</span>
            <button className="recurring-action-btn" onClick={() => setSuggestions(null)}>
              <span className="material-symbols-outlined icon-xs">close</span>
            </button>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestions.length === 0 && <span className="text-label-mono-sm color-muted">No missing patterns found! You're fully tracked.</span>}
            {suggestions.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="text-body" style={{ fontWeight: 500 }}>{s.title}</span>
                  <span className="text-label-mono-sm color-muted">
                    Found {s.detectedCount} times · Avg: {formatINR(s.averageAmountPaise)}
                  </span>
                </div>
                <button 
                  className="btn-primary"
                  style={{ fontSize: '11px', padding: '4px 12px' }}
                  onClick={() => handleAddSuggestion(s)}
                >
                  REVIEW & ADD
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Banner */}
      {overdue.length > 0 && (
        <div className="glass-surface recurring-overdue-banner">
          <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--error)' }}>warning</span>
          <span className="text-label-mono" style={{ color: 'var(--error)', fontSize: '10px' }}>
            {overdue.length} OVERDUE_RULE{overdue.length > 1 ? 'S' : ''} — MARK AS PAID OR REVIEW
          </span>
          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {overdue.slice(0, 3).map((r) => (
              <span key={r.id} className="recurring-overdue-tag">{r.title}</span>
            ))}
          </div>
        </div>
      )}

      {/* Add Rule Form */}
      {showForm && (
        <div className="glass-surface-elevated recurring-form">
          <div className="glass-card-header">
            <h2 className="text-label-mono color-positive">
              {editingId ? 'EDIT_RECURRING_RULE' : 'NEW_RECURRING_RULE'}
            </h2>
          </div>
          <div className="recurring-form-body">
            {/* Type Selector */}
            <div className="recurring-field" style={{ gridColumn: '1 / -1' }}>
              <label className="text-label-mono-sm color-muted">TYPE</label>
              <div className="recurring-type-chips">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    className={`recurring-type-chip recurring-type-chip--${t.color} ${formType === t.value ? 'active' : ''}`}
                    onClick={() => setFormType(t.value)}
                  >
                    <span className="material-symbols-outlined icon-xs">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Salary Link Toggle */}
            {formType === 'income' && (
              <div className="recurring-field" style={{ gridColumn: '1 / -1' }}>
                <label className="recurring-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={formIsSalaryLinked} 
                    onChange={e => setFormIsSalaryLinked(e.target.checked)} 
                  />
                  <span className="text-label-mono-sm">LINK_TO_SALARY_STRUCTURE</span>
                </label>
              </div>
            )}

            {/* Title with template suggestions */}
            <div className="recurring-field" style={{ gridColumn: '1 / -1' }}>
              <label className="text-label-mono-sm color-muted">TITLE</label>
              <input
                className="recurring-input"
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Monthly Rent, Salary, SIP"
                disabled={formIsSalaryLinked}
                list="recurring-title-suggestions"
              />
              <datalist id="recurring-title-suggestions">
                {(formType === 'expense' ? EXPENSE_TEMPLATES : formType === 'savings' ? SAVINGS_TEMPLATES : []).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            {/* Frequency */}
            <div className="recurring-field">
              <label className="text-label-mono-sm color-muted">FREQUENCY</label>
              <select className="recurring-select" value={formFreq} onChange={(e) => setFormFreq(e.target.value as RecurringFrequency)}>
                {Object.entries(FREQ_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {formFreq === 'custom' && (
              <div className="recurring-field">
                <label className="text-label-mono-sm color-muted">INTERVAL (DAYS)</label>
                <input className="recurring-input" type="number" value={formCustomDays} onChange={(e) => setFormCustomDays(e.target.value)} min="1" />
              </div>
            )}

            {/* Amount Rule */}
            <div className="recurring-field">
              <label className="text-label-mono-sm color-muted">AMOUNT_RULE</label>
              <select 
                className="recurring-select" 
                value={formAmountRule} 
                onChange={(e) => setFormAmountRule(e.target.value as RecurringAmountRule)}
                disabled={formIsSalaryLinked}
              >
                <option value="fixed">FIXED</option>
                <option value="variable">VARIABLE (set at trigger)</option>
                <option value="estimate">ESTIMATE</option>
              </select>
            </div>

            {formAmountRule !== 'variable' && (
              <div className="recurring-field">
                <label className="text-label-mono-sm color-muted">AMOUNT (₹)</label>
                <input 
                  className="recurring-input" 
                  type="number" 
                  value={formAmount} 
                  onChange={(e) => setFormAmount(e.target.value)} 
                  placeholder="0" 
                  min="0" 
                  disabled={formIsSalaryLinked}
                />
              </div>
            )}

            {/* Dates */}
            <div className="recurring-field">
              <label className="text-label-mono-sm color-muted">START_DATE</label>
              <input className="recurring-input" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
            </div>

            <div className="recurring-field">
              <label className="text-label-mono-sm color-muted">END_DATE (OPTIONAL)</label>
              <input className="recurring-input" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
            </div>

            <div className="recurring-field" style={{ gridColumn: '1 / -1' }}>
              <label className="text-label-mono-sm color-muted">NOTES</label>
              <input className="recurring-input" type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="recurring-form-actions">
            <button className="recurring-save-btn" onClick={handleSaveRule} disabled={!formTitle}>
              {editingId ? 'UPDATE_RULE' : 'SAVE_RULE'}
            </button>
            <button className="recurring-cancel-btn" onClick={() => { setShowForm(false); resetForm(); }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="recurring-tabs">
        {tabs.map((tab) => {
          const count = tab === 'all' ? rules.length : rules.filter((r) => r.type === tab).length;
          return (
            <button
              key={tab}
              className={`recurring-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
              {count > 0 && <span className="recurring-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Rules List */}
      <div className="glass-surface recurring-list">
        {filtered.length === 0 ? (
          <div className="recurring-empty">
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'rgba(255,255,255,0.1)' }}>autorenew</span>
            <span className="text-label-mono color-muted" style={{ marginTop: '8px' }}>NO_RULES_{activeTab.toUpperCase()}</span>
            <span className="text-body color-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
              Create a recurring rule to track scheduled flows
            </span>
          </div>
        ) : (
          filtered.map((rule) => {
            const typeConfig = TYPE_OPTIONS.find((t) => t.value === rule.type)!;
            const isOverdue = rule.status === 'active' && new Date(rule.nextDueDate) < new Date();
            return (
              <div key={rule.id} className={`glass-row recurring-rule-row ${isOverdue ? 'overdue' : ''}`}>
                {/* Type icon */}
                <div className={`recurring-rule-icon recurring-rule-icon--${typeConfig.color}`}>
                  <span className="material-symbols-outlined icon-xs" style={{ fontVariationSettings: "'wght' 200" }}>
                    {typeConfig.icon}
                  </span>
                </div>

                {/* Info */}
                <div className="recurring-rule-info">
                  <div className="text-body" style={{ fontWeight: 500 }}>
                    {rule.title}
                    {rule.isSalaryLinked && (
                      <span className="recurring-link-badge">SALARY_LINKED</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span className="text-label-mono-sm color-muted">{FREQ_LABELS[rule.frequency]}</span>
                    <span className="text-label-mono-sm color-muted">·</span>
                    <span className={`recurring-status-badge recurring-status-badge--${STATUS_COLOR[rule.status]}`}>
                      {isOverdue ? 'OVERDUE' : rule.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Amount + next due */}
                <div className="recurring-rule-meta">
                  <div className={`text-data-display ${typeConfig.color === 'positive' ? 'color-positive' : ''}`} style={{ fontSize: '12px' }}>
                    {rule.isSalaryLinked 
                      ? formatINR(calculateNet(new Date().getFullYear(), new Date().getMonth())) 
                      : (rule.amountPaise !== null ? formatINR(rule.amountPaise) : 'VARIABLE')}
                  </div>
                  <div className="text-label-mono-sm color-muted" style={{ marginTop: '2px' }}>
                    NEXT: {relativeTime(new Date(rule.nextDueDate))}
                  </div>
                </div>

                {/* Actions */}
                <div className="recurring-rule-actions">
                  {rule.status === 'active' && (
                    <button
                      className="recurring-action-btn recurring-action-btn--trigger"
                      title="Trigger now"
                      disabled={isTriggering}
                      onClick={() => {
                        if (rule.isSalaryLinked || rule.amountPaise !== null) {
                          handleTrigger(rule);
                        } else {
                          setTriggerTarget(rule);
                        }
                      }}
                    >
                      <span className="material-symbols-outlined icon-xs">play_arrow</span>
                    </button>
                  )}
                  <button
                    className="recurring-action-btn"
                    title="Edit"
                    onClick={() => handleEdit(rule)}
                  >
                    <span className="material-symbols-outlined icon-xs">edit</span>
                  </button>
                  <button
                    className="recurring-action-btn"
                    title={rule.status === 'active' ? 'Pause' : 'Resume'}
                    onClick={() => rule.status === 'active' ? pauseRule(rule.id) : resumeRule(rule.id)}
                  >
                    <span className="material-symbols-outlined icon-xs">
                      {rule.status === 'active' ? 'pause' : 'play_circle'}
                    </span>
                  </button>
                  <button
                    className="recurring-action-btn recurring-action-btn--delete"
                    title="Delete"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <span className="material-symbols-outlined icon-xs">close</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Variable Amount Trigger Modal */}
      {triggerTarget && (
        <div className="recurring-trigger-overlay" onClick={() => setTriggerTarget(null)}>
          <div className="glass-surface-elevated recurring-trigger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="glass-card-header">
              <h2 className="text-label-mono color-positive">TRIGGER: {triggerTarget.title}</h2>
            </div>
            <div style={{ padding: '12px' }}>
              <label className="text-label-mono-sm color-muted">AMOUNT THIS TIME (₹)</label>
              <input
                className="recurring-input"
                type="number"
                value={triggerAmount}
                onChange={(e) => setTriggerAmount(e.target.value)}
                placeholder="0"
                autoFocus
                style={{ marginTop: '4px' }}
              />
            </div>
            <div className="recurring-form-actions">
              <button className="recurring-save-btn" onClick={() => handleTrigger(triggerTarget)} disabled={!triggerAmount}>
                CONFIRM_TRIGGER
              </button>
              <button className="recurring-cancel-btn" onClick={() => setTriggerTarget(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
