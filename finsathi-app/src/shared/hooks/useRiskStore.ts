import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface InsurancePolicy {
  id: string;
  provider: string;
  type: 'Term Life' | 'Health (Corporate)' | 'Health (Personal)' | 'Vehicle' | 'Property';
  coverageAmountPaise: number;
  annualPremiumPaise: number;
  renewalDate: string;
  notes?: string;
}

interface RiskState {
  policies: InsurancePolicy[];

  addPolicy: (policy: InsurancePolicy) => void;
  updatePolicy: (id: string, updates: Partial<InsurancePolicy>) => void;
  deletePolicy: (id: string) => void;
}

export const useRiskStore = create<RiskState>()(
  persist(
    (set) => ({
      policies: [],

      addPolicy: (policy) => set((s) => ({ policies: [...s.policies, policy] })),
      updatePolicy: (id, updates) => set((s) => ({ policies: s.policies.map(p => p.id === id ? { ...p, ...updates } : p) })),
      deletePolicy: (id) => set((s) => ({ policies: s.policies.filter(p => p.id !== id) })),
    }),
    {
      name: 'finsathi-risk-store',
    }
  )
);
