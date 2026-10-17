import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentFY } from '../lib/dates';
import type { BusinessExpenseEntry, HousePropertyEntry, OtherSourceEntry, DeductionEntry } from '../../domains/tax/itr3Engine';

export type TransactionType = 'income' | 'expense' | 'trade';

export interface IncomeItem {
  id: string;
  type: 'income';
  head: 'salary' | 'freelance' | 'interest' | 'dividend' | 'rental' | 'other';
  amountPaise: number;
  source: string;
  fy: string;
  isTaxable: boolean;
  notes: string;
  tags: string[];
  date: string;
  createdAt: string;
  recurringRuleId?: string;
}

export interface ExpenseItem {
  id: string;
  type: 'expense';
  category: string;
  amountPaise: number;
  date: string;
  merchant: string;
  notes: string;
  tags: string[];
  isRecurring: boolean;
  receiptUrl?: string;
  createdAt: string;
  recurringRuleId?: string;
}

export interface ChargeBreakdown {
  brokeragePaise: number;
  exchangeTxnPaise: number;
  sebiChargesPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  stampDutyPaise: number;
  sttPaise: number;
  ipftPaise?: number; // Investor Protection Fund Trust
}

export interface TradeItem {
  id: string;
  type: 'trade';
  accountId: string; // Linked trading account
  instrument: string;
  isin?: string;
  buyDate: string;
  sellDate: string;
  qty: number;
  buyPricePaise: number;
  sellPricePaise: number;
  chargesPaise: number;
  chargeBreakdown?: ChargeBreakdown;
  assetType: 'equity' | 'equity_mf' | 'debt_mf' | 'mf' | 'property' | 'vda' | 'bonds' | 'gold' | 'other';
  subType?: 'delivery' | 'intraday' | 'futures' | 'options';
  classification: 'STCG' | 'LTCG' | 'INTRADAY' | 'BUSINESS';
  realizedPnlPaise: number;
  notes: string;
  createdAt: string;
  tradeId?: string;
  exchangeCode?: string;  // NSE/BSE
  sttPaidPaise?: number;
}

// ============ ITR-3 DATA ============

export interface ITR3Data {
  salaryData?: any; // Will be properly typed when passed to engine
  tdsData?: number;
  assessmentYear: string;
  filingSection: '139(1)' | '139(4)' | '139(5)';
  form10IEA: { filed: boolean; regime: 'old' | 'new'; switchDate?: string };
  houseProperties: HousePropertyEntry[];
  businessExpenses: BusinessExpenseEntry[];
  fnoAccountingMethod: 'actual' | 'presumptive';
  otherSourceIncome: OtherSourceEntry[];
  deductionEntries: DeductionEntry[];
  aisData?: {
    dividendPaise: number;
    savingsInterestPaise: number;
    fdInterestPaise: number;
    securitiesSalePaise: number;
    securitiesPurchasePaise: number;
    businessTrustIncomePaise: number;
  };
  bookkeepingData: {
    openingCapitalPaise: number;
    drawingsPaise: number;
    loansPaise: number;
    fixedAssetsPaise: number;
    bankBalancePaise: number;
    brokerBalancePaise: number;
    cashBalancePaise: number;
  };
  filingProgress: Record<string, 'not_started' | 'in_progress' | 'completed'>;
}

export interface TradingAccount {
  id: string;
  name: string;
  broker: string; // Zerodha, Groww, etc.
  notes: string;
  createdAt: string;
}

export interface RecurringRule {
  id: string;
  type: 'income' | 'expense';
  amountPaise: number;
  label: string;
  frequency: 'monthly' | 'quarterly' | 'annual';
  isActive: boolean;
  createdAt: string;
}

export interface ImportSession {
  id: string;
  date: string;
  fileName: string;
  intent: string;
  fileType?: string;
  format?: string;
  rowCount?: number;
  recordIds: {
    trades: string[];
    income: string[];
    expenses: string[];
  };
  summary: Record<string, any>;
}

