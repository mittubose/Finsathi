/**
 * Recurring Rules Engine
 * Separate from one-off reminders — models scheduled recurring flows.
 * Types: income, expense, savings, tax, transfer
 * PRD v4 §2.1–2.3, §3
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auditLog } from './useAuditStore';

export type RecurringType = 'income' | 'expense' | 'savings' | 'tax' | 'transfer';
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type RecurringAmountRule = 'fixed' | 'variable' | 'estimate';
export type RecurringStatus = 'active' | 'paused' | 'completed' | 'overdue';

export interface RecurringRule {
  id: string;
  title: string;
  type: RecurringType;
  frequency: RecurringFrequency;
  // For custom frequency: interval in days
  customIntervalDays?: number;
  amountRule: RecurringAmountRule;
  // In paise. null when amountRule is 'variable' (user sets at trigger time)
  amountPaise: number | null;
  startDate: string; // ISO date
  endDate?: string;  // ISO date, optional
  nextDueDate: string; // ISO date, auto-computed
  category?: string; // For expense/savings: expense category or savings stream
  source: 'manual' | 'import' | 'ocr';
  status: RecurringStatus;
  isSalaryLinked?: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// A trigger log entry: when a rule was "fired" and what ledger entry it created
export interface RecurringTrigger {
  id: string;
  ruleId: string;
  triggeredAt: string;
  amountPaise: number;
  ledgerEntryId?: string; // ID of the resulting income/expense/trade item
  note?: string;
}

/** Advance nextDueDate by one frequency period */
export function advanceNextDue(current: string, frequency: RecurringFrequency, customIntervalDays?: number): string {
  const d = new Date(current);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'custom':
      d.setDate(d.getDate() + (customIntervalDays ?? 30));
      break;
  }
  return d.toISOString().split('T')[0];
}

/** Generate projected occurrences from a rule for the next N months */
export function projectOccurrences(
  rule: RecurringRule,
  months = 12
): Array<{ date: string; amountPaise: number | null }> {
  const projections: Array<{ date: string; amountPaise: number | null }> = [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + months);

  let cursor = rule.nextDueDate;
  let safety = 0;

  while (new Date(cursor) <= cutoff && safety < 500) {
    if (rule.endDate && new Date(cursor) > new Date(rule.endDate)) break;
    projections.push({ date: cursor, amountPaise: rule.amountPaise });
    cursor = advanceNextDue(cursor, rule.frequency, rule.customIntervalDays);
    safety++;
  }

  return projections;
}

/** Determine if a rule is overdue (nextDueDate is in the past and rule is active) */
export function isRuleOverdue(rule: RecurringRule): boolean {
  return rule.status === 'active' && new Date(rule.nextDueDate) < new Date();
}

