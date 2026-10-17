import { useState, useMemo } from 'react';
import { useAppStore, type Reminder } from '../../shared/hooks/useAppStore';
import { formatINR, toPaise } from '../../shared/lib/currency';
import { CurrencyValue } from '../../shared/ui/CurrencyValue';
import './Reminders.css';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusFromDate(nextDue: string, current: Reminder['status']): Reminder['status'] {
  if (current === 'paid' || current === 'dismissed') return current;
  const days = daysUntil(nextDue);
  if (days < 0) return 'overdue';
  if (days <= 3) return 'due_soon';
  return 'upcoming';
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  overdue: { label: 'OVERDUE', className: 'status-overdue', icon: 'error' },
  due_soon: { label: 'DUE_SOON', className: 'status-due-soon', icon: 'warning' },
  upcoming: { label: 'UPCOMING', className: 'status-upcoming', icon: 'schedule' },
  paid: { label: 'PAID', className: 'status-paid', icon: 'check_circle' },
  dismissed: { label: 'DISMISSED', className: 'status-dismissed', icon: 'do_not_disturb_on' },
};

export function Reminders() {
  const { reminders, addReminder, updateReminder, deleteReminder } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all' | 'paid'>('active');

  // Form
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Reminder['cadence']>('monthly');
  const [nextDue, setNextDue] = useState('');
  const [leadDays, setLeadDays] = useState('3');

  const handleAdd = () => {
    if (!title || !nextDue) return;
    addReminder({
      id: generateId(),
      title,
      type: 'payable',
      category: 'General',
      amountPaise: amount ? toPaise(Number(amount)) : null,
      cadence,
      nextDue,
      leadDays: leadDays.split(',').map((d) => parseInt(d.trim())).filter((n) => !isNaN(n)),
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    });
    setTitle(''); setAmount(''); setNextDue(''); setLeadDays('3');
    setShowForm(false);
  };

  const markPaid = (id: string) => updateReminder(id, { status: 'paid' });
  const dismiss = (id: string) => updateReminder(id, { status: 'dismissed' });
  const reactivate = (id: string) => updateReminder(id, { status: 'upcoming' });

  // Compute live status
  const enriched = useMemo(() =>
    reminders.map((r) => ({
      ...r,
      liveStatus: getStatusFromDate(r.nextDue, r.status),
      daysLeft: daysUntil(r.nextDue),
    })),
    [reminders]
  );

  const filtered = enriched.filter((r) => {
    if (filter === 'active') return r.liveStatus !== 'paid' && r.liveStatus !== 'dismissed';
    if (filter === 'paid') return r.liveStatus === 'paid' || r.liveStatus === 'dismissed';
    return true;
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  const overdueCount = enriched.filter((r) => r.liveStatus === 'overdue').length;
  const dueSoonCount = enriched.filter((r) => r.liveStatus === 'due_soon').length;
  const totalMonthly = enriched
    .filter((r) => r.liveStatus !== 'paid' && r.liveStatus !== 'dismissed' && r.amountPaise)
    .reduce((sum, r) => {
      if (!r.amountPaise) return sum;
      const mult = r.cadence === 'monthly' ? 1 : r.cadence === 'quarterly' ? 1/3 : r.cadence === 'annual' ? 1/12 : 1;
      return sum + Math.floor(r.amountPaise * mult);
    }, 0);

  return (
    <div className="reminders">
      <div className="reminders-header">
        <h1 className="text-headline-md">REMINDERS</h1>
        <button
          className={`reminders-add-btn ${showForm ? 'active' : ''}`}
          onClick={() => setShowForm(!showForm)}
        >
          <span className="material-symbols-outlined icon-sm">{showForm ? 'close' : 'add'}</span>
          <span className="text-label-mono">{showForm ? 'CANCEL' : 'ADD'}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="reminders-stats">
        <div className="reminders-stat-item">
          <span className="text-label-mono-sm color-muted">OVERDUE</span>
          <span className={`text-headline-md ${overdueCount > 0 ? 'color-negative' : 'color-muted'}`}>{overdueCount}</span>
        </div>
        <div className="reminders-stat-item">
          <span className="text-label-mono-sm color-muted">DUE_SOON</span>
          <span className={`text-headline-md ${dueSoonCount > 0 ? 'color-warning' : 'color-muted'}`}>{dueSoonCount}</span>
        </div>
        <div className="reminders-stat-item">
          <span className="text-label-mono-sm color-muted">MONTHLY_BURN</span>
          <span className="text-headline-md"><CurrencyValue paise={totalMonthly} /></span>
        </div>
        <div className="reminders-stat-item">
          <span className="text-label-mono-sm color-muted">TOTAL_ACTIVE</span>
          <span className="text-headline-md">{enriched.filter((r) => r.liveStatus !== 'paid' && r.liveStatus !== 'dismissed').length}</span>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="reminders-form glass-surface-elevated">
          <div className="glass-card-header">
            <h2 className="text-label-mono color-positive">NEW_REMINDER</h2>
          </div>
          <div className="reminders-form-grid">
            <div className="reminders-field">
              <label className="text-label-mono-sm color-muted">TITLE</label>
              <input className="reminders-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rent, SIP, Insurance..." />
            </div>
            <div className="reminders-field">
              <label className="text-label-mono-sm color-muted">AMOUNT (₹)</label>
              <input className="reminders-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Optional" />
            </div>
            <div className="reminders-field">
              <label className="text-label-mono-sm color-muted">CADENCE</label>
              <select className="reminders-select" value={cadence} onChange={(e) => setCadence(e.target.value as Reminder['cadence'])}>
                <option value="monthly">MONTHLY</option>
                <option value="quarterly">QUARTERLY</option>
                <option value="annual">ANNUAL</option>
                <option value="custom">CUSTOM</option>
              </select>
            </div>
            <div className="reminders-field">
              <label className="text-label-mono-sm color-muted">NEXT_DUE</label>
              <input className="reminders-input" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </div>
            <div className="reminders-field">
              <label className="text-label-mono-sm color-muted">LEAD_DAYS</label>
              <input className="reminders-input" type="text" value={leadDays} onChange={(e) => setLeadDays(e.target.value)} placeholder="3,7" />
            </div>
          </div>
          <div className="reminders-form-actions">
            <button className="reminders-save-btn" onClick={handleAdd}>SAVE</button>
            <button className="reminders-cancel-btn" onClick={() => setShowForm(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="reminders-filters">
        {(['active', 'all', 'paid'] as const).map((f) => (
          <button
            key={f}
            className={`reminders-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="glass-surface reminders-list">
        {filtered.length === 0 ? (
          <div className="reminders-empty">
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'rgba(255,255,255,0.12)' }}>notifications</span>
            <span className="text-label-mono color-muted" style={{ marginTop: '8px' }}>NO_REMINDERS</span>
            <span className="text-body color-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
              Track rent, SIPs, insurance premiums, EMIs, and advance tax
            </span>
          </div>
        ) : (
          filtered.map((r) => {
            const sc = STATUS_CONFIG[r.liveStatus];
            return (
              <div key={r.id} className={`glass-row reminders-row ${r.liveStatus === 'overdue' ? 'reminders-row--alert' : ''}`}>
                <div className="reminders-row-left">
                  <div className={`reminders-status-pip ${sc.className}`}>
                    <span className="material-symbols-outlined icon-xs" style={{ fontVariationSettings: "'wght' 300" }}>
                      {sc.icon}
                    </span>
                  </div>
                  <div className="reminders-row-info">
                    <div className="text-body" style={{ fontWeight: 500 }}>{r.title}</div>
                    <div className="text-label-mono-sm color-muted">
                      {r.cadence.toUpperCase()} · {new Date(r.nextDue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="reminders-row-center">
                  <span className={`text-label-mono-sm ${sc.className}`}>{sc.label}</span>
                  <span className="text-label-mono-sm color-muted">
                    {r.daysLeft > 0 ? `${r.daysLeft}D LEFT` : r.daysLeft === 0 ? 'TODAY' : `${Math.abs(r.daysLeft)}D LATE`}
                  </span>
                </div>
                <div className="reminders-row-right">
                  {r.amountPaise && (
                    <span className="text-data-display" style={{ fontSize: '12px' }}>
                      <CurrencyValue paise={r.amountPaise} />
                    </span>
                  )}
                  <div className="reminders-row-actions">
                    {r.liveStatus !== 'paid' && r.liveStatus !== 'dismissed' ? (
                      <>
                        <button className="reminders-action-btn reminders-action-btn--pay" onClick={() => markPaid(r.id)} title="Mark Paid">
                          <span className="material-symbols-outlined icon-xs">check</span>
                        </button>
                        <button className="reminders-action-btn" onClick={() => dismiss(r.id)} title="Dismiss">
                          <span className="material-symbols-outlined icon-xs">do_not_disturb_on</span>
                        </button>
                      </>
                    ) : (
                      <button className="reminders-action-btn" onClick={() => reactivate(r.id)} title="Reactivate">
                        <span className="material-symbols-outlined icon-xs">replay</span>
                      </button>
                    )}
                    <button className="reminders-action-btn reminders-action-btn--delete" onClick={() => deleteReminder(r.id)} title="Delete">
                      <span className="material-symbols-outlined icon-xs">close</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