export type LedgerItem = IncomeItem | ExpenseItem | TradeItem;

export interface Reminder {
  id: string;
  title: string;
  type: 'payable' | 'receivable';
  category: string;
  amountPaise: number | null;
  cadence: 'monthly' | 'quarterly' | 'annual' | 'custom' | 'one-time';
  nextDue: string;
  settledAt?: string;
  endDate?: string;
  leadDays: number[];
  status: 'upcoming' | 'due_soon' | 'overdue' | 'paid' | 'dismissed';
  notes?: string;
  credentials?: string; // e.g. Customer ID, Phone Number
  portalUrl?: string; // Link to payment portal
  linkedLedgerId?: string; // Links to incomeItems/expenseItems id
  autoCreatedNextId?: string; // Links to the next occurrence created after settlement
  createdAt: string;
}

interface AppState {
  // Financial Year
  currentFY: string;
  preferredRegime: 'old' | 'new' | 'compare';
  privacyMode: boolean;
  vaultActive: boolean;
  vaultPassword: string | null; // Hashed or plain (local only)
  isVaultLocked: boolean;
  biometricId: string | null;
  recoveryKeyHash: string | null;
  recoveryEmail: string | null;
  serverHost: string;
  serverAuthToken: string | null;
  googleClientId: string | null;


  // Ledger
  incomeItems: IncomeItem[];
  expenseItems: ExpenseItem[];
  tradeItems: TradeItem[];
  reminders: Reminder[];
  tradingAccounts: TradingAccount[];
  recurringRules: RecurringRule[];
  importHistory: ImportSession[];

  // ITR-3 Filing Data
  itr3Data: ITR3Data;

  // Actions
  setFY: (fy: string) => void;
  setRegime: (regime: 'old' | 'new' | 'compare') => void;
  togglePrivacyMode: () => void;
  addIncome: (item: IncomeItem) => void;
  updateIncome: (id: string, updates: Partial<IncomeItem>) => void;
  deleteIncome: (id: string) => void;
  addExpense: (item: ExpenseItem) => void;
  updateExpense: (id: string, updates: Partial<ExpenseItem>) => void;
  deleteExpense: (id: string) => void;
  addTrade: (item: TradeItem) => void;
  updateTrade: (id: string, updates: Partial<TradeItem>) => void;
  deleteTrade: (id: string) => void;
  addReminder: (item: Reminder) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  
  // Trading Account Actions
  addTradingAccount: (account: TradingAccount) => void;
  updateTradingAccount: (id: string, updates: Partial<TradingAccount>) => void;
  deleteTradingAccount: (id: string) => void;

  // Recurring Rule Actions
  addRecurringRule: (rule: RecurringRule) => void;
  updateRecurringRule: (id: string, updates: Partial<RecurringRule>) => void;
  deleteRecurringRule: (id: string) => void;

  // Import Actions
  addImportSession: (session: ImportSession) => void;
  undoImport: (id: string) => void;
  emergencyRevertGDocsSync: () => void;
  restoreBackup: (data: Partial<AppState>) => void;

  // ITR-3 Actions
  updateITR3Data: (updates: Partial<ITR3Data>) => void;
  addHouseProperty: (prop: HousePropertyEntry) => void;
  updateHouseProperty: (id: string, updates: Partial<HousePropertyEntry>) => void;
  deleteHouseProperty: (id: string) => void;
  addBusinessExpense: (expense: BusinessExpenseEntry) => void;
  updateBusinessExpense: (id: string, updates: Partial<BusinessExpenseEntry>) => void;
  deleteBusinessExpense: (id: string) => void;
  addOtherSource: (entry: OtherSourceEntry) => void;
  updateOtherSource: (id: string, updates: Partial<OtherSourceEntry>) => void;
  deleteOtherSource: (id: string) => void;
  addDeduction: (entry: DeductionEntry) => void;
  updateDeduction: (id: string, updates: Partial<DeductionEntry>) => void;
  deleteDeduction: (id: string) => void;
  updateBookkeepingData: (updates: Partial<ITR3Data['bookkeepingData']>) => void;
  setFilingProgress: (step: string, status: 'not_started' | 'in_progress' | 'completed') => void;

