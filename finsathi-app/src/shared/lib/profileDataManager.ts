/**
 * FinSathi Profile-Isolated Storage & State Handoff Engine
 * Guarantees complete data isolation between accounts (Master Admin vs Individual vs Family).
 * Persists and restores all financial state across useAppStore, useRecurringStore, and useSalaryStore.
 * Provides rolling snapshot recovery, deep orphaned data recovery, and per-account audit/checklist.
 */

import { useAppStore, type IncomeItem, type ExpenseItem, type TradeItem, type Reminder, type TradingAccount, type RecurringRule, type ImportSession, type ITR3Data } from '../hooks/useAppStore';
import { useRecurringStore, type RecurringRule as ScheduledRule, type RecurringTrigger } from '../hooks/useRecurringStore';
import { useSalaryStore, type SalaryStructure } from '../hooks/useSalaryStore';
import { useAuditStore, type AuditEntry } from '../hooks/useAuditStore';
import { openProfileDB, dbGetAll, dbPut, dbClearProfile } from './db';
import { computeDataChecksum } from './security';

export interface AccountChecklistItem {
  id: string;
  category: 'safety' | 'insurance' | 'cashflow' | 'investments' | 'tax' | 'estate' | 'security';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium';
  completed: boolean;
  notes?: string;
  actionRoute?: string;
}

export interface ProfileFinancialState {
  incomeItems: IncomeItem[];
  expenseItems: ExpenseItem[];
  tradeItems: TradeItem[];
  reminders: Reminder[];
  tradingAccounts: TradingAccount[];
  recurringRules: ScheduledRule[];
  recurringTriggers: RecurringTrigger[];
  salaryRevisions: SalaryStructure[];
  salaryPostedMonths: string[];
  accountAuditLog: AuditEntry[];
  accountChecklist: AccountChecklistItem[];
  importHistory: ImportSession[];
  itr3Data: ITR3Data;
  currentFY?: string;
  preferredRegime?: 'old' | 'new' | 'compare';
  savedAt: string;
}

export interface SnapshotMetadata {
  id: string;
  timestamp: string;
  label: string;
  counts: {
    income: number;
    expenses: number;
    trades: number;
    recurring: number;
    salaryRevisions: number;
    reminders: number;
  };
  state: ProfileFinancialState;
}

export interface RecoveryReport {
  profileId: string;
  recoveredRecurringRules: number;
  recoveredSalaryRevisions: number;
  recoveredReminders: number;
  recoveredExpenses: number;
  recoveredIncomes: number;
  notes: string[];
}

export const DEFAULT_ACCOUNT_CHECKLIST: AccountChecklistItem[] = [
  {
    id: 'emergency_fund',
    category: 'safety',
    title: 'Emergency Fund (6 Months Expenses)',
    description: 'Maintain 6 months of mandatory living expenses in liquid sweep FD or liquid fund before market investing.',
    priority: 'critical',
    completed: false,
    actionRoute: '/ledger'
  },
  {
    id: 'term_insurance',
    category: 'insurance',
    title: 'Pure Term Life Cover (10x-20x Income)',
    description: 'Ensure breadwinner has pure term insurance covering 10x-20x annual CTC. Avoid ULIPs/endowment plans.',
    priority: 'critical',
    completed: false,
    actionRoute: '/insurance'
  },
  {
    id: 'health_insurance',
    category: 'insurance',
    title: 'Independent Health Insurance + Super Top-up',
    description: 'Maintain personal health insurance (₹10L-₹25L) separate from corporate employer group cover.',
    priority: 'critical',
    completed: false,
    actionRoute: '/insurance'
  },
  {
    id: 'recurring_budget',
    category: 'cashflow',
    title: 'Map Recurring Bills & Commitments',
    description: 'Configure automated rules for rent, utilities, credit cards, and subscriptions to track commitments.',
    priority: 'high',
    completed: false,
    actionRoute: '/checklist'
  },
  {
    id: 'index_investing',
    category: 'investments',
    title: 'Disciplined Monthly Index / Equity SIPs',
    description: 'Automate SIPs into broad-market index funds (Nifty 50 / Total Market) according to risk appetite.',
    priority: 'high',
    completed: false,
    actionRoute: '/trades'
  },
  {
    id: 'tax_optimization',
    category: 'tax',
    title: 'Tax Regime Optimization (FY 2025-26)',
    description: 'Compare Old vs New Regime (Section 115BAC) to optimize take-home pay and claim eligible deductions.',
    priority: 'high',
    completed: false,
    actionRoute: '/tax'
  },
  {
    id: 'nomination_will',
    category: 'estate',
    title: 'Register Nominees on All Accounts',
    description: 'Verify that valid nominees are registered across your bank accounts, Demat accounts, and EPF.',
    priority: 'medium',
    completed: false,
    actionRoute: '/family'
  },
  {
    id: 'offline_vault_backup',
    category: 'security',
    title: 'Export Encrypted Local Vault Backup',
    description: 'Download a cryptographic JSON snapshot of your data and store it offline on a secure personal drive.',
    priority: 'medium',
    completed: false,
    actionRoute: '/settings'
  }
];

