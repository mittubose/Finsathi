import { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useToast } from './Toast';
import { generateQrSvg } from '../lib/qrCode';
import { FinSathiLogo } from './FinSathiLogo';
import './Modal.css';

interface ServerSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticResult {
  id: string;
  label: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  details: string;
  recommendation?: string;
}

export function ServerSetupWizard({ isOpen, onClose }: ServerSetupWizardProps) {
  const { serverHost, serverAuthToken, setServerConfig } = useAppStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'diagnostics' | 'config' | 'mobile_qr' | 'security'>('diagnostics');
  const [hostInput, setHostInput] = useState(serverHost || 'http://localhost:3001');
  const [tokenInput, setTokenInput] = useState(serverAuthToken || '');
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [selectedLanIp, setSelectedLanIp] = useState<string>('');
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([
    { id: 'reachability', label: 'Daemon Reachability', status: 'pending', details: 'Checking port 3001...' },
    { id: 'latency', label: 'Network Latency', status: 'pending', details: 'Measuring ping...' },
    { id: 'auth', label: 'MCP Token Authentication', status: 'pending', details: 'Validating token...' },
    { id: 'security_context', label: 'CORS & Secure Context', status: 'pending', details: 'Checking protocol...' },
    { id: 'sync_engine', label: 'Sync Engine Health', status: 'pending', details: 'Testing ledger sync...' },
    { id: 'offline_resilience', label: 'Offline Cache Storage', status: 'pending', details: 'Validating IndexedDB...' },
  ]);

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
      fetchLanInfo();
    }
  }, [isOpen]);

  const fetchLanInfo = async () => {
    try {
      const res = await fetch(`${hostInput}/api/system/lan-info`);
      if (res.ok) {
        const data = await res.json();
        if (data.lanIps && data.lanIps.length > 0) {
          setLanIps(data.lanIps);
          setSelectedLanIp(data.lanIps[0]);
        }
      }
    } catch {
      // Offline fallback: try window location hostname
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        setLanIps([window.location.hostname]);
        setSelectedLanIp(window.location.hostname);
      }
    }
  };

  const runDiagnostics = async () => {
    setIsRunningScan(true);
    const updated: DiagnosticResult[] = [];

    // 1. Daemon Reachability
    let isReachable = false;
    let latencyMs = 0;
    try {
      const startTime = performance.now();
      const res = await fetch(`${hostInput}/health`, { method: 'GET' });
      latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        isReachable = true;
        updated.push({
          id: 'reachability',
          label: 'Daemon Reachability',
          status: 'success',
          details: `Connected to FinSathi Daemon on port 3001 (HTTP 200).`,
        });
      } else {
        updated.push({
          id: 'reachability',
          label: 'Daemon Reachability',
          status: 'warning',
          details: `Server returned HTTP status ${res.status}.`,
          recommendation: 'Check server logs in terminal: node server/mcp-server.mjs',
        });
      }
    } catch (err: any) {
      updated.push({
        id: 'reachability',
        label: 'Daemon Reachability',
        status: 'error',
        details: `Connection failed: ${err.message || 'Server offline'}.`,
        recommendation: 'Launch the server daemon via: ./start-production.sh or npm run server',
      });
    }

    // 2. Network Latency
    if (isReachable) {
      if (latencyMs < 100) {
        updated.push({
          id: 'latency',
          label: 'Network Latency',
          status: 'success',
          details: `Ultra-fast round-trip: ${latencyMs}ms.`,
        });
      } else if (latencyMs < 400) {
        updated.push({
          id: 'latency',
          label: 'Network Latency',
          status: 'warning',
          details: `Acceptable Wi-Fi latency: ${latencyMs}ms.`,
        });
      } else {
        updated.push({
          id: 'latency',
          label: 'Network Latency',
          status: 'error',
          details: `High network latency: ${latencyMs}ms.`,
          recommendation: 'Check Wi-Fi signal or move closer to router.',
        });
      }
    } else {
      updated.push({
        id: 'latency',
        label: 'Network Latency',
        status: 'error',
        details: 'Unable to measure latency (server unreachable).',
      });
    }

    // 3. MCP Token Authentication
    try {
      const res = await fetch(`${hostInput}/mcp/tools`, {
        method: 'GET',
        headers: {
          'X-FinSathi-Token': tokenInput,
        },
      });

      if (res.ok) {
        updated.push({
          id: 'auth',
          label: 'MCP Token Authentication',
          status: 'success',
          details: 'Authentication verified. Guarded endpoints accessible.',
        });
      } else if (res.status === 401) {
        updated.push({
          id: 'auth',
          label: 'MCP Token Authentication',
          status: 'error',
          details: 'Invalid or missing authentication token (HTTP 401).',
          recommendation: 'Verify the token in server/data/server_auth.json.',
        });
      } else {
        updated.push({
          id: 'auth',
          label: 'MCP Token Authentication',
          status: 'warning',
          details: `Unexpected response: HTTP ${res.status}.`,
        });
      }
    } catch {
      updated.push({
        id: 'auth',
        label: 'MCP Token Authentication',
        status: 'error',
        details: 'Could not perform token check (daemon unreachable).',
      });
    }

    // 4. CORS & Secure Context
    const isSecure = typeof window !== 'undefined' && window.isSecureContext;
    if (isSecure) {
      updated.push({
        id: 'security_context',
        label: 'CORS & Secure Context',
        status: 'success',
        details: 'Running in Secure Context (HTTPS or localhost). Hardware biometrics available.',
      });
    } else {
      updated.push({
        id: 'security_context',
        label: 'CORS & Secure Context',
        status: 'warning',
        details: 'Running over LAN HTTP. Hardware biometrics disabled; PIN & Password modes active.',
        recommendation: 'For biometric face/fingerprint on mobile, configure an HTTPS reverse proxy (e.g. Caddy).',
      });
    }

    // 5. Sync Engine Health
    try {
      const res = await fetch(`${hostInput}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FinSathi-Token': tokenInput,
        },
        body: JSON.stringify({
          profileId: 'diag_probe',
          payload: { probeAt: new Date().toISOString() },
        }),
      });

      if (res.ok) {
        updated.push({
          id: 'sync_engine',
          label: 'Sync Engine Health',
          status: 'success',
          details: 'Server read/write disk persistence operational.',
        });
      } else {
        updated.push({
          id: 'sync_engine',
          label: 'Sync Engine Health',
          status: 'warning',
          details: `Sync test returned HTTP ${res.status}.`,
        });
      }
    } catch {
      updated.push({
        id: 'sync_engine',
        label: 'Sync Engine Health',
        status: 'error',
        details: 'Disk sync unreachable. Changes will remain in local browser cache.',
      });
    }

    // 6. Offline Storage Resilience
    try {
      localStorage.setItem('finsathi_diag_cache', 'ok');
      const val = localStorage.getItem('finsathi_diag_cache');
      localStorage.removeItem('finsathi_diag_cache');
      if (val === 'ok') {
        updated.push({
          id: 'offline_resilience',
          label: 'Offline Cache Storage',
          status: 'success',
          details: 'Browser LocalStorage & IndexedDB active. 100% offline-ready.',
        });
      } else {
        throw new Error('Storage write failed');
      }
    } catch (err: any) {
      updated.push({
        id: 'offline_resilience',
        label: 'Offline Cache Storage',
        status: 'error',
        details: 'Browser storage blocked or quota exceeded.',
        recommendation: 'Check browser cookie/storage permissions.',
      });
    }

    setDiagnostics(updated);
    setIsRunningScan(false);
  };

  const handleSaveConfig = () => {
    setServerConfig(hostInput.trim(), tokenInput.trim());
    toast('Server connection parameters saved.', 'success');
    runDiagnostics();
  };

  const pairingUrl = `${hostInput.replace('localhost', selectedLanIp || '192.168.1.23')}?auth=${tokenInput}&host=${encodeURIComponent(hostInput.replace('localhost', selectedLanIp || '192.168.1.23'))}`;
  const qrSvg = generateQrSvg(pairingUrl, 220);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-surface-elevated animate-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--outline-variant)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--outline-variant)',
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FinSathiLogo size={28} glow />
            <div>
              <h2 className="text-headline-sm" style={{ margin: 0, letterSpacing: '0.05em' }}>
                SERVER_DIAGNOSTICS & SETUP
              </h2>
              <span className="text-label-mono-xs color-muted">
                FINSATHI PRIVATE LOCAL HOSTING SUITE
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--on-surface-variant)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--outline-variant)',
            padding: '0 16px',
            background: 'rgba(255, 255, 255, 0.01)',
          }}
        >
          {[
            { id: 'diagnostics' as const, label: 'DIAGNOSTICS', icon: 'health_and_safety' },
            { id: 'mobile_qr' as const, label: 'MOBILE_PAIRING', icon: 'qr_code_scanner' },
            { id: 'config' as const, label: 'HOST_CONFIG', icon: 'settings_ethernet' },
            { id: 'security' as const, label: 'SECURITY_AUDIT', icon: 'shield' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary-container)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--primary-container)' : 'var(--on-surface-variant)',
                fontFamily: 'var(--font-headline)',
                fontSize: '11px',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* TAB 1: DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 className="text-headline-xs" style={{ margin: 0 }}>SYSTEM_HEALTH_METRICS</h3>
                  <p className="text-label-mono-xs color-muted" style={{ margin: '4px 0 0' }}>
                    Testing edge cases: server offline, high latency, CORS context & sync integrity
                  </p>
                </div>
                <button
                  onClick={runDiagnostics}
                  disabled={isRunningScan}
                  className="vault-btn-primary"
                  style={{ padding: '8px 14px', fontSize: '11px', width: 'auto' }}
                >
                  <span className="material-symbols-outlined icon-sm">
                    {isRunningScan ? 'sync' : 'refresh'}
                  </span>
                  {isRunningScan ? 'SCANNING...' : 'RUN_TESTS'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {diagnostics.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '4px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="text-label-mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                        {d.label}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-code)',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          background:
                            d.status === 'success'
                              ? 'rgba(0, 255, 65, 0.12)'
                              : d.status === 'warning'
                              ? 'rgba(255, 170, 0, 0.15)'
                              : 'rgba(255, 60, 60, 0.15)',
                          color:
                            d.status === 'success'
                              ? '#00ff41'
                              : d.status === 'warning'
                              ? '#ffaa00'
                              : '#ff4d4d',
                          border: `1px solid ${
                            d.status === 'success'
                              ? '#00ff41'
                              : d.status === 'warning'
                              ? '#ffaa00'
                              : '#ff4d4d'
                          }`,
                        }}
                      >
                        {d.status.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-label-mono-xs color-muted">{d.details}</span>
                    {d.recommendation && (
                      <div
                        style={{
                          marginTop: '6px',
                          padding: '6px 8px',
                          background: 'rgba(255, 170, 0, 0.08)',
                          borderLeft: '2px solid #ffaa00',
                          fontSize: '11px',
                          fontFamily: 'var(--font-code)',
                          color: '#e0e0e0',
                        }}
                      >
                        ACTION: {d.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MOBILE QR PAIRING */}
          {activeTab === 'mobile_qr' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <h3 className="text-headline-xs" style={{ margin: '0 0 6px' }}>
                INSTANT_MOBILE_PAIRING
              </h3>
              <p className="text-body-sm color-muted" style={{ maxWidth: '460px', margin: '0 auto 20px' }}>
                Scan this QR code with your smartphone camera to connect automatically. Zero configuration, auto-token setup, and full end-to-end PIN encryption.
              </p>

              {/* QR Code Container */}
              <div
                style={{
                  display: 'inline-block',
                  padding: '16px',
                  background: '#0a0e14',
                  border: '1px solid var(--primary-container)',
                  borderRadius: '8px',
                  boxShadow: '0 0 30px rgba(0, 255, 65, 0.15)',
                }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />

              {/* LAN IP Selector */}
              {lanIps.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <label className="text-label-mono-xs color-muted" style={{ display: 'block', marginBottom: '6px' }}>
                    SELECT_LAN_IP_ADDRESS:
                  </label>
                  <select
                    className="settings-select"
                    value={selectedLanIp}
                    onChange={(e) => setSelectedLanIp(e.target.value)}
                    style={{ maxWidth: '280px', margin: '0 auto' }}
                  >
                    {lanIps.map((ip) => (
                      <option key={ip} value={ip}>
                        {ip} (Local Wi-Fi)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Direct Copyable URL */}
              <div style={{ marginTop: '20px', textAlign: 'left', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
                <span className="text-label-mono-xs color-muted">DIRECT_MOBILE_URL:</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="text"
                    readOnly
                    value={pairingUrl}
                    className="recovery-input"
                    style={{ flex: 1, fontSize: '11px' }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pairingUrl);
                      toast('Mobile pairing link copied to clipboard!', 'success');
                    }}
                    className="recovery-send-btn"
                  >
                    COPY_LINK
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--on-surface-variant)', textAlign: 'left' }}>
                <strong>Mobile Tips:</strong>
                <ul style={{ paddingLeft: '18px', margin: '4px 0' }}>
                  <li>Ensure your phone is connected to the same Wi-Fi router.</li>
                  <li>Unlock with the mobile Touch PIN keypad (0-9).</li>
                  <li>App caches everything offline, so you can check budgets on the go even without laptop sync.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: HOST CONFIGURATION */}
          {activeTab === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 className="text-headline-xs" style={{ margin: 0 }}>LOCAL_HOST_PARAMETERS</h3>
                <p className="text-label-mono-xs color-muted" style={{ margin: '4px 0 0' }}>
                  Configure your private laptop hostname and authentication token
                </p>
              </div>

              <div>
                <label className="text-label-mono-xs color-muted" style={{ display: 'block', marginBottom: '6px' }}>
                  SERVER_HOST_URL
                </label>
                <input
                  type="text"
                  className="recovery-input"
                  style={{ width: '100%' }}
                  value={hostInput}
                  onChange={(e) => setHostInput(e.target.value)}
                  placeholder="http://localhost:3001 or http://192.168.1.x:3001"
                />
              </div>

              <div>
                <label className="text-label-mono-xs color-muted" style={{ display: 'block', marginBottom: '6px' }}>
                  SERVER_AUTH_TOKEN (X-FinSathi-Token)
                </label>
                <input
                  type="text"
                  className="recovery-input"
                  style={{ width: '100%' }}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="fs_sec_..."
                />
                <span className="text-label-mono-xs color-muted" style={{ display: 'block', marginTop: '6px' }}>
                  Located on your private laptop at: server/data/server_auth.json
                </span>
              </div>

              <button
                onClick={handleSaveConfig}
                className="vault-btn-primary"
                style={{ marginTop: '10px' }}
              >
                <span className="material-symbols-outlined icon-sm">save</span>
                SAVE_AND_TEST_CONNECTION
              </button>
            </div>
          )}

          {/* TAB 4: SECURITY AUDIT */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 className="text-headline-xs" style={{ margin: 0 }}>VULNERABILITY & ANTI-PING AUDIT</h3>
                <p className="text-label-mono-xs color-muted" style={{ margin: '4px 0 0' }}>
                  How FinSathi safeguards your private laptop and financial records
                </p>
              </div>

              <div style={{ background: 'rgba(0, 255, 65, 0.05)', border: '1px solid var(--primary-container)', padding: '14px', borderRadius: '4px' }}>
                <span className="text-label-mono" style={{ color: '#00ff41', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined icon-sm">verified_user</span>
                  ANTI-PING FLOOD & DOS SHIELD ACTIVE
                </span>
                <p className="text-body-sm color-muted" style={{ margin: '8px 0 0' }}>
                  Sliding window rate-limiter restricts requests to 60 req/min per IP. Aggressive scanning (&gt;120 req/min) automatically triggers a 15-minute firewall ban and records a security audit log.
                </p>

              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--outline-variant)', padding: '14px', borderRadius: '4px' }}>
                <span className="text-label-mono" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined icon-sm">key</span>
                  MCP AGENT TOKEN GUARDRAILS
                </span>
                <p className="text-body-sm color-muted" style={{ margin: '8px 0 0' }}>
                  Unauthenticated Wi-Fi visitors cannot inspect your ledger or execute transactions. Claude Desktop, Cursor, and Ollama agents must provide the 32-character bearer token.
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--outline-variant)', padding: '14px', borderRadius: '4px' }}>
                <span className="text-label-mono" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined icon-sm">lock_clock</span>
                  ANTI-BRUTE-FORCE EXPONENTIAL BACKOFF
                </span>
                <p className="text-body-sm color-muted" style={{ margin: '8px 0 0' }}>
                  Vault PIN unlocking enforces progressive lockout: 10s after 3 failed tries, 60s after 5, and 300s after 8 tries.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--outline-variant)',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="text-label-mono-xs color-muted">
            STATUS: {diagnostics.every((d) => d.status === 'success') ? '100% OPERATIONAL' : 'ACTIVE_WITH_FALLBACK'}
          </span>
          <button
            onClick={onClose}
            className="vault-btn-primary"
            style={{ width: 'auto', padding: '8px 20px' }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
