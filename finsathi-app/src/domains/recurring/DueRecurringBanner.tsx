import React, { useState } from 'react';
import { useRecurringStore, type RecurringRule } from '../../shared/hooks/useRecurringStore';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR } from '../../shared/lib/currency';
import { getCurrentFY } from '../../shared/lib/dates';
import { useToast } from '../../shared/ui/Toast';

export function DueRecurringBanner() {
  const { rules, triggerRule } = useRecurringStore();
  const { addExpense, addIncome } = useAppStore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Overdue or due today
  const dueRules = rules.filter(r => r.status === 'active' && r.nextDueDate <= todayStr);

  if (dueRules.length === 0) return null;

  const totalDuePaise = dueRules.reduce((acc, r) => acc + (r.amountPaise || 0), 0);

  const handleProcessAll = () => {
    setIsProcessing(true);
    let count = 0;

    for (const rule of dueRules) {
      const amount = rule.amountPaise || 0;
      const entryId = `rec_due_${Date.now()}_${rule.id}`;

      if (rule.type === 'income') {
        addIncome({
          id: entryId,
          type: 'income',
          head: rule.isSalaryLinked ? 'salary' : 'other',
          amountPaise: amount,
          source: rule.title,
          fy: getCurrentFY(),
          isTaxable: true,
          notes: `Auto-processed from recurring schedule`,
          tags: ['recurring'],
          date: rule.nextDueDate,
          createdAt: new Date().toISOString(),
          recurringRuleId: rule.id
        });
      } else {
        addExpense({
          id: entryId,
          type: 'expense',
          category: rule.category || 'Recurring Bills',
          amountPaise: amount,
          date: rule.nextDueDate,
          merchant: rule.title,
          notes: `Auto-processed from recurring schedule`,
          tags: ['recurring'],
          isRecurring: true,
          createdAt: new Date().toISOString(),
          recurringRuleId: rule.id
        });
      }

      triggerRule(rule.id, amount, entryId, `Auto-processed via Due Recurring banner`);
      count++;
    }

    setIsProcessing(false);
    toast(`Processed ${count} due recurring items into your ledger!`, 'success');
  };

  return (
    <div style={{
      margin: '0 0 16px 0',
      padding: '14px 18px',
      background: 'linear-gradient(135deg, rgba(255, 171, 0, 0.12) 0%, rgba(255, 171, 0, 0.04) 100%)',
      border: '1px solid rgba(255, 171, 0, 0.35)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="material-symbols-outlined" style={{ color: '#ffab00', fontSize: '26px' }}>
          schedule
        </span>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
            {dueRules.length} Recurring {dueRules.length === 1 ? 'Commitment' : 'Commitments'} Due Today ({formatINR(totalDuePaise)})
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {dueRules.map(r => r.title).slice(0, 3).join(', ')}{dueRules.length > 3 ? ` +${dueRules.length - 3} more` : ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleProcessAll}
          disabled={isProcessing}
          style={{
            padding: '8px 14px',
            background: 'var(--brand-primary, #00e676)',
            color: '#000',
            fontWeight: 600,
            fontSize: '12px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
          {isProcessing ? 'Processing...' : 'Post All to Ledger'}
        </button>
      </div>
    </div>
  );
}
