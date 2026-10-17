import { useState, useEffect } from 'react';
import { useAppStore, type IncomeItem, type ExpenseItem, type LedgerItem } from '../../shared/hooks/useAppStore';
import { formatINR, toPaise, toRupees } from '../../shared/lib/currency';
import { relativeTime } from '../../shared/lib/dates';
import { auditLog } from '../../shared/hooks/useAuditStore';
import './LedgerDetail.css';

interface LedgerDetailProps {
  record: any;
  onClose: () => void;
}

export function LedgerDetail({ record, onClose }: LedgerDetailProps) {
  const { updateIncome, updateExpense } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (record) {
      setFormData({ ...record });
      setIsEditing(false);
    }
  }, [record]);

  if (!record) return null;

  const handleSave = () => {
    const isIncome = record.type === 'income';
    const updates = { ...formData };
    
    if (isIncome) {
      updateIncome(record.id, updates as Partial<IncomeItem>);
    } else {
      updateExpense(record.id, updates as Partial<ExpenseItem>);
    }

    auditLog({
      action: 'UPDATE',
      entity: record.type,
      label: `Updated ${record.type} record: ${record.id}`,
      details: `Field changes applied via detail editor.`,
    });

    setIsEditing(false);
  };

  const isIncome = record.type === 'income';

  return (
    <div className="ledger-detail-overlay" onClick={onClose}>
      <div className="ledger-detail-panel glass-surface-elevated animate-in-right" onClick={(e) => e.stopPropagation()}>
        <div className="ledger-detail-header">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-label-mono color-subtle">RECORD_DETAIL</h2>
            <span className="text-label-mono-sm color-muted">ID: {record.id}</span>
          </div>
          <button className="ledger-detail-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="ledger-detail-content">
          <div className="ledger-detail-hero glass-surface">
            <span className={`text-headline-md ${isIncome ? 'color-positive' : ''}`}>
              {isIncome ? '+' : '-'}{formatINR(record.amountPaise)}
            </span>
            <span className="text-label-mono-sm color-muted">
              {isIncome ? 'TOTAL_INCOME' : 'TOTAL_EXPENSE'}
            </span>
          </div>

          <div className="ledger-detail-sections">
            {/* Metadata Section */}
            <div className="detail-section">
              <div className="detail-section-header">
                <span className="text-label-mono-sm color-muted">METADATA</span>
                {!isEditing && (
                  <button className="text-label-mono-sm color-positive" onClick={() => setIsEditing(true)}>EDIT_RECORD</button>
                )}
              </div>
              
              <div className="detail-grid">
                <div className="detail-field">
                  <label className="text-label-mono-sm color-muted">TYPE</label>
                  <span className="text-body">{record.type.toUpperCase()}</span>
                </div>
                <div className="detail-field">
                  <label className="text-label-mono-sm color-muted">{isIncome ? 'HEAD' : 'CATEGORY'}</label>
                  {isEditing ? (
                    <input 
                      className="detail-input" 
                      value={(formData as any)[isIncome ? 'head' : 'category']} 
                      onChange={(e) => setFormData({ ...formData, [isIncome ? 'head' : 'category']: e.target.value })}
                    />
                  ) : (
                    <span className="text-body">{(record as any)[isIncome ? 'head' : 'category']?.toUpperCase()}</span>
                  )}
                </div>
                <div className="detail-field">
                  <label className="text-label-mono-sm color-muted">DATE</label>
                  {isEditing ? (
                    <input 
                      className="detail-input" 
                      type="date" 
                      value={formData.date?.split('T')[0]} 
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  ) : (
                    <span className="text-body">{new Date(record.date).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
                  )}
                </div>
                <div className="detail-field">
                  <label className="text-label-mono-sm color-muted">AMOUNT (₹)</label>
                  {isEditing ? (
                    <input 
                      className="detail-input" 
                      type="number" 
                      defaultValue={toRupees(record.amountPaise)}
                      onBlur={(e) => setFormData({ ...formData, amountPaise: toPaise(Number(e.target.value)) })}
                    />
                  ) : (
                    <span className="text-body">{formatINR(record.amountPaise)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Entity Section */}
            <div className="detail-section">
              <label className="text-label-mono-sm color-muted">{isIncome ? 'SOURCE' : 'MERCHANT'}</label>
              {isEditing ? (
                <input 
                  className="detail-input" 
                  value={(formData as any)[isIncome ? 'source' : 'merchant']} 
                  onChange={(e) => setFormData({ ...formData, [isIncome ? 'source' : 'merchant']: e.target.value })}
                />
              ) : (
                <span className="text-headline-sm" style={{ marginTop: '4px', display: 'block' }}>
                  {(record as any)[isIncome ? 'source' : 'merchant'] || 'N/A'}
                </span>
              )}
            </div>

            {/* Notes Section */}
            <div className="detail-section">
              <label className="text-label-mono-sm color-muted">NOTES</label>
              {isEditing ? (
                <textarea 
                  className="detail-textarea" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              ) : (
                <p className="text-body" style={{ marginTop: '4px', color: record.notes ? 'var(--on-surface)' : 'rgba(255,255,255,0.2)' }}>
                  {record.notes || 'No additional notes provided for this record.'}
                </p>
              )}
            </div>

            {/* Audit Section */}
            <div className="detail-section" style={{ border: 'none', background: 'rgba(0,0,0,0.2)', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-label-mono-sm color-muted">SYSTEM_AUDIT</span>
                <span className="text-label-mono-sm color-positive">STABLE</span>
              </div>
              <div className="audit-item">
                <span className="text-label-mono-sm color-muted">CREATED:</span>
                <span className="text-label-mono-sm">{new Date(record.createdAt).toLocaleString('en-IN')} ({relativeTime(new Date(record.createdAt))})</span>
              </div>
              <div className="audit-item" style={{ marginTop: '4px' }}>
                <span className="text-label-mono-sm color-muted">SOURCE:</span>
                <span className="text-label-mono-sm">USER_MANUAL_ENTRY</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ledger-detail-footer">
          {isEditing ? (
            <>
              <button className="detail-save-btn" onClick={handleSave}>SAVE_CHANGES</button>
              <button className="detail-cancel-btn" onClick={() => setIsEditing(false)}>DISCARD</button>
            </>
          ) : (
            <button className="detail-cancel-btn" onClick={onClose} style={{ width: '100%' }}>CLOSE_DRAWER</button>
          )}
        </div>
      </div>
    </div>
  );
}
