/**
 * FinSathi Versioning & Backward-Compatible Migration Engine
 * Ensures smooth schema upgrades, legacy data support, and non-destructive backups.
 */

export const CURRENT_SCHEMA_VERSION = 2;
export const APP_VERSION = '2.1.0';

export interface ReleaseItem {
  id: string;
  title: string;
  badge: string;
  description: string;
  widgetType?: 'salary' | 'tax' | 'trades' | 'ledger' | 'reminders' | 'ai-chat';
  actionLabel?: string;
  route?: string;
}

export interface FeatureRelease {
  version: string;
  title: string;
  date: string;
  summary: string;
  items: ReleaseItem[];
}

export const LATEST_RELEASE: FeatureRelease = {
  version: '2.1.0',
  title: 'Modular Widgets, Local AI MCP & Gradual Disclosure',
  date: 'October 2026',
  summary: 'Transform your FinSathi dashboard into an adaptive, plug-and-play financial OS. Enable only the modules you need.',
  items: [
    {
      id: 'modular_widgets',
      title: 'Plug-and-Play Dashboard Widgets',
      badge: 'NEW',
      description: 'Fully customizable widgets with in-place title editing, reordering, and direct data pipelines between Salary, Tax, and Trades.',
      actionLabel: 'Configure in Settings',
      route: '/settings'
    },
    {
      id: 'local_ai_mcp',
      title: 'Local AI Financial Copilot (MCP)',
      badge: 'AI',
      description: 'Interact with your ledger, calculate taxes, and query trades using local AI tools without cloud dependence.',
      widgetType: 'ai-chat',
      actionLabel: 'Enable AI Chat'
    },
    {
      id: 'trades_pipeline',
      title: 'Capital Gains & Trading Engine',
      badge: 'MARKETS',
      description: 'STCG and LTCG tracking with automatic classification and direct connection to your FY 2025-26 Tax Engine.',
      widgetType: 'trades',
      actionLabel: 'Enable Trades Tracker'
    },
    {
      id: 'profile_isolation',
      title: 'Personal Hosting & Profile Vaults',
      badge: 'SECURITY',
      description: 'Zero cross-profile data leakage with separate IndexedDB partitions and PBKDF2 hashing.',
      actionLabel: 'Manage Profiles',
      route: '/settings'
    }
  ]
};

export interface VersionedBackup {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  checksum?: string;
  profileId?: string;
  profileName?: string;
  data: Record<string, any>;
}

/**
 * Validates and upgrades any imported backup or state to the current schema.
 * Backward compatible with unversioned legacy exports (v1).
 */
export function migrateBackupData(raw: any): { 
  success: boolean; 
  migratedData?: Record<string, any>; 
  detectedVersion: number; 
  notes: string[];
} {
  const notes: string[] = [];
  
  if (!raw || typeof raw !== 'object') {
    return { success: false, detectedVersion: 0, notes: ['Invalid payload: expected an object'] };
  }

  // Detect schema version
  let version = 1;
  let payload: Record<string, any> = raw;

  if (typeof raw.schemaVersion === 'number') {
    version = raw.schemaVersion;
    payload = raw.data || raw;
  } else if (raw.exportVersion) {
    version = parseInt(String(raw.exportVersion), 10) || 1;
  } else {
    notes.push('Legacy unversioned backup detected (Schema v1). Applying backward-compatible migrations.');
  }

  const migrated = { ...payload };

  // ============ Migration from v1 to v2 ============
  if (version < 2) {
    // 1. Ensure all ledger items have createdAt and id
    if (Array.isArray(migrated.incomeItems)) {
      migrated.incomeItems = migrated.incomeItems.map((item: any, idx: number) => ({
        id: item.id || `inc_migrated_${Date.now()}_${idx}`,
        type: 'income',
        head: item.head || 'other',
        amountPaise: typeof item.amountPaise === 'number' ? item.amountPaise : Math.round((Number(item.amount) || 0) * 100),
        source: item.source || 'Legacy Import',
        fy: item.fy || '2024-25',
        isTaxable: item.isTaxable !== false,
        notes: item.notes || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        date: item.date || new Date().toISOString(),
        createdAt: item.createdAt || new Date().toISOString(),
      }));
    } else {
      migrated.incomeItems = [];
    }

    if (Array.isArray(migrated.expenseItems)) {
      migrated.expenseItems = migrated.expenseItems.map((item: any, idx: number) => ({
        id: item.id || `exp_migrated_${Date.now()}_${idx}`,
        type: 'expense',
        category: item.category || 'General',
        amountPaise: typeof item.amountPaise === 'number' ? item.amountPaise : Math.round((Number(item.amount) || 0) * 100),
        date: item.date || new Date().toISOString(),
        merchant: item.merchant || 'Unknown',
        notes: item.notes || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        isRecurring: Boolean(item.isRecurring),
        createdAt: item.createdAt || new Date().toISOString(),
      }));
    } else {
      migrated.expenseItems = [];
    }

    if (Array.isArray(migrated.tradeItems)) {
      migrated.tradeItems = migrated.tradeItems.map((item: any, idx: number) => ({
        id: item.id || `trd_migrated_${Date.now()}_${idx}`,
        type: 'trade',
        accountId: item.accountId || 'default',
        instrument: item.instrument || 'EQUITY',
        isin: item.isin,
        buyDate: item.buyDate || item.date || new Date().toISOString(),
        sellDate: item.sellDate || item.date || new Date().toISOString(),
        qty: Number(item.qty) || 1,
        buyPricePaise: typeof item.buyPricePaise === 'number' ? item.buyPricePaise : Math.round((Number(item.buyPrice) || 0) * 100),
        sellPricePaise: typeof item.sellPricePaise === 'number' ? item.sellPricePaise : Math.round((Number(item.sellPrice) || 0) * 100),
        chargesPaise: typeof item.chargesPaise === 'number' ? item.chargesPaise : 0,
        assetType: item.assetType || 'equity',
        classification: item.classification || 'STCG',
        realizedPnlPaise: typeof item.realizedPnlPaise === 'number' ? item.realizedPnlPaise : 0,
        notes: item.notes || '',
        createdAt: item.createdAt || new Date().toISOString(),
      }));
    } else {
      migrated.tradeItems = [];
    }

    if (!Array.isArray(migrated.reminders)) {
      migrated.reminders = [];
    }

    if (!migrated.itr3Data || typeof migrated.itr3Data !== 'object') {
      migrated.itr3Data = {
        assessmentYear: '2025-26',
        filingSection: '139(1)',
        form10IEA: { filed: false, regime: 'new' },
        houseProperties: [],
        businessExpenses: [],
        fnoAccountingMethod: 'actual',
        otherSourceIncome: [],
        deductionEntries: [],
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
    }

    notes.push('Successfully upgraded data structures to Schema v2 specifications.');
  }

  return {
    success: true,
    migratedData: migrated,
    detectedVersion: version,
    notes,
  };
}

/**
 * Packages a state payload into a standardized, versioned backup container.
 */
export function packageBackup(
  data: Record<string, any>,
  options: { profileId?: string; profileName?: string; checksum?: string } = {}
): VersionedBackup {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    profileId: options.profileId || 'default',
    profileName: options.profileName || 'Primary Profile',
    checksum: options.checksum,
    data,
  };
}
