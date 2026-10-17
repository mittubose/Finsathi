import React, { useState, useEffect } from 'react';
import { useProfileStore } from '../../shared/hooks/useProfileStore';
import { 
  getProfileSnapshotHistory, 
  restoreProfileSnapshotByIndex, 
  saveProfileSnapshot, 
  deepRecoverAccountData,
  getAccountChecklist,
  saveAccountChecklist,
  type SnapshotMetadata,
  type AccountChecklistItem,
  type RecoveryReport
} from '../../shared/lib/profileDataManager';
import { useAuditStore, type AuditEntry } from '../../shared/hooks/useAuditStore';
import { useToast } from '../../shared/ui/Toast';
import { useNavigate } from 'react-router-dom';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountManagerModal({ isOpen, onClose }: AccountManagerModalProps) {
  const { profiles, activeProfileId, getActiveProfile, setActiveProfile } = useProfileStore();
  const { entries } = useAuditStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'recovery' | 'checklist' | 'audit'>('recovery');
  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [checklist, setChecklist] = useState<AccountChecklistItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReport | null>(null);

  const activeProfile = getActiveProfile();

  useEffect(() => {
    if (isOpen && activeProfileId) {
      setSnapshots(getProfileSnapshotHistory(activeProfileId));
      setChecklist(getAccountChecklist(activeProfileId));
      setRecoveryReport(null);
    }
  }, [isOpen, activeProfileId]);

  if (!isOpen) return null;

  const handleDeepRecovery = async () => {
    setIsScanning(true);
    setRecoveryReport(null);
    try {
      const report = await deepRecoverAccountData(activeProfileId);
      setRecoveryReport(report);
      setSnapshots(getProfileSnapshotHistory(activeProfileId));
      toast(`Recovery scan finished! Recovered ${report.recoveredRecurringRules} recurring rules.`, 'success');
    } catch (err: any) {
      toast(`Recovery scan failed: ${err.message}`, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreateSnapshot = async () => {
    await saveProfileSnapshot(activeProfileId, `Manual Snapshot (${new Date().toLocaleDateString()})`);
    setSnapshots(getProfileSnapshotHistory(activeProfileId));
    toast('Account snapshot successfully created!', 'success');
  };

  const handleRestoreSnapshot = async (index: number) => {
    if (!window.confirm('Restore this snapshot? Current unsaved modifications will be reverted.')) return;
    const ok = await restoreProfileSnapshotByIndex(activeProfileId, index);
    if (ok) {
      toast('Account state successfully restored from snapshot!', 'success');
      setSnapshots(getProfileSnapshotHistory(activeProfileId));
    } else {
      toast('Failed to restore snapshot', 'error');
    }
  };

  const handleToggleChecklist = (id: string) => {
    const updated = checklist.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updated);
    saveAccountChecklist(activeProfileId, updated);
  };

  const completedCount = checklist.filter(c => c.completed).length;
  const healthPercent = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface-color, #12141a)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary, #00e676)' }}>
                account_circle
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                Account Vault & Data Recovery
              </h2>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Managing: <strong style={{ color: 'var(--text-primary)' }}>{activeProfile.name}</strong> ({activeProfile.tag}) • ID: {activeProfile.id}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Quick Profile Switch */}
            <select
              value={activeProfileId}
              onChange={(e) => setActiveProfile(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px'
              }}
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id} style={{ background: '#1a1d26' }}>
                  {p.name} ({p.role.toUpperCase()})
                </option>
              ))}
            </select>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <button
            onClick={() => setActiveTab('recovery')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'recovery' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'recovery' ? '2px solid var(--brand-primary, #00e676)' : '2px solid transparent',
              color: activeTab === 'recovery' ? 'var(--brand-primary, #00e676)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>history</span>
            Data Recovery & Snapshots
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'checklist' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'checklist' ? '2px solid var(--brand-primary, #00e676)' : '2px solid transparent',
              color: activeTab === 'checklist' ? 'var(--brand-primary, #00e676)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>task_alt</span>
            Health Checklist ({healthPercent}%)
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'audit' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'audit' ? '2px solid var(--brand-primary, #00e676)' : '2px solid transparent',
              color: activeTab === 'audit' ? 'var(--brand-primary, #00e676)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>list_alt</span>
            Account Activity Log
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* TAB 1: RECOVERY & SNAPSHOTS */}
          {activeTab === 'recovery' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Deep Scan Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>
                      Deep Orphaned Data Recovery Scan
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Scans local storage caches for lost recurring expenses, forgotten salary structures, or unlinked ledger records and attaches them to this account.
                    </p>
                  </div>
                  <button
                    onClick={handleDeepRecovery}
                    disabled={isScanning}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(0, 230, 118, 0.15)',
                      color: 'var(--brand-primary, #00e676)',
                      border: '1px solid var(--brand-primary, #00e676)',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {isScanning ? 'sync' : 'search_check'}
                    </span>
                    {isScanning ? 'Scanning...' : 'Run Deep Recovery'}
                  </button>
                </div>

                {recoveryReport && (
                  <div style={{
                    marginTop: '14px',
                    padding: '12px',
                    background: 'rgba(0, 230, 118, 0.08)',
                    border: '1px solid rgba(0, 230, 118, 0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text-primary)'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Recovery Scan Results:</div>
                    <div>• Recovered Recurring Rules: <strong>{recoveryReport.recoveredRecurringRules}</strong></div>
                    <div>• Recovered Salary Structures: <strong>{recoveryReport.recoveredSalaryRevisions}</strong></div>
                    <div>• Recovered Reminders: <strong>{recoveryReport.recoveredReminders}</strong></div>
                    {recoveryReport.notes.map((n, i) => (
                      <div key={i} style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>• {n}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rolling Snapshots */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>
                    Rolling Snapshot Vault (Last 5 Points)
                  </h3>
                  <button
                    onClick={handleCreateSnapshot}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                    Create Snapshot Now
                  </button>
                </div>

                {snapshots.length === 0 ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '13px'
                  }}>
                    No snapshots recorded yet. Click "Create Snapshot Now" or save any transaction to initiate rolling history.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {snapshots.map((snap, idx) => (
                      <div
                        key={snap.id}
                        style={{
                          padding: '12px 16px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {snap.label}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {new Date(snap.timestamp).toLocaleString()} • {snap.counts.income} Incomes, {snap.counts.expenses} Expenses, {snap.counts.recurring} Recurring, {snap.counts.reminders} Reminders
                          </div>
                        </div>

                        <button
                          onClick={() => handleRestoreSnapshot(idx)}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(255, 171, 0, 0.15)',
                            color: '#ffab00',
                            border: '1px solid rgba(255, 171, 0, 0.3)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restore</span>
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HEALTH CHECKLIST */}
          {activeTab === 'checklist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    80/20 Financial Health Score
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-primary, #00e676)' }}>
                    {healthPercent}% Ready ({completedCount} / {checklist.length})
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${healthPercent}%`,
                    background: healthPercent >= 75 ? 'var(--brand-primary, #00e676)' : healthPercent >= 40 ? '#ffab00' : '#ff5252',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 14px',
                      background: item.completed ? 'rgba(0, 230, 118, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                      border: item.completed ? '1px solid rgba(0, 230, 118, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleChecklist(item.id)}
                        style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--brand-primary, #00e676)' }}
                      />
                      <div>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: item.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: item.completed ? 'line-through' : 'none'
                        }}>
                          {item.title}
                          {item.priority === 'critical' && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: 'rgba(255, 82, 82, 0.15)',
                              color: '#ff5252',
                              borderRadius: '4px'
                            }}>
                              CRITICAL
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {item.description}
                        </div>
                      </div>
                    </div>

                    {item.actionRoute && (
                      <button
                        onClick={() => {
                          onClose();
                          navigate(item.actionRoute!);
                        }}
                        style={{
                          padding: '4px 8px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--brand-primary, #00e676)',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Open Tool →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Chronological record of activities for this specific account.
              </div>

              {entries.length === 0 ? (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px'
                }}>
                  No activity recorded for this account yet.
                </div>
              ) : (
                entries.slice(0, 30).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          marginRight: '8px',
                          background: log.action === 'CREATE' ? 'rgba(0, 230, 118, 0.15)' : log.action === 'DELETE' ? 'rgba(255, 82, 82, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                          color: log.action === 'CREATE' ? '#00e676' : log.action === 'DELETE' ? '#ff5252' : '#bbb'
                        }}>
                          {log.action}
                        </span>
                        {log.label}
                      </div>
                      {log.details && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {log.details}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: 'var(--brand-primary, #00e676)',
              color: '#000',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