function generateId() {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface RecurringState {
  rules: RecurringRule[];
  triggers: RecurringTrigger[];

  addRule: (rule: Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateRule: (id: string, updates: Partial<RecurringRule>) => void;
  pauseRule: (id: string) => void;
  resumeRule: (id: string) => void;
  deleteRule: (id: string) => void;

  /** Fire a rule: log a trigger, advance nextDueDate, return trigger id */
  triggerRule: (id: string, amountPaise: number, ledgerEntryId?: string, note?: string) => string;

  /** Computed: all active rules that are overdue */
  getOverdueRules: () => RecurringRule[];

  /** Computed: 12-month projection of cash flows from all active rules */
  getCashFlowProjection: (months?: number) => Array<{
    month: string; // 'YYYY-MM'
    incomeProjectedPaise: number;
    expenseProjectedPaise: number;
    savingsProjectedPaise: number;
    netPaise: number;
  }>;
}

export const useRecurringStore = create<RecurringState>()(
  persist(
    (set, get) => ({
      rules: [],
      triggers: [],

      addRule: (rule) => {
        const id = generateId();
        const now = new Date().toISOString();
        const newRule: RecurringRule = { ...rule, id, createdAt: now, updatedAt: now };
        set((s) => ({ rules: [...s.rules, newRule] }));
        auditLog({
          action: 'CREATE',
          entity: 'income', // overloaded; treat recurring as its own entity in future
          entityId: id,
          label: `Recurring rule created: ${rule.title}`,
          details: `${rule.type} · ${rule.frequency} · ${rule.amountRule}`,
        });
        return id;
      },

      updateRule: (id, updates) => {
        const before = get().rules.find((r) => r.id === id);
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        }));
        auditLog({
          action: 'UPDATE',
          entity: 'income',
          entityId: id,
          label: `Recurring rule updated: ${before?.title ?? id}`,
          details: Object.keys(updates).join(', '),
        });
      },

      pauseRule: (id) => {
        const rule = get().rules.find((r) => r.id === id);
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === id ? { ...r, status: 'paused', updatedAt: new Date().toISOString() } : r
          ),
        }));
        auditLog({
          action: 'UPDATE',
          entity: 'income',
          entityId: id,
          label: `Recurring rule paused: ${rule?.title ?? id}`,
        });
      },

      resumeRule: (id) => {
        const rule = get().rules.find((r) => r.id === id);
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === id ? { ...r, status: 'active', updatedAt: new Date().toISOString() } : r
          ),
        }));
        auditLog({
          action: 'UPDATE',
          entity: 'income',
          entityId: id,
          label: `Recurring rule resumed: ${rule?.title ?? id}`,
        });
      },

      deleteRule: (id) => {
        const rule = get().rules.find((r) => r.id === id);
        set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }));
        auditLog({
          action: 'DELETE',
          entity: 'income',
          entityId: id,
          label: `Recurring rule deleted: ${rule?.title ?? id}`,
        });
      },

      triggerRule: (id, amountPaise, ledgerEntryId, note) => {
        const triggerId = generateId();
        const rule = get().rules.find((r) => r.id === id);
        if (!rule) return triggerId;

        const trigger: RecurringTrigger = {
          id: triggerId,
          ruleId: id,
          triggeredAt: new Date().toISOString(),
          amountPaise,
          ledgerEntryId,
          note,
        };

        const newNextDue = advanceNextDue(rule.nextDueDate, rule.frequency, rule.customIntervalDays);

        set((s) => ({
          triggers: [...s.triggers, trigger],
          rules: s.rules.map((r) =>
            r.id === id
              ? { ...r, nextDueDate: newNextDue, updatedAt: new Date().toISOString() }
              : r
          ),
        }));

        auditLog({
          action: 'CREATE',
          entity: 'income',
          entityId: id,
          label: `Recurring rule triggered: ${rule.title}`,
          details: `Next due: ${newNextDue}`,
          amountPaise,
        });

        return triggerId;
      },

      getOverdueRules: () => get().rules.filter(isRuleOverdue),

      getCashFlowProjection: (months = 12) => {
        const activeRules = get().rules.filter((r) => r.status === 'active');

        // Build a map: 'YYYY-MM' -> { income, expense, savings }
        const buckets = new Map<string, { i: number; e: number; s: number }>();

        const initBucket = (key: string) => {
          if (!buckets.has(key)) buckets.set(key, { i: 0, e: 0, s: 0 });
        };

        for (const rule of activeRules) {
          const occurrences = projectOccurrences(rule, months);
          for (const occ of occurrences) {
            if (occ.amountPaise === null) continue;
            const key = occ.date.slice(0, 7); // 'YYYY-MM'
            initBucket(key);
            const bucket = buckets.get(key)!;
            if (rule.type === 'income') bucket.i += occ.amountPaise;
            else if (rule.type === 'expense') bucket.e += occ.amountPaise;
            else if (rule.type === 'savings') bucket.s += occ.amountPaise;
          }
        }

        // Sort months and emit
        return Array.from(buckets.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, { i, e, s }]) => ({
            month,
            incomeProjectedPaise: i,
            expenseProjectedPaise: e,
            savingsProjectedPaise: s,
            netPaise: i - e - s,
          }));
      },
    }),
    { name: 'finsathi-recurring' }
  )
);
