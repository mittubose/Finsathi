import { useRef, useState } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { useProfileStore, type UserRole } from '../../shared/hooks/useProfileStore';
import { useWidgetStore, type WorkflowPreset } from '../../shared/widgets/useWidgetStore';
import { WIDGET_REGISTRY } from '../../shared/widgets/widgetTypes';
import { getCurrentFY, getFYRange } from '../../shared/lib/dates';
import { useToast } from '../../shared/ui/Toast';
import { packageBackup, migrateBackupData, CURRENT_SCHEMA_VERSION, APP_VERSION } from '../../shared/lib/versioning';
import { computeDataChecksum } from '../../shared/lib/security';
import { syncToLocalBackend } from '../../shared/lib/db';
import { FINSATHI_MCP_TOOLS } from '../../shared/lib/mcp';
import { ZeroStageOnboarding } from '../../shared/ui/ZeroStageOnboarding';
import { WhatsNewModal } from '../../shared/ui/WhatsNewModal';
import { useCommandStore } from '../../shared/hooks/useCommandStore';
import { AccountManagerModal } from './AccountManagerModal';
import { PersonalFinanceFAQ } from '../help/PersonalFinanceFAQ';
import { deepRecoverAccountData } from '../../shared/lib/profileDataManager';
import { useSearchParams } from 'react-router-dom';
import { KeyboardShortcutsCheatSheet } from '../settings/KeyboardShortcutsCheatSheet';
import { ApiAnalyticsView } from '../settings/ApiAnalyticsView';
import './Settings.css';

