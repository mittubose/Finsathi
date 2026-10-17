import React, { useState, useMemo } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { formatINRCompact } from '../lib/currency';
import { motion, AnimatePresence } from 'framer-motion';
import './FloatingTasks.css';

export function FloatingTasks() {
  const { reminders, updateReminder } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const { pending, settled } = useMemo(() => {
    const p = reminders.filter(r => r.status !== 'paid' && r.status !== 'dismissed');
    const s = reminders.filter(r => r.status === 'paid');
    return {
      pending: p.sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()),
      settled: s.sort((a, b) => new Date(b.settledAt || b.nextDue).getTime() - new Date(a.settledAt || a.nextDue).getTime())
    };
  }, [reminders]);

  const pendingCount = pending.length;

  const handleTogglePaid = (id: string, isPaid: boolean) => {
    updateReminder(id, { 
      status: isPaid ? 'paid' : 'upcoming',
      settledAt: isPaid ? new Date().toISOString() : undefined
    });
  };

  if (pending.length === 0 && settled.length === 0) return null;

  return (
    <div className={`floating-tasks-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <motion.div 
        className="floating-tasks-card glass-surface"
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="floating-tasks-header" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="header-left">
            <span className="material-symbols-outlined icon-sm">assignment</span>
            <span className="text-label-mono-sm">OBLIGATIONS</span>
            {pendingCount > 0 && <span className="pending-badge">{pendingCount}</span>}
          </div>
          <span className="material-symbols-outlined expand-icon">
            {isExpanded ? 'expand_more' : 'expand_less'}
          </span>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              className="floating-tasks-body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="tasks-list">
                {pending.length > 0 && (
                  <div className="tasks-section">
                    <div className="section-label text-label-mono-sm color-muted">PENDING</div>
                    {pending.map((task) => (
                      <div key={task.id} className="task-item">
                        <div className="task-info">
                          <span className="text-body-bold task-title">{task.title}</span>
                          <div className="task-meta">
                            <span className="text-label-mono-sm color-muted">
                              {task.amountPaise ? formatINRCompact(task.amountPaise) : 'NO_AMT'}
                            </span>
                            <span className="dot-divider" />
                            <span className="text-label-mono-sm color-muted">
                              {new Date(task.nextDue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="task-actions">
                          <button className="task-action-btn paid" onClick={() => handleTogglePaid(task.id, true)}>
                            <span className="material-symbols-outlined icon-xs">check_circle</span>
                            PAID
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {settled.length > 0 && (
                  <div className="tasks-section settled-section">
                    <div className="section-label text-label-mono-sm color-muted">SETTLED</div>
                    {settled.map((task) => (
                      <div key={task.id} className="task-item is-paid">
                        <div className="task-info">
                          <span className="text-body-bold task-title strikethrough">{task.title}</span>
                          <div className="task-meta">
                            <span className="text-label-mono-sm color-muted">
                              {task.amountPaise ? formatINRCompact(task.amountPaise) : 'NO_AMT'}
                            </span>
                          </div>
                        </div>
                        <div className="task-actions">
                          <button className="task-action-btn revert" onClick={() => handleTogglePaid(task.id, false)}>
                            <span className="material-symbols-outlined icon-xs">undo</span>
                            REVERT
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
