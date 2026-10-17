import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SalaryCategory = 
  | 'basic' | 'hra' | 'conveyance' | 'special_allowance' | 'communication' 
  | 'joola_gratuit' | 'lta' | 'personal_allowance' | 'gratuity' | 'joola_gratuity_arrears'
  | 'pf' | 'tax' | 'other';

export interface SalaryComponent {
  id: string;
  label: string;
  amountPaise: number;
  type: 'earning' | 'deduction';
  category: SalaryCategory;
  applicableMonths?: number[]; 
  isOneTime?: boolean;
}

export interface SalaryStructure {
  id: string;
  effectiveFrom: string; 
  companyName: string;
  payCycleDay: number;
  components: SalaryComponent[];
  ctcPaise?: number;
}

export interface SalaryDocument {
  id: string;
  label: string;
  url: string;
  date: string;
}

interface SalaryState {
  revisions: SalaryStructure[];
  postedMonths: string[]; 
  documents: SalaryDocument[];
  linkedPayslips: Record<string, string>; // monthKey -> DataURI
  
  addRevision: (rev: Omit<SalaryStructure, 'id'>) => void;
  updateRevision: (id: string, rev: Partial<SalaryStructure>) => void;
  deleteRevision: (id: string) => void;
  
  addDocument: (doc: Omit<SalaryDocument, 'id'>) => void;
  deleteDocument: (id: string) => void;

  markMonthAsPosted: (monthKey: string, pdfDataUri?: string) => void;
  unmarkMonthAsPosted: (monthKey: string) => void;
  getStructureForMonth: (year: number, month: number) => SalaryStructure | null;
  calculateNet: (year: number, month: number) => number;
}

export const useSalaryStore = create<SalaryState>()(
  persist(
    (set, get) => ({
      revisions: [],
      postedMonths: [],
      documents: [],
      linkedPayslips: {},

      addRevision: (rev) => {
        const id = crypto.randomUUID();
        set({ revisions: [...get().revisions, { ...rev, id }].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)) });
      },
      updateRevision: (id, data) => {
        set({ revisions: get().revisions.map(r => r.id === id ? { ...r, ...data } : r) });
      },
      deleteRevision: (id) => {
        set({ revisions: get().revisions.filter(r => r.id !== id) });
      },

      addDocument: (doc) => {
        set({ documents: [...get().documents, { ...doc, id: crypto.randomUUID() }] });
      },
      deleteDocument: (id) => {
        set({ documents: get().documents.filter(d => d.id !== id) });
      },

      markMonthAsPosted: (monthKey, pdfDataUri) => {
        const currentPosted = get().postedMonths || [];
        const currentLinked = get().linkedPayslips || {};
        
        if (!currentPosted.includes(monthKey)) {
          set({ 
            postedMonths: [...currentPosted, monthKey],
            linkedPayslips: pdfDataUri ? { ...currentLinked, [monthKey]: pdfDataUri } : currentLinked
          });
        }
      },
      unmarkMonthAsPosted: (monthKey) => {
        const newLinked = { ...get().linkedPayslips };
        delete newLinked[monthKey];
        set({ 
          postedMonths: (get().postedMonths || []).filter(m => m !== monthKey),
          linkedPayslips: newLinked
        });
      },

      getStructureForMonth: (year, month) => {
        const target = `${year}-${String(month + 1).padStart(2, '0')}`;
        const revs = [...get().revisions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        return revs.find(r => r.effectiveFrom <= target) || revs[revs.length - 1] || null;
      },

      calculateNet: (year, month) => {
        const s = get().getStructureForMonth(year, month);
        if (!s) return 0;
        return s.components.reduce((acc, c) => {
          if (c.applicableMonths && c.applicableMonths.length > 0) {
            if (!c.applicableMonths.includes(month)) return acc;
          }
          return acc + (c.type === 'earning' ? c.amountPaise : -c.amountPaise);
        }, 0);
      }
    }),
    { 
      name: 'finsathi-salary-v2',
      version: 1
    }
  )
);
