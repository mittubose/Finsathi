/**
 * Audit Log — lightweight client-side audit trail.
 * Since we don't have Supabase yet, we store events in localStorage alongside the main store.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT';
export type AuditEntity = 'income' | 'expense' | 'trade' | 'reminder' | 'settings' | 'import';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  label: string;
  details?: string;
  amountPaise?: number;
}

interface AuditState {
  entries: AuditEntry[];
  log: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  clearOlderThan: (days: number) => void;
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set) => ({
      entries: [],
      log: (entry) => {
        const newEntry: AuditEntry = {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
        };
        set((s) => ({
          entries: [newEntry, ...s.entries].slice(0, 500), // Keep last 500 events
        }));
      },
      clearOlderThan: (days) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        set((s) => ({
          entries: s.entries.filter((e) => new Date(e.timestamp) > cutoff),
        }));
      },
    }),
    { name: 'finsathi-audit' }
  )
);

// Convenience function for components to use
export function auditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
  useAuditStore.getState().log(entry);
}
