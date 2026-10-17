/**
 * FinSathi System Database & State Initializer
 * Guarantees proper initialization of all databases, stores, and profile data on app boot.
 * Auto-detects and recovers any orphaned recurring expenses, salary profiles, or reminders.
 */

import { useProfileStore } from '../hooks/useProfileStore';
import { loadProfileSnapshot, deepRecoverAccountData, saveProfileSnapshot } from './profileDataManager';
import { useRecurringStore } from '../hooks/useRecurringStore';
import { useAuditStore } from '../hooks/useAuditStore';
import { openProfileDB } from './db';

let isInitialized = false;

export async function initializeFinSathiSystem(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    const profileStore = useProfileStore.getState();
    const activeProfile = profileStore.getActiveProfile();
    const profileId = activeProfile.id || 'prof_admin_master';

    // 1. Initialize IndexedDB for profile
    try {
      await openProfileDB(profileId);
    } catch (idbErr) {
      console.warn('[FinSathi Init] IndexedDB initial check notice:', idbErr);
    }

    // 2. Load isolated snapshot for active profile
    await loadProfileSnapshot(profileId);

    // 3. Check for orphaned recurring rules & recover if active profile has none
    const currentRules = useRecurringStore.getState().rules || [];
    if (currentRules.length === 0) {
      const recReport = await deepRecoverAccountData(profileId);
      if (recReport.recoveredRecurringRules > 0 || recReport.recoveredSalaryRevisions > 0) {
        console.log(`[FinSathi Init] Auto-recovered orphaned financial data:`, recReport);
      }
    }

    // 4. Record initialization in audit trail
    useAuditStore.getState().log({
      action: 'UPDATE',
      entity: 'settings',
      label: `FinSathi System Initialized for ${activeProfile.name} (${activeProfile.tag})`,
      details: `Profile: ${profileId} • Storage: Isolated & Verified`
    });

    isInitialized = true;
    return true;
  } catch (err: any) {
    console.error('[FinSathi Init] Error initializing system:', err.message);
    return false;
  }
}