type SettingsTab = 'general' | 'shortcuts' | 'ai' | 'analytics' | 'backups' | 'faq';

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'general', label: 'PREFERENCES', icon: 'tune' },
  { id: 'shortcuts', label: 'SHORTCUTS', icon: 'keyboard' },
  { id: 'ai', label: 'AI & MCP', icon: 'smart_toy' },
  { id: 'analytics', label: 'API ANALYTICS', icon: 'query_stats' },
  { id: 'backups', label: 'DATA & RECOVERY', icon: 'backup' },
  { id: 'faq', label: 'FAQ & HEALTH', icon: 'help' },
];

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'general';
  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  const { 
    currentFY, setFY, preferredRegime, setRegime,
    vaultActive, vaultPassword, biometricId,
    setVaultActive, setVaultPassword, registerBiometrics,
    restoreBackup
  } = useAppStore();

  const { profiles, activeProfileId, setActiveProfile, addProfile, deleteProfile } = useProfileStore();
  const { widgets, toggleWidget, moveWidget, updateWidgetConfig, applyPreset, resetToDefault } = useWidgetStore();
  const { openServerWizard } = useCommandStore();


  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  
  const [tempPassword, setTempPassword] = useState('');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  // New Profile Form State
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRole, setNewProfileRole] = useState<UserRole>('individual');
  const [newProfilePan, setNewProfilePan] = useState('');

  // Local AI & Sync Config
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('finsathi_ollama_url') || 'http://127.0.0.1:11434');
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('finsathi_ollama_model') || 'llama3');
  const [syncServerUrl, setSyncServerUrl] = useState(() => localStorage.getItem('finsathi_sync_url') || 'http://127.0.0.1:3001');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useState(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(setIsBiometricSupported);
    }
  });

  const FY_OPTIONS = getFYRange(2000, new Date().getFullYear() + 2)
    .reverse()
    .map(fy => {
      const startYear = parseInt(fy.split('-')[0]);
      return {
        value: fy,
        label: `FY ${fy} (Apr ${startYear} - Mar ${startYear + 1})`
      };
    });

  const handleExport = async () => {
    const state = useAppStore.getState();
    const activeProf = profiles.find(p => p.id === activeProfileId);
    
    const rawData = {
      fy: currentFY,
      preferredRegime: state.preferredRegime,
      incomeItems: state.incomeItems,
      expenseItems: state.expenseItems,
      tradeItems: state.tradeItems,
      reminders: state.reminders,
      tradingAccounts: state.tradingAccounts,
      recurringRules: state.recurringRules,
      importHistory: state.importHistory,
      itr3Data: state.itr3Data,
    };

    const checksum = await computeDataChecksum(rawData);
    const container = packageBackup(rawData, {
      profileId: activeProf?.id,
      profileName: activeProf?.name,
      checksum,
    });

    const blob = new Blob([JSON.stringify(container, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finsathi-vault-v${CURRENT_SCHEMA_VERSION}-${currentFY}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportConfirm(false);
    toast('Secure versioned backup exported with cryptographic checksum', 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = JSON.parse(event.target?.result as string);
        const result = migrateBackupData(rawJson);

        if (!result.success || !result.migratedData) {
          throw new Error(result.notes.join('; ') || 'Invalid backup structure');
        }

        restoreBackup(result.migratedData);
        if (result.detectedVersion < CURRENT_SCHEMA_VERSION) {
          toast(`Backup from Schema v${result.detectedVersion} migrated to v${CURRENT_SCHEMA_VERSION} successfully!`, 'success');
        } else {
          toast('Backup restored successfully!', 'success');
        }
      } catch (err: any) {
        console.error(err);
        toast(`Failed to restore backup: ${err.message || 'Corrupt file'}`, 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    localStorage.removeItem('finsathi-store');
    window.location.reload();
  };

  const handleSetVault = () => {
    if (!tempPassword && !vaultPassword) {
      toast('Please enter a password', 'error');
      return;
    }
    if (tempPassword) {
      setVaultPassword(tempPassword);
    }
    setVaultActive(true);
    setTempPassword('');
    toast('Vault security enabled with Web Crypto authentication', 'success');
  };

  const handleDisableVault = () => {
    setVaultActive(false);
    toast('Vault security disabled', 'info');
  };

  const handleRegisterBiometrics = async () => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'FinSathi Vault' },
          user: {
            id: new Uint8Array(16),
            name: 'admin@finsathi.local',
            displayName: 'FinSathi Vault User'
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          timeout: 60000,
          authenticatorSelection: {
            userVerification: 'required'
          }
        }
      });

      if (credential) {
        const pkCred = credential as PublicKeyCredential;
        const id = btoa(String.fromCharCode(...new Uint8Array(pkCred.rawId)));
        registerBiometrics(id);
        toast('Biometrics registered successfully', 'success');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to register biometrics', 'error');
    }
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) {
      toast('Profile name is required', 'error');
      return;
    }
    addProfile({
      name: newProfileName.trim(),
      role: newProfileRole,
      pan: newProfilePan.trim().toUpperCase(),
      tag: newProfileRole === 'admin' ? 'SYS_ADMIN' : 'INDIVIDUAL',
    });
    setNewProfileName('');
    setNewProfilePan('');
    toast(`Profile created: ${newProfileName}`, 'success');
  };

  const handleSaveAiSettings = () => {
    localStorage.setItem('finsathi_ollama_url', ollamaUrl);
    localStorage.setItem('finsathi_ollama_model', ollamaModel);
    toast('Local AI host settings saved', 'success');
  };

  const handleTestSync = async () => {
    setSyncStatus('Testing connection with local laptop daemon...');
    localStorage.setItem('finsathi_sync_url', syncServerUrl);
    const result = await syncToLocalBackend(activeProfileId, syncServerUrl);
    setSyncStatus(result.message);
    if (result.success) {
      toast('Local SQLite sync connection successful!', 'success');
    } else {
      toast('Sync failed: Make sure node server/mcp-server.mjs is running', 'error');
    }
  };

  return (
    <div className="settings">
      <div className="settings-header">
        <h1 className="text-headline-md">SETTINGS & ARCHITECTURE</h1>
        <span className="text-label-mono color-muted">MODULAR_SYSTEM_SUITE</span>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="settings-tabs-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <>
          {/* Workflow & Plug-and-Play Widgets Configuration */}
          <div className="glass-surface settings-section">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' }}>
          <span className="text-label-mono color-subtle">WORKFLOW_&_MODULAR_WIDGETS</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setShowOnboarding(true)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '10px',
                fontFamily: 'monospace',
                padding: '2px 8px',
                cursor: 'pointer',
                borderRadius: '2px',
              }}
            >
              ONBOARDING PREFERENCES ↺
            </button>
            <button
              onClick={() => setShowWhatsNew(true)}
              style={{
                background: 'var(--primary-container, #00ff41)',
                border: 'none',
                color: '#000',
                fontSize: '10px',
                fontFamily: 'monospace',
                fontWeight: 700,
                padding: '2px 8px',
                cursor: 'pointer',
                borderRadius: '2px',
              }}
            >
              WHAT'S NEW (v{APP_VERSION}) ⚡
            </button>
          </div>
        </div>
        <div className="settings-body">
          {/* Preset Buttons */}
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
            <span className="text-label-mono-sm color-muted">QUICK WORKFLOW PRESETS</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['salaried', 'salaried_investor', 'active_trader', 'minimalist'] as WorkflowPreset[]).map(preset => (
                <button
                  key={preset}
                  className="settings-action-btn"
                  onClick={() => {
                    applyPreset(preset);
                    toast(`Applied ${preset.replace('_', ' ')} workflow`, 'success');
                  }}
                >
                  {preset.toUpperCase().replace('_', ' ')}
                </button>
              ))}
              <button className="settings-action-btn settings-action-btn--danger" onClick={resetToDefault}>
                RESET DEFAULTS
              </button>
            </div>
          </div>

          {/* Widget Pipeline Table */}
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="text-label-mono-sm color-muted">ACTIVE PIPELINE BLOCKS (REORDER / TOGGLE)</span>
            {[...widgets].sort((a, b) => a.order - b.order).map(w => {
              const meta = WIDGET_REGISTRY[w.type];
              return (
                <div 
                  key={w.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: w.enabled ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '2px',
                    opacity: w.enabled ? 1 : 0.45,
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <button onClick={() => moveWidget(w.id, 'up')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}>▲</button>
                      <button onClick={() => moveWidget(w.id, 'down')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}>▼</button>
                    </div>

                    <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary-container)' }}>
                      {meta?.icon || 'widgets'}
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="text-body-bold" style={{ fontSize: '12px' }}>{w.title}</span>
                      <span className="text-label-mono-xs color-muted">{meta?.description}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className={`settings-action-btn ${w.enabled ? 'active' : ''}`}
                      onClick={() => toggleWidget(w.id)}
                      style={{ fontSize: '10px', padding: '3px 8px' }}
                    >
                      {w.enabled ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Profiles & Multi-Account Management */}
      <div className="glass-surface settings-section">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' }}>
          <span className="text-label-mono color-subtle">PROFILES_&_DATA_ISOLATION</span>
          <span className="text-label-mono-sm color-positive">{profiles.length} ISOLATED PROFILES</span>
        </div>
        <div className="settings-body">
          <div className="profiles-list-table">
            {profiles.map(p => (
              <div key={p.id} className={`profile-row ${p.id === activeProfileId ? 'active-profile-row' : ''}`}>
                <div className="profile-row-left">
                  <span className="profile-role-dot" />
                  <span className="text-body-bold">{p.name}</span>
                  {p.isMasterAdmin && (
                    <span className="profile-tag-badge">MASTER</span>
                  )}
                  <span className={`profile-role-pill ${p.role === 'admin' ? 'admin' : 'user'}`}>
                    {p.role.toUpperCase()}
                  </span>
                  {p.pan && <span className="profile-pan-tag">PAN: {p.pan}</span>}
                </div>

                <div className="profile-row-actions">
                  {p.id === activeProfileId ? (
                    <span className="text-label-mono-sm color-positive">CURRENT SESSION</span>
                  ) : (
                    <button className="settings-action-btn" onClick={() => setActiveProfile(p.id)}>
                      SWITCH TO
                    </button>
                  )}
                  {!p.isMasterAdmin && (
                    <button 
                      className="settings-action-btn settings-action-btn--danger" 
                      onClick={() => deleteProfile(p.id)}
                      title="Delete Profile"
                    >
                      <span className="material-symbols-outlined icon-xs">delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Profile Box */}
          <div className="add-profile-box">
            <span className="text-label-mono-sm color-muted">CREATE NEW PROFILE</span>
            <div className="add-profile-inputs">
              <input
                className="settings-input"
                placeholder="Profile Name (e.g. Spouse, HUF)"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
              />
              <select
                className="settings-select"
                value={newProfileRole}
                onChange={e => setNewProfileRole(e.target.value as UserRole)}
              >
                <option value="individual">Individual Profile</option>
                <option value="admin">Administrator Profile</option>
              </select>
              <input
                className="settings-input"
                placeholder="PAN (Optional)"
                maxLength={10}
                value={newProfilePan}
                onChange={e => setNewProfilePan(e.target.value.toUpperCase())}
              />
              <button className="settings-action-btn" onClick={handleCreateProfile}>
                <span className="material-symbols-outlined icon-sm">person_add</span>
                CREATE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account Data Recovery, 80/20 Checklist & Snapshots */}
      <div className="glass-surface settings-section" style={{ border: '1px solid rgba(0, 230, 118, 0.25)' }}>
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' }}>
          <span className="text-label-mono color-subtle">ACCOUNT_VAULT_&_DATA_RECOVERY</span>
          <span className="text-label-mono-sm color-positive">ISOLATED PER PROFILE</span>
        </div>
        <div className="settings-body">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="text-body" style={{ fontWeight: 600 }}>Account Health & Snapshot Vault</span>
              <span className="text-label-mono-sm color-muted">
                Rolling 5-point snapshot rollback, 80/20 financial checklist, and per-account audit trail
              </span>
            </div>
            <button
              className="settings-action-btn"
              onClick={() => setShowAccountModal(true)}
              style={{ background: 'rgba(0, 230, 118, 0.15)', borderColor: 'var(--brand-primary, #00e676)' }}
            >
              <span className="material-symbols-outlined icon-sm">shield</span>
              OPEN ACCOUNT VAULT
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="text-body" style={{ fontWeight: 600 }}>Deep Orphaned Data Recovery</span>
              <span className="text-label-mono-sm color-muted">
                Scan all local caches for missing recurring expenses, forgotten salary revisions, or unlinked ledger records
              </span>
            </div>
            <button
              className="settings-action-btn"
              disabled={isRecovering}
              onClick={async () => {
                setIsRecovering(true);
                try {
                  const rep = await deepRecoverAccountData(activeProfileId);
                  toast(`Recovery complete: Found ${rep.recoveredRecurringRules} recurring rules, ${rep.recoveredSalaryRevisions} salary revisions.`, 'success');
                } catch (e: any) {
                  toast(`Recovery failed: ${e.message}`, 'error');
                } finally {
                  setIsRecovering(false);
                }
              }}
            >
              <span className="material-symbols-outlined icon-sm">search_check</span>
              {isRecovering ? 'SCANNING...' : 'RUN DEEP RECOVERY'}
            </button>
          </div>
        </div>
      </div>

      {/* Tax Preferences */}
      <div className="glass-surface settings-section">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <span className="text-label-mono color-subtle">TAX_PREFERENCES</span>
        </div>
        <div className="settings-body">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="text-body" style={{ fontWeight: 500 }}>Financial Year</span>
              <span className="text-label-mono-sm color-muted">All calculations use this FY</span>
            </div>
            <select
              className="settings-select"
              value={currentFY}
              onChange={(e) => setFY(e.target.value)}
            >
              {FY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="text-body" style={{ fontWeight: 500 }}>Tax Regime</span>
              <span className="text-label-mono-sm color-muted">Default regime for tax calculations</span>
            </div>
            <div className="settings-regime-toggle">
              {(['old', 'new', 'compare'] as const).map((r) => (
                <button
                  key={r}
                  className={`settings-regime-btn ${preferredRegime === r ? 'active' : ''}`}
                  onClick={() => setRegime(r)}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Security & Vault */}
      <div className="glass-surface settings-section">
        <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' }}>
          <span className="text-label-mono color-subtle">SECURITY_&_CRYPTOGRAPHIC_VAULT</span>
          {vaultActive ? (
            <span className="text-label-mono-sm color-positive">SECURE_ENVIRONMENT_ACTIVE</span>
          ) : (
            <span className="text-label-mono-sm color-muted">VAULT_UNLOCKED</span>
          )}
        </div>
        <div className="settings-body">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="text-body" style={{ fontWeight: 500 }}>Vault Protection</span>
              <span className="text-label-mono-sm color-muted">PBKDF2 SHA-256 encryption & anti-brute-force backoff</span>
            </div>
            <div className="settings-toggle-wrap">
              {vaultActive ? (
                <button className="settings-action-btn settings-action-btn--danger" onClick={handleDisableVault}>
                  <span className="material-symbols-outlined icon-sm">lock_open</span>
                  DISABLE_VAULT
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="password" 
                    className="settings-input" 
                    style={{ width: '150px' }}
                    placeholder="New Password" 
                    value={tempPassword}
                    onChange={e => setTempPassword(e.target.value)}
                  />
                  <button className="settings-action-btn" onClick={handleSetVault}>
                    <span className="material-symbols-outlined icon-sm">lock</span>
                    ENABLE
                  </button>
                </div>
              )}
            </div>
          </div>

          {vaultActive && (
            <>
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="text-body" style={{ fontWeight: 500 }}>Update Password</span>
                  <span className="text-label-mono-sm color-muted">Change your master access key</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="password" 
                    className="settings-input" 
                    style={{ width: '150px' }}
                    placeholder="New Password" 
                    value={tempPassword}
                    onChange={e => setTempPassword(e.target.value)}
                  />
                  <button className="settings-action-btn" onClick={handleSetVault}>
                    UPDATE
                  </button>
                </div>
              </div>

              {isBiometricSupported && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="text-body" style={{ fontWeight: 500 }}>Biometric Authentication</span>
                    <span className="text-label-mono-sm color-muted">Touch ID / Windows Hello WebAuthn</span>
                  </div>
                  <button 
                    className={`settings-action-btn ${biometricId ? 'active' : ''}`}
                    onClick={handleRegisterBiometrics}
                  >
                    <span className="material-symbols-outlined icon-sm">fingerprint</span>
                    {biometricId ? 'RE-REGISTER' : 'SETUP'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
        </>
      )}

      {/* Tab: Shortcuts */}
      {activeTab === 'shortcuts' && (
        <div className="glass-surface settings-section" style={{ padding: '20px' }}>
          <KeyboardShortcutsCheatSheet />
        </div>
      )}

      {/* Tab: AI & MCP */}
      {activeTab === 'ai' && (
        <>
          {/* Local AI Host Configuration */}
          <div className="glass-surface settings-section">
            <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' }}>
              <span className="text-label-mono color-subtle">LOCAL_AI_ENGINE_CONFIG</span>
              <span className="text-label-mono-sm color-positive">100% PRIVATE • ZERO CLOUD LEAK</span>
            </div>
            <div className="settings-body">
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="text-body" style={{ fontWeight: 500 }}>Host Ollama / LM Studio URL</span>
                  <span className="text-label-mono-sm color-muted">Local inference server running on this laptop</span>
                </div>
                <input
                  className="settings-input"
                  style={{ width: '220px' }}
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  placeholder="http://127.0.0.1:11434"
                />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="text-body" style={{ fontWeight: 500 }}>Local Model Name</span>
                  <span className="text-label-mono-sm color-muted">e.g. llama3, mistral, phi3, deepseek-coder</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="settings-input"
                    style={{ width: '150px' }}
                    value={ollamaModel}
                    onChange={e => setOllamaModel(e.target.value)}
                    placeholder="llama3"
                  />
                  <button className="settings-action-btn" onClick={handleSaveAiSettings}>
                    SAVE
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Model Context Protocol (MCP) Tools */}
          <div className="glass-surface settings-section">
            <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' }}>
              <span className="text-label-mono color-subtle">MODEL_CONTEXT_PROTOCOL_(MCP)_INTELLIGENCE</span>
              <span className="text-label-mono-sm color-positive">{FINSATHI_MCP_TOOLS.length} MCP TOOLS READY</span>
            </div>
            <div className="settings-body">
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="text-label-mono-sm color-muted">REGISTERED MCP CAPABILITIES</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {FINSATHI_MCP_TOOLS.map(t => (
                    <div key={t.name} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-data-display color-positive" style={{ fontSize: '12px' }}>⚡ {t.name}</span>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{t.description}</p>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,65,0.2)', fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>
                  Launch external MCP agent bridge: <span style={{ color: 'var(--primary-container)' }}>node server/mcp-server.mjs</span>
                </div>
                
                <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    className="settings-action-btn"
                    onClick={openServerWizard}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span className="material-symbols-outlined icon-sm">health_and_safety</span>
                    SERVER_SETUP_&_DIAGNOSTICS_WIZARD
                  </button>
                  <button 
                    type="button"
                    className="settings-action-btn"
                    onClick={openServerWizard}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span className="material-symbols-outlined icon-sm">qr_code_scanner</span>
                    PAIR_MOBILE_DEVICE_(QR)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Database Settings & Dual-Mode Local Sync */}
          <div className="glass-surface settings-section">
            <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' }}>
              <span className="text-label-mono color-subtle">DATABASE_&_DUAL_MODE_SYNC</span>
              <span className="text-label-mono-sm color-positive">INDEXED_DB + SQLITE SYNC</span>
            </div>
            <div className="settings-body">
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="text-body" style={{ fontWeight: 500 }}>Active Storage Engine</span>
                  <span className="text-label-mono-sm color-muted">Client-side IndexedDB per profile partition</span>
                </div>
                <span className="text-label-mono color-positive" style={{ fontSize: '11px' }}>
                  finsathi_db_profile_{activeProfileId}
                </span>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="text-body" style={{ fontWeight: 500 }}>Laptop SQLite Sync Daemon URL</span>
                  <span className="text-label-mono-sm color-muted">Service on your laptop: node server/mcp-server.mjs</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="settings-input"
                    style={{ width: '200px' }}
                    value={syncServerUrl}
                    onChange={e => setSyncServerUrl(e.target.value)}
                    placeholder="http://127.0.0.1:3001"
                  />
                  <button className="settings-action-btn" onClick={handleTestSync}>
                    TEST SYNC
                  </button>
                </div>
              </div>

              {syncStatus && (
                <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', fontSize: '11px', fontFamily: 'monospace', color: 'var(--primary-container)' }}>
                  {syncStatus}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tab: API Analytics */}
      {activeTab === 'analytics' && (
        <div className="glass-surface settings-section" style={{ padding: '20px' }}>
          <ApiAnalyticsView />
        </div>
      )}

      {/* Tab: Backups & Data Management */}
      {activeTab === 'backups' && (
        <>
          {/* Data Management & Versioning */}
          <div className="glass-surface settings-section">
            <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' }}>
              <span className="text-label-mono color-subtle">DATA_MANAGEMENT_&_VERSIONING</span>
              <span className="text-label-mono-sm color-muted">SCHEMA v{CURRENT_SCHEMA_VERSION}</span>
            </div>
            <div className="settings-body">
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="text-body" style={{ fontWeight: 500 }}>Export Vault Backup</span>
                  <span className="text-label-mono-sm color-muted">
                    Standardized JSON export with cryptographic SHA-256 integrity checksum
                  </span>
                </div>
                {!showExportConfirm ? (
                  <button className="settings-action-btn" onClick={() => setShowExportConfirm(true)}>
                    <span className="material-symbols-outlined icon-sm">download</span>
                    <span>EXPORT</span>
                  </button>
                ) : (
                  <div className="settings-confirm">
                    <button className="settings-confirm-yes" onClick={handleExport}>DOWNLOAD</button>
                    <button className="settings-confirm-no" onClick={() => setShowExportConfirm(false)}>CANCEL</button>
                  </div>
                )}
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="text-body" style={{ fontWeight: 500 }}>Restore Backup (Backward Compatible)</span>
                  <span className="text-label-mono-sm color-muted">
                    Accepts modern Schema v2 or legacy v1 backups with automatic migration
                  </span>
                </div>
                <button className="settings-action-btn" onClick={() => fileInputRef.current?.click()}>
                  <span className="material-symbols-outlined icon-sm">upload</span>
                  <span>RESTORE</span>
                </button>
                <input 
                  type="file" 
                  accept=".json" 
                  style={{ display: 'none' }} 
                  ref={fileInputRef} 
                  onChange={handleImport} 
                />
              </div>

              <div className="settings-row settings-row--danger">
                <div className="settings-row-info">
                  <span className="text-body" style={{ fontWeight: 500, color: 'var(--error)' }}>Clear All Vault Data</span>
                  <span className="text-label-mono-sm color-muted">Permanently wipe all records and reset the system</span>
                </div>
                {!showDeleteConfirm ? (
                  <button className="settings-action-btn settings-action-btn--danger" onClick={() => setShowDeleteConfirm(true)}>
                    <span className="material-symbols-outlined icon-sm">delete_forever</span>
                    <span>CLEAR</span>
                  </button>
                ) : (
                  <div className="settings-confirm">
                    <span className="text-label-mono-sm color-negative" style={{ marginRight: '8px' }}>ARE YOU SURE?</span>
                    <button className="settings-confirm-yes settings-confirm-yes--danger" onClick={handleClearData}>DELETE</button>
                    <button className="settings-confirm-no" onClick={() => setShowDeleteConfirm(false)}>CANCEL</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="glass-surface settings-section">
            <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <span className="text-label-mono color-subtle">SYSTEM_ENVIRONMENT_INFO</span>
            </div>
            <div className="settings-body">
              <div className="settings-info-row">
                <span className="text-label-mono-sm color-muted">APP_VERSION</span>
                <span className="text-data-display" style={{ fontSize: '11px' }}>{APP_VERSION}</span>
              </div>
              <div className="settings-info-row">
                <span className="text-label-mono-sm color-muted">SCHEMA_VERSION</span>
                <span className="text-data-display color-positive" style={{ fontSize: '11px' }}>v{CURRENT_SCHEMA_VERSION} (Backward-Compatible)</span>
              </div>
              <div className="settings-info-row">
                <span className="text-label-mono-sm color-muted">STORAGE_ENGINE</span>
                <span className="text-data-display color-positive" style={{ fontSize: '11px' }}>IndexedDB (finsathi_db_profile_{activeProfileId})</span>
              </div>
              <div className="settings-info-row">
                <span className="text-label-mono-sm color-muted">MCP_TOOL_PROTOCOL</span>
                <span className="text-data-display color-positive" style={{ fontSize: '11px' }}>ONLINE (Standard JSON-RPC Tools)</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tab: FAQ & Health */}
      {activeTab === 'faq' && (
        <PersonalFinanceFAQ />
      )}

      {/* Onboarding Preferences Modal */}
      <ZeroStageOnboarding
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />

      {/* Software Update & Release Notification Modal */}
      <WhatsNewModal
        isOpen={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
      />

      {/* Account Vault & Recovery Modal */}
      <AccountManagerModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
      />
    </div>
  );
}
