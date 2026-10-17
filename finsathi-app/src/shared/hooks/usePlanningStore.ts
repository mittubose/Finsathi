import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Loan {
  id: string;
  name: string;
  principalAmountPaise: number;
  interestRate: number; // Annual %
  tenureMonths: number;
  startDate: string;
}

export interface BudgetBucket {
  id: string;
  name: string;
  allocatedPaise: number;
  color: string;
}

interface PlanningState {
  loans: Loan[];
  buckets: BudgetBucket[];

  addLoan: (loan: Loan) => void;
  updateLoan: (id: string, updates: Partial<Loan>) => void;
  deleteLoan: (id: string) => void;

  addBucket: (bucket: BudgetBucket) => void;
  updateBucket: (id: string, updates: Partial<BudgetBucket>) => void;
  deleteBucket: (id: string) => void;
}

export const usePlanningStore = create<PlanningState>()(
  persist(
    (set) => ({
      loans: [],
      buckets: [
        { id: '1', name: 'Needs (50%)', allocatedPaise: 5000000, color: 'var(--positive)' },
        { id: '2', name: 'Wants (30%)', allocatedPaise: 3000000, color: 'var(--warning)' },
        { id: '3', name: 'Savings (20%)', allocatedPaise: 2000000, color: 'var(--accent)' }
      ],

      addLoan: (loan) => set((s) => ({ loans: [...s.loans, loan] })),
      updateLoan: (id, updates) => set((s) => ({ loans: s.loans.map(l => l.id === id ? { ...l, ...updates } : l) })),
      deleteLoan: (id) => set((s) => ({ loans: s.loans.filter(l => l.id !== id) })),

      addBucket: (bucket) => set((s) => ({ buckets: [...s.buckets, bucket] })),
      updateBucket: (id, updates) => set((s) => ({ buckets: s.buckets.map(b => b.id === id ? { ...b, ...updates } : b) })),
      deleteBucket: (id) => set((s) => ({ buckets: s.buckets.filter(b => b.id !== id) })),
    }),
    {
      name: 'finsathi-planning-store',
    }
  )
);