const DEFAULT_ITR3_DATA: ITR3Data = {
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
};

function getStorageKey(profileId: string): string {
  const safeId = (profileId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `finsathi_profile_data_${safeId}`;
}

function getSnapshotsKey(profileId: string): string {
  const safeId = (profileId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `finsathi_profile_snapshots_${safeId}`;
}

function getChecklistKey(profileId: string): string {
  const safeId = (profileId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `finsathi_profile_checklist_${safeId}`;
}

/**
 * Capture and persist all in-memory data for a profile across all stores.
 */
export async function saveProfileSnapshot(profileId: string, label?: string): Promise<boolean> {
  if (!profileId) return false;

  const appState = useAppStore.getState();
  const recurringState = useRecurringStore.getState();
  const salaryState = useSalaryStore.getState();
  const auditState = useAuditStore.getState();

  // Load existing checklist for profile
  let checklist = DEFAULT_ACCOUNT_CHECKLIST;
  try {
    const rawChecklist = localStorage.getItem(getChecklistKey(profileId));
    if (rawChecklist) {
      checklist = JSON.parse(rawChecklist);
    }
  } catch {}

  const snapshot: ProfileFinancialState = {
    incomeItems: appState.incomeItems || [],
    expenseItems: appState.expenseItems || [],
    tradeItems: appState.tradeItems || [],
    reminders: appState.reminders || [],
    tradingAccounts: appState.tradingAccounts || [],
    recurringRules: recurringState.rules || [],
    recurringTriggers: recurringState.triggers || [],
    salaryRevisions: salaryState.revisions || [],
    salaryPostedMonths: salaryState.postedMonths || [],
    accountAuditLog: auditState.entries || [],
    accountChecklist: checklist,
    importHistory: appState.importHistory || [],
    itr3Data: appState.itr3Data || DEFAULT_ITR3_DATA,
    currentFY: appState.currentFY,
    preferredRegime: appState.preferredRegime,
    savedAt: new Date().toISOString(),
  };

  const key = getStorageKey(profileId);
  const serialized = JSON.stringify(snapshot);

  try {
    localStorage.setItem(key, serialized);
  } catch (err: any) {
    console.warn(`[FinSathi Storage] LocalStorage full for ${profileId}. Saving to IndexedDB:`, err.message);
    try {
      await dbPut(profileId, 'settings', { id: 'snapshot', ...snapshot });
    } catch (idbErr: any) {
      console.error(`[FinSathi Storage] Failed saving to IndexedDB:`, idbErr.message);
      return false;
    }
  }

  // Save to Rolling Snapshots History (Keep up to 5 snapshots)
  try {
    const snapsKey = getSnapshotsKey(profileId);
    let history: SnapshotMetadata[] = [];
    const rawHist = localStorage.getItem(snapsKey);
    if (rawHist) {
      try { history = JSON.parse(rawHist); } catch {}
    }

    const newSnapshotMeta: SnapshotMetadata = {
      id: `snap_${Date.now()}`,
      timestamp: snapshot.savedAt,
      label: label || `Auto-Save (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      counts: {
        income: snapshot.incomeItems.length,
        expenses: snapshot.expenseItems.length,
        trades: snapshot.tradeItems.length,
        recurring: snapshot.recurringRules.length,
        salaryRevisions: snapshot.salaryRevisions.length,
        reminders: snapshot.reminders.length
      },
      state: snapshot
    };

    history = [newSnapshotMeta, ...history].slice(0, 5);
    localStorage.setItem(snapsKey, JSON.stringify(history));
  } catch {}

  return true;
}

/**
 * Load a profile's isolated financial data into useAppStore, useRecurringStore, and useSalaryStore.
 */
export async function loadProfileSnapshot(profileId: string): Promise<boolean> {
  if (!profileId) return false;

  const key = getStorageKey(profileId);
  let data: ProfileFinancialState | null = null;

  // 1. Try LocalStorage
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  // 2. If not found, try IndexedDB
  if (!data) {
    try {
      const idbData = await dbGetAll<any>(profileId, 'settings');
      const found = idbData.find(item => item.id === 'snapshot');
      if (found) {
        data = found as ProfileFinancialState;
      }
    } catch (err) {
      console.warn(`[FinSathi Storage] Could not read from IndexedDB for ${profileId}:`, err);
    }
  }

  // 3. Fallback for Master Admin: check legacy 'finsathi-store'
  if (!data && profileId === 'prof_admin_master') {
    const legacyRaw = localStorage.getItem('finsathi-store');
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw);
        if (legacy.state) {
          data = {
            incomeItems: legacy.state.incomeItems || [],
            expenseItems: legacy.state.expenseItems || [],
            tradeItems: legacy.state.tradeItems || [],
            reminders: legacy.state.reminders || [],
            tradingAccounts: legacy.state.tradingAccounts || [],
            recurringRules: legacy.state.recurringRules || [],
            recurringTriggers: [],
            salaryRevisions: [],
            salaryPostedMonths: [],
            accountAuditLog: [],
            accountChecklist: DEFAULT_ACCOUNT_CHECKLIST,
            importHistory: legacy.state.importHistory || [],
            itr3Data: legacy.state.itr3Data || DEFAULT_ITR3_DATA,
            currentFY: legacy.state.currentFY,
            preferredRegime: legacy.state.preferredRegime,
            savedAt: new Date().toISOString()
          };
        }
      } catch {}
    }
  }

  // 4. Hydrate all stores cleanly
  if (data) {
    // A. useAppStore
    useAppStore.setState({
      incomeItems: data.incomeItems || [],
      expenseItems: data.expenseItems || [],
      tradeItems: data.tradeItems || [],
      reminders: data.reminders || [],
      tradingAccounts: data.tradingAccounts && data.tradingAccounts.length > 0
        ? data.tradingAccounts
        : [{ id: 'default', name: 'Primary Account', broker: 'Zerodha', notes: 'Auto-created', createdAt: new Date().toISOString() }],
      recurringRules: (data.recurringRules || []).map(r => ({
        id: r.id,
        type: r.type === 'income' ? 'income' : 'expense',
        amountPaise: r.amountPaise || 0,
        label: (r as any).label || (r as any).title || 'Recurring Item',
        frequency: ((r as any).frequency === 'yearly' ? 'annual' : ((r as any).frequency || 'monthly')) as 'monthly' | 'quarterly' | 'annual',
        isActive: (r as any).status !== 'paused',
        createdAt: (r as any).createdAt || new Date().toISOString()
      })),
      importHistory: data.importHistory || [],
      itr3Data: data.itr3Data || DEFAULT_ITR3_DATA,
      currentFY: data.currentFY || useAppStore.getState().currentFY,
      preferredRegime: data.preferredRegime || useAppStore.getState().preferredRegime,
    });

    // B. useRecurringStore
    // If profile snapshot has recurring rules, load them; otherwise check for orphan recovery
    let recurringRules = data.recurringRules || [];
    let recurringTriggers = data.recurringTriggers || [];
    
    if (recurringRules.length === 0) {
      // Check if global legacy 'finsathi-recurring' has rules to recover
      try {
        const globalRec = localStorage.getItem('finsathi-recurring');
        if (globalRec) {
          const parsedRec = JSON.parse(globalRec);
          if (parsedRec.state?.rules?.length > 0) {
            recurringRules = parsedRec.state.rules;
            recurringTriggers = parsedRec.state.triggers || [];
          }
        }
      } catch {}
    }

    useRecurringStore.setState({
      rules: recurringRules,
      triggers: recurringTriggers,
    });

    // C. useSalaryStore
    let salaryRevisions = data.salaryRevisions || [];
    let postedMonths = data.salaryPostedMonths || [];
    if (salaryRevisions.length === 0) {
      try {
        const globalSal = localStorage.getItem('finsathi_salary_store');
        if (globalSal) {
          const parsedSal = JSON.parse(globalSal);
          if (parsedSal.state?.revisions?.length > 0) {
            salaryRevisions = parsedSal.state.revisions;
            postedMonths = parsedSal.state.postedMonths || [];
          }
        }
      } catch {}
    }

    useSalaryStore.setState({
      revisions: salaryRevisions,
      postedMonths,
    });

    // D. useAuditStore
    if (data.accountAuditLog && data.accountAuditLog.length > 0) {
      useAuditStore.setState({ entries: data.accountAuditLog });
    }

    // E. Checklist
    if (data.accountChecklist) {
      try {
        localStorage.setItem(getChecklistKey(profileId), JSON.stringify(data.accountChecklist));
      } catch {}
    }

  } else {
    // Brand new profile: initialize clean isolated state
    useAppStore.setState({
      incomeItems: [],
      expenseItems: [],
      tradeItems: [],
      reminders: [],
      tradingAccounts: [{ id: `acc_${Date.now()}`, name: 'Primary Account', broker: 'Zerodha', notes: 'Auto-created', createdAt: new Date().toISOString() }],
      recurringRules: [],
      importHistory: [],
      itr3Data: DEFAULT_ITR3_DATA,
    });

    useRecurringStore.setState({ rules: [], triggers: [] });
    useSalaryStore.setState({ revisions: [], postedMonths: [] });
    useAuditStore.setState({ entries: [] });
    try {
      localStorage.setItem(getChecklistKey(profileId), JSON.stringify(DEFAULT_ACCOUNT_CHECKLIST));
    } catch {}
  }

  return true;
}

/**
 * Deep Data Recovery Scan: Scans all local caches and keys for lost recurring rules,
 * reminders, or salary revisions, and safely merges them into the current active account.
 */
export async function deepRecoverAccountData(profileId: string): Promise<RecoveryReport> {
  const report: RecoveryReport = {
    profileId,
    recoveredRecurringRules: 0,
    recoveredSalaryRevisions: 0,
    recoveredReminders: 0,
    recoveredExpenses: 0,
    recoveredIncomes: 0,
    notes: [],
  };

  const appState = useAppStore.getState();
  const recurringState = useRecurringStore.getState();
  const salaryState = useSalaryStore.getState();

  // 1. Recover Recurring Rules from finsathi-recurring
  try {
    const rawRec = localStorage.getItem('finsathi-recurring');
    if (rawRec) {
      const parsed = JSON.parse(rawRec);
      const candidateRules: ScheduledRule[] = parsed?.state?.rules || [];
      const currentIds = new Set((recurringState.rules || []).map(r => r.id));

      const missingRules = candidateRules.filter(r => !currentIds.has(r.id));
      if (missingRules.length > 0) {
        const merged = [...(recurringState.rules || []), ...missingRules];
        useRecurringStore.setState({ rules: merged });
        report.recoveredRecurringRules += missingRules.length;
        report.notes.push(`Recovered ${missingRules.length} recurring rule(s) from legacy recurring storage.`);
      }
    }
  } catch (err: any) {
    report.notes.push(`Notice: Could not parse legacy recurring storage: ${err.message}`);
  }

  // 2. Recover Salary Structure from finsathi_salary_store
  try {
    const rawSal = localStorage.getItem('finsathi_salary_store');
    if (rawSal) {
      const parsed = JSON.parse(rawSal);
      const candidateRevs: SalaryStructure[] = parsed?.state?.revisions || [];
      const currentRevIds = new Set((salaryState.revisions || []).map(r => r.id));

      const missingRevs = candidateRevs.filter(r => !currentRevIds.has(r.id));
      if (missingRevs.length > 0) {
        const mergedRevs = [...(salaryState.revisions || []), ...missingRevs];
        useSalaryStore.setState({ revisions: mergedRevs });
        report.recoveredSalaryRevisions += missingRevs.length;
        report.notes.push(`Recovered ${missingRevs.length} salary revision(s) from global salary storage.`);
      }
    }
  } catch (err: any) {
    report.notes.push(`Notice: Could not parse legacy salary storage: ${err.message}`);
  }

  // 3. Recover Reminders & Ledger from finsathi-store
  try {
    const rawStore = localStorage.getItem('finsathi-store');
    if (rawStore) {
      const parsed = JSON.parse(rawStore);
      const st = parsed?.state;
      if (st) {
        // Reminders
        const candidateReminders: Reminder[] = st.reminders || [];
        const currentRemIds = new Set((appState.reminders || []).map(r => r.id));
        const missingReminders = candidateReminders.filter(r => !currentRemIds.has(r.id));
        if (missingReminders.length > 0) {
          const mergedRem = [...(appState.reminders || []), ...missingReminders];
          useAppStore.setState({ reminders: mergedRem });
          report.recoveredReminders += missingReminders.length;
          report.notes.push(`Recovered ${missingReminders.length} reminder(s) from legacy vault.`);
        }

        // Check if st has recurringRules
        const stRules: ScheduledRule[] = st.recurringRules || [];
        const currentRules = useRecurringStore.getState().rules || [];
        const ruleIds = new Set(currentRules.map(r => r.id));
        const missingStRules = stRules.filter(r => !ruleIds.has(r.id));
        if (missingStRules.length > 0) {
          useRecurringStore.setState({ rules: [...currentRules, ...missingStRules] });
          report.recoveredRecurringRules += missingStRules.length;
          report.notes.push(`Recovered ${missingStRules.length} recurring rule(s) from core vault.`);
        }
      }
    }
  } catch (err: any) {
    report.notes.push(`Notice: Could not parse legacy core store: ${err.message}`);
  }

  // Persist updated state to current profile
  await saveProfileSnapshot(profileId, 'Post-Recovery Deep Scan');

  useAuditStore.getState().log({
    action: 'UPDATE',
    entity: 'settings',
    label: `Deep recovery scan completed for account ${profileId}`,
    details: `Recovered: ${report.recoveredRecurringRules} recurring, ${report.recoveredSalaryRevisions} salary revisions, ${report.recoveredReminders} reminders.`
  });

  return report;
}

/**
 * Retrieve snapshot history for account.
 */
export function getProfileSnapshotHistory(profileId: string): SnapshotMetadata[] {
  const snapsKey = getSnapshotsKey(profileId);
  try {
    const raw = localStorage.getItem(snapsKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Restore an account snapshot from rolling history by index.
 */
export async function restoreProfileSnapshotByIndex(profileId: string, index: number): Promise<boolean> {
  const history = getProfileSnapshotHistory(profileId);
  const target = history[index];
  if (!target || !target.state) return false;

  const key = getStorageKey(profileId);
  localStorage.setItem(key, JSON.stringify(target.state));
  await loadProfileSnapshot(profileId);

  useAuditStore.getState().log({
    action: 'UPDATE',
    entity: 'settings',
    label: `Restored account snapshot: "${target.label}"`,
    details: `Timestamp: ${target.timestamp}`
  });

  return true;
}

/**
 * Account Checklist management.
 */
export function getAccountChecklist(profileId: string): AccountChecklistItem[] {
  const key = getChecklistKey(profileId);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : DEFAULT_ACCOUNT_CHECKLIST;
  } catch {
    return DEFAULT_ACCOUNT_CHECKLIST;
  }
}

export function saveAccountChecklist(profileId: string, checklist: AccountChecklistItem[]): void {
  const key = getChecklistKey(profileId);
  try {
    localStorage.setItem(key, JSON.stringify(checklist));
    saveProfileSnapshot(profileId, 'Checklist Update');
  } catch {}
}

/**
 * Wipe all storage for deleted profile.
 */
export async function clearProfileStorage(profileId: string): Promise<void> {
  localStorage.removeItem(getStorageKey(profileId));
  localStorage.removeItem(getSnapshotsKey(profileId));
  localStorage.removeItem(getChecklistKey(profileId));
  try {
    await dbClearProfile(profileId);
  } catch (err) {
    console.warn(`[FinSathi Storage] Could not clear IndexedDB for ${profileId}:`, err);
  }
}
