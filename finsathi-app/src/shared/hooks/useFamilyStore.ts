import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FamilyMember {
  id: string;
  name: string;
  relation: 'Self' | 'Spouse' | 'Child' | 'Parent' | 'Sibling' | 'Other';
  dateOfBirth?: string;
  notes?: string;
}

export interface FamilyAsset {
  id: string;
  memberId: string;
  type: 'Gold' | 'Real Estate' | 'Vehicle' | 'Other';
  name: string;
  estimatedValuePaise: number;
  notes?: string;
}

export interface ProbableCashflow {
  id: string;
  memberId: string;
  type: 'income' | 'expense';
  label: string;
  expectedAmountPaise: number;
  expectedDate?: string;
  probability: 'High' | 'Medium' | 'Low';
  notes?: string;
}

interface FamilyState {
  members: FamilyMember[];
  assets: FamilyAsset[];
  cashflows: ProbableCashflow[];

  addMember: (member: FamilyMember) => void;
  updateMember: (id: string, updates: Partial<FamilyMember>) => void;
  deleteMember: (id: string) => void;

  addAsset: (asset: FamilyAsset) => void;
  updateAsset: (id: string, updates: Partial<FamilyAsset>) => void;
  deleteAsset: (id: string) => void;

  addCashflow: (cashflow: ProbableCashflow) => void;
  updateCashflow: (id: string, updates: Partial<ProbableCashflow>) => void;
  deleteCashflow: (id: string) => void;
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set) => ({
      members: [],
      assets: [],
      cashflows: [],

      addMember: (member) => set((s) => ({ members: [...s.members, member] })),
      updateMember: (id, updates) => set((s) => ({ members: s.members.map(m => m.id === id ? { ...m, ...updates } : m) })),
      deleteMember: (id) => set((s) => ({ members: s.members.filter(m => m.id !== id) })),

      addAsset: (asset) => set((s) => ({ assets: [...s.assets, asset] })),
      updateAsset: (id, updates) => set((s) => ({ assets: s.assets.map(a => a.id === id ? { ...a, ...updates } : a) })),
      deleteAsset: (id) => set((s) => ({ assets: s.assets.filter(a => a.id !== id) })),

      addCashflow: (cashflow) => set((s) => ({ cashflows: [...s.cashflows, cashflow] })),
      updateCashflow: (id, updates) => set((s) => ({ cashflows: s.cashflows.map(c => c.id === id ? { ...c, ...updates } : c) })),
      deleteCashflow: (id) => set((s) => ({ cashflows: s.cashflows.filter(c => c.id !== id) })),
    }),
    {
      name: 'finsathi-family-store',
    }
  )
);