  // Computed helpers
  getAllTransactions: () => LedgerItem[];

  // Security Actions
  setVaultPassword: (password: string | null) => void;
  lockVault: () => void;
  unlockVault: (password: string) => boolean;
  registerBiometrics: (id: string | null) => void;
  setVaultActive: (active: boolean) => void;
  setRecoveryKeyHash: (hash: string | null) => void;
  setRecoveryEmail: (email: string | null) => void;
  setServerConfig: (host: string, token: string | null) => void;
  setGoogleClientId: (id: string | null) => void;
}


export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentFY: getCurrentFY(),
      preferredRegime: 'compare',
      privacyMode: false,

      incomeItems: [],
      expenseItems: [],
      tradeItems: [],
      reminders: [],
      tradingAccounts: [{ id: 'default', name: 'Primary Account', broker: 'Zerodha', notes: 'Auto-created', createdAt: new Date().toISOString() }],
      recurringRules: [],
      importHistory: [],

      // ITR-3 Filing Data
      itr3Data: {
        salaryData: undefined,
        tdsData: 0,
        assessmentYear: '',
        filingSection: '139(1)',
        form10IEA: { filed: false, regime: 'new' },
        houseProperties: [],
        businessExpenses: [],
        fnoAccountingMethod: 'actual',
        otherSourceIncome: [],
        deductionEntries: [],
        aisData: undefined,
        bookkeepingData: {
          openingCapitalPaise: 0,
          drawingsPaise: 0,
          loansPaise: 0,
          fixedAssetsPaise: 0,
          bankBalancePaise: 0,
          brokerBalancePaise: 0,
          cashBalancePaise: 0,
        },
        filingProgress: {},
      },

      vaultActive: false,
      vaultPassword: null,
      isVaultLocked: false,
      biometricId: null,
      recoveryKeyHash: null,
      recoveryEmail: null,
      serverHost: typeof window !== 'undefined' ? (window.location.port === '3001' ? window.location.origin : 'http://localhost:3001') : 'http://localhost:3001',
      serverAuthToken: null,
      googleClientId: null,


      setFY: (fy) => set({ currentFY: fy }),
      setRegime: (regime) => set({ preferredRegime: regime }),
      togglePrivacyMode: () => set((s) => ({ privacyMode: !s.privacyMode })),

      addIncome: (item) => set((s) => ({ incomeItems: [...s.incomeItems, item] })),
      updateIncome: (id, updates) =>
        set((s) => ({
          incomeItems: s.incomeItems.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      deleteIncome: (id) => {
        const item = get().incomeItems.find(i => i.id === id);
        if (item?.head === 'salary' && item.tags) {
          const smkTag = item.tags.find(t => t.startsWith('smk:'));
          if (smkTag) {
            const monthKey = smkTag.split(':')[1];
            // Import and call useSalaryStore dynamically to avoid circular dependencies if any
            import('./useSalaryStore').then(({ useSalaryStore }) => {
              useSalaryStore.getState().unmarkMonthAsPosted(monthKey);
            });
          }
        }
        set((s) => ({ incomeItems: s.incomeItems.filter((i) => i.id !== id) }));
      },

      addExpense: (item) => set((s) => ({ expenseItems: [...s.expenseItems, item] })),
      updateExpense: (id, updates) =>
        set((s) => ({
          expenseItems: s.expenseItems.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      deleteExpense: (id) =>
        set((s) => ({ expenseItems: s.expenseItems.filter((i) => i.id !== id) })),

      addTrade: (item) => set((s) => ({ tradeItems: [...s.tradeItems, item] })),
      updateTrade: (id, updates) =>
        set((s) => ({
          tradeItems: s.tradeItems.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      deleteTrade: (id) => set((s) => ({ tradeItems: s.tradeItems.filter((i) => i.id !== id) })),

      addReminder: (item) => set((s) => ({ reminders: [...s.reminders, item] })),
      updateReminder: (id, updates) =>
        set((s) => ({
          reminders: s.reminders.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      deleteReminder: (id) =>
        set((s) => ({ reminders: s.reminders.filter((i) => i.id !== id) })),

      addTradingAccount: (account) => set((s) => ({ tradingAccounts: [...s.tradingAccounts, account] })),
      updateTradingAccount: (id, updates) =>
        set((s) => ({
          tradingAccounts: s.tradingAccounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      deleteTradingAccount: (id) =>
        set((s) => ({ 
          tradingAccounts: s.tradingAccounts.filter((a) => a.id !== id),
        })),

      addRecurringRule: (rule) => set((s) => ({ recurringRules: [...s.recurringRules, rule] })),
      updateRecurringRule: (id, updates) =>
        set((s) => ({
          recurringRules: s.recurringRules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      deleteRecurringRule: (id) => set((s) => ({ recurringRules: s.recurringRules.filter((r) => r.id !== id) })),

      // ITR-3 Actions
      updateITR3Data: (updates) => set((s) => ({ itr3Data: { ...s.itr3Data, ...updates } })),
      addHouseProperty: (prop) => set((s) => ({
        itr3Data: { ...s.itr3Data, houseProperties: [...s.itr3Data.houseProperties, prop] },
      })),
      updateHouseProperty: (id, updates) => set((s) => ({
        itr3Data: {
          ...s.itr3Data,
          houseProperties: s.itr3Data.houseProperties.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        },
      })),
      deleteHouseProperty: (id) => set((s) => ({
        itr3Data: { ...s.itr3Data, houseProperties: s.itr3Data.houseProperties.filter((p) => p.id !== id) },
      })),
      addBusinessExpense: (expense) => set((s) => ({
        itr3Data: { ...s.itr3Data, businessExpenses: [...s.itr3Data.businessExpenses, expense] },
      })),
      updateBusinessExpense: (id, updates) => set((s) => ({
        itr3Data: {
          ...s.itr3Data,
          businessExpenses: s.itr3Data.businessExpenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        },
      })),
      deleteBusinessExpense: (id) => set((s) => ({
        itr3Data: { ...s.itr3Data, businessExpenses: s.itr3Data.businessExpenses.filter((e) => e.id !== id) },
      })),
      addOtherSource: (entry) => set((s) => ({
        itr3Data: { ...s.itr3Data, otherSourceIncome: [...s.itr3Data.otherSourceIncome, entry] },
      })),
      updateOtherSource: (id, updates) => set((s) => ({
        itr3Data: {
          ...s.itr3Data,
          otherSourceIncome: s.itr3Data.otherSourceIncome.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        },
      })),
      deleteOtherSource: (id) => set((s) => ({
        itr3Data: { ...s.itr3Data, otherSourceIncome: s.itr3Data.otherSourceIncome.filter((e) => e.id !== id) },
      })),
      addDeduction: (entry) => set((s) => ({
        itr3Data: { ...s.itr3Data, deductionEntries: [...s.itr3Data.deductionEntries, entry] },
      })),
      updateDeduction: (id, updates) => set((s) => ({
        itr3Data: {
          ...s.itr3Data,
          deductionEntries: s.itr3Data.deductionEntries.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        },
      })),
      deleteDeduction: (id) => set((s) => ({
        itr3Data: { ...s.itr3Data, deductionEntries: s.itr3Data.deductionEntries.filter((d) => d.id !== id) },
      })),
      updateBookkeepingData: (updates) => set((s) => ({
        itr3Data: {
          ...s.itr3Data,
          bookkeepingData: { ...s.itr3Data.bookkeepingData, ...updates },
        },
      })),
      setFilingProgress: (step, status) => set((s) => ({
        itr3Data: {
          ...s.itr3Data,
          filingProgress: { ...s.itr3Data.filingProgress, [step]: status },
        },
      })),

      addImportSession: (session) => set((s) => ({ importHistory: [session, ...s.importHistory] })),
      undoImport: (id) => {
        const s = get();
        const session = s.importHistory.find(h => h.id === id);
        if (!session) return;

        set({
          tradeItems: s.tradeItems.filter(t => !session.recordIds?.trades?.includes(t.id)),
          incomeItems: s.incomeItems.filter(i => !session.recordIds?.income?.includes(i.id)),
          expenseItems: s.expenseItems.filter(e => !session.recordIds?.expenses?.includes(e.id)),
          importHistory: s.importHistory.filter(h => h.id !== id)
        });
      },
      emergencyRevertGDocsSync: () => {
        const s = get();
        // Just delete everything tagged with 'gdocs-sync' created today (or just all of them to be safe if they only use it for this feature and want to clear it)
        // Since they specifically want to revert the recent mistake, let's remove any tagged 'gdocs-sync' that was created within the last 24 hours.
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        set({
          incomeItems: s.incomeItems.filter(i => !(i.tags?.includes('gdocs-sync') && i.createdAt > oneDayAgo)),
          expenseItems: s.expenseItems.filter(e => !(e.tags?.includes('gdocs-sync') && e.createdAt > oneDayAgo)),
        });
      },
      restoreBackup: (data: Partial<AppState>) => {
        // We carefully select which keys we allow to be restored to avoid breaking app functionality or security state
        const allowedKeys: (keyof AppState)[] = [
          'currentFY', 'preferredRegime', 'incomeItems', 'expenseItems', 'tradeItems',
          'reminders', 'tradingAccounts', 'recurringRules', 'importHistory'
        ];
        
        const updates: Partial<AppState> = {};
        for (const key of allowedKeys) {
          if (data[key] !== undefined) {
            (updates as any)[key] = data[key];
          }
        }
        
        set(updates);
      },

      getAllTransactions: () => {
        const s = get();
        const all: LedgerItem[] = [
          ...(s.incomeItems || []),
          ...(s.expenseItems || []),
          ...(s.tradeItems || [])
        ];
        return all.filter(Boolean).sort((a, b) => {
          const rawA = 'date' in a ? a.date : a.sellDate;
          const rawB = 'date' in b ? b.date : b.sellDate;
          const timeA = rawA ? new Date(rawA).getTime() : 0;
          const timeB = rawB ? new Date(rawB).getTime() : 0;
          return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });
      },


      setVaultPassword: (password) => set({ vaultPassword: password }),
      lockVault: () => set({ isVaultLocked: true }),
      unlockVault: (password) => {
        const s = get();
        if (s.vaultPassword === password) {
          set({ isVaultLocked: false });
          return true;
        }
        return false;
      },
      registerBiometrics: (id) => set({ biometricId: id }),
      setVaultActive: (active) => set({ vaultActive: active }),
      setRecoveryKeyHash: (hash) => set({ recoveryKeyHash: hash }),
      setRecoveryEmail: (email) => set({ recoveryEmail: email }),
      setServerConfig: (host, token) => set({ serverHost: host, serverAuthToken: token }),
      setGoogleClientId: (id) => set({ googleClientId: id }),
    }),
    {
      name: 'finsathi-store',
      partialize: (state) => ({
        currentFY: state.currentFY,
        preferredRegime: state.preferredRegime,
        incomeItems: state.incomeItems,
        expenseItems: state.expenseItems,
        tradeItems: state.tradeItems,
        reminders: state.reminders,
        tradingAccounts: state.tradingAccounts,
        recurringRules: state.recurringRules,
        importHistory: state.importHistory,
        itr3Data: state.itr3Data,
        privacyMode: state.privacyMode,
        vaultActive: state.vaultActive,
        vaultPassword: state.vaultPassword,
        biometricId: state.biometricId,
        recoveryKeyHash: state.recoveryKeyHash,
        recoveryEmail: state.recoveryEmail,
        serverHost: state.serverHost,
        serverAuthToken: state.serverAuthToken,
        googleClientId: state.googleClientId,
      }),
    }
  )
);

