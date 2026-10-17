/**
 * FinSathi Profile-Isolated IndexedDB Engine
 * True profile separation: each profile gets an isolated database `finsathi_db_profile_{profileId}`.
 * Supports dual-mode sync with local Node/SQLite backend if enabled in Settings.
 */

const DB_VERSION = 1;

interface StoreSchema {
  ledger: { key: string; value: any };
  trades: { key: string; value: any };
  reminders: { key: string; value: any };
  settings: { key: string; value: any };
  cache: { key: string; value: any };
}

type StoreName = keyof StoreSchema;

function getDbName(profileId: string): string {
  const safeId = (profileId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `finsathi_db_profile_${safeId}`;
}

export async function openProfileDB(profileId: string): Promise<IDBDatabase> {
  const dbName = getDbName(profileId);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const stores: StoreName[] = ['ledger', 'trades', 'reminders', 'settings', 'cache'];
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function dbPut<T extends { id: string }>(profileId: string, storeName: StoreName, item: T): Promise<void> {
  const db = await openProfileDB(profileId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet<T>(profileId: string, storeName: StoreName, id: string): Promise<T | null> {
  const db = await openProfileDB(profileId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll<T>(profileId: string, storeName: StoreName): Promise<T[]> {
  const db = await openProfileDB(profileId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(profileId: string, storeName: StoreName, id: string): Promise<void> {
  const db = await openProfileDB(profileId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbClearProfile(profileId: string): Promise<void> {
  const dbName = getDbName(profileId);
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Dual-mode sync helper to local backend if configured.
 * Automatically injects X-FinSathi-Token and applies conflict-free merged data.
 */
export async function syncToLocalBackend(
  profileId: string,
  serverUrl?: string
): Promise<{ success: boolean; message: string; mergedCount?: number }> {
  try {
    // Dynamic import to prevent circular dependency
    const { useAppStore } = await import('../hooks/useAppStore');
    const state = useAppStore.getState();
    const targetUrl = serverUrl || state.serverHost || 'http://localhost:3001';
    const token = state.serverAuthToken || '';

    // Extract current in-memory items
    const ledger = [...(state.incomeItems || []), ...(state.expenseItems || [])];
    const trades = state.tradeItems || [];
    const reminders = state.reminders || [];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['X-FinSathi-Token'] = token;
    }

    const res = await fetch(`${targetUrl}/api/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        profileId,
        timestamp: new Date().toISOString(),
        payload: { ledger, trades, reminders }
      }),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('Unauthorized: Server token mismatch. Re-pair device.');
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    // If server returned merged data, reflect updates in memory without overwriting
    if (data.mergedData) {
      const mergedLedger: any[] = data.mergedData.ledger || [];
      const newIncome = mergedLedger.filter(item => item.type === 'income');
      const newExpenses = mergedLedger.filter(item => item.type === 'expense');
      
      useAppStore.setState({
        incomeItems: newIncome,
        expenseItems: newExpenses,
        tradeItems: data.mergedData.trades || trades,
        reminders: data.mergedData.reminders || reminders,
      });
    }

    return { 
      success: true, 
      message: data.message || 'Synced and merged successfully with local backend',
      mergedCount: data.mergedData?.ledger?.length
    };
  } catch (err: any) {
    return { success: false, message: `Local backend sync offline: ${err.message}` };
  }
}

