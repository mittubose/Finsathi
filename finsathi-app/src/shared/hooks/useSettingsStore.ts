import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  baseInflationRate: number; // e.g. 6.0 for 6%
  educationInflationRate: number; // e.g. 10.0 for 10%
  expectedEquityReturn: number; // e.g. 12.0 for 12%
  expectedDebtReturn: number; // e.g. 7.0 for 7%
  
  updateSettings: (updates: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      baseInflationRate: 6.0,
      educationInflationRate: 10.0,
      expectedEquityReturn: 12.0,
      expectedDebtReturn: 7.0,

      updateSettings: (updates) => set((s) => ({ ...s, ...updates })),
    }),
    {
      name: 'finsathi-settings-store',
    }
  )
);
