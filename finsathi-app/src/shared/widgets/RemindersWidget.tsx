import { useAppStore } from '../hooks/useAppStore';
import { formatINRCompact } from '../lib/currency';
import { useNavigate } from 'react-router-dom';

export function RemindersWidget() {
  const navigate = useNavigate();
  const { reminders, updateReminder } = useAppStore();

  const pending = reminders.filter(r => r.status !== 'paid' && r.status !== 'dismissed');

  const handleTogglePaid = (id: string) => {
    updateReminder(id, { 
      status: 'paid',
      settledAt: new Date().toISOString()
    });
  };

  return (
    <div className="reminders-widget-content">
      {pending.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '11px' }}>
          ALL_OBLIGATIONS_SETTLED • NO_PENDING_BILLS
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {pending.slice(0, 4).map((rem) => (
            <div 
              key={rem.id} 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '2px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="text-body-bold" style={{ fontSize: '12px' }}>{rem.title}</span>
                <span className="text-label-mono-xs color-muted">
                  Due: {new Date(rem.nextDue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {rem.category}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-data-display" style={{ fontSize: '12px', color: '#ffd79b' }}>
                  {rem.amountPaise ? formatINRCompact(rem.amountPaise) : 'VAR'}
                </span>
                <button
                  onClick={() => handleTogglePaid(rem.id)}
                  style={{
                    background: 'rgba(0,255,65,0.08)',
                    border: '1px solid rgba(0,255,65,0.25)',
                    color: 'var(--primary-container)',
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    cursor: 'pointer',
                    borderRadius: '2px'
                  }}
                >
                  PAID ✓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button 
          onClick={() => navigate('/reminders')}
          style={{ background: 'none', border: 'none', color: 'var(--primary-container)', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer' }}
        >
          VIEW ALL REMINDERS →
        </button>
      </div>
    </div>
  );
}
