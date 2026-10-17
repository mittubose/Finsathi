import { useState, useEffect } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { useProfileStore } from '../../shared/hooks/useProfileStore';
import { getCurrentFY, getFYRange } from '../../shared/lib/dates';
import { generateRecoveryKey, sha256 } from '../../shared/lib/security';
import { useToast } from '../../shared/ui/Toast';
import { FinSathiLogo } from '../../shared/ui/FinSathiLogo';
import { useNavigate } from 'react-router-dom';
import './Onboarding.css';

type ProfileType = 'salary' | 'trading' | 'both';

const STEPS = ['IDENTITY', 'VAULT_PIN', 'RECOVERY_KEY', 'REGIME', 'LAUNCH'];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    setFY, setRegime, setVaultActive, setVaultPassword, registerBiometrics,
    setRecoveryKeyHash, setRecoveryEmail
  } = useAppStore();
  const { updateProfile } = useProfileStore();

  const [step, setStep] = useState(0);
  const [adminName, setAdminName] = useState('Master Admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [profileType, setProfileType] = useState<ProfileType>('both');
  const [fy, setFYLocal] = useState(getCurrentFY());
  const [regime, setRegimeLocal] = useState<'old' | 'new' | 'compare'>('compare');
  
  // Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inputMode, setInputMode] = useState<'pin' | 'password'>('pin');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [hasConfirmedRecovery, setHasConfirmedRecovery] = useState(false);
  const [biometricIdLocal, setBiometricIdLocal] = useState<string | null>(null);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  useEffect(() => {
    // Generate high-entropy master recovery key on mount
    setRecoveryKey(generateRecoveryKey());

    // Check secure context for biometrics
    if (typeof window !== 'undefined' && window.isSecureContext && window.PublicKeyCredential) {
      try {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          .then(setIsBiometricSupported)
          .catch(() => setIsBiometricSupported(false));
      } catch {
        setIsBiometricSupported(false);
      }
    }
  }, []);

  const goNext = () => {
    if (step === 0) {
      if (!adminName.trim()) {
        toast('Please enter an Admin profile name', 'error');
        return;
      }
      if (!adminEmail.trim() || !adminEmail.includes('@')) {
        toast('Please enter a valid recovery email', 'error');
        return;
      }
    }

    if (step === 1) {
      if (!password || password.length < 4) {
        toast('Master PIN or Password must be at least 4 characters', 'error');
        return;
      }
      if (password !== confirmPassword) {
        toast('Passwords do not match', 'error');
        return;
      }
    }

    if (step === 2) {
      if (!hasConfirmedRecovery) {
        toast('Please record your Recovery Key and check the confirmation box', 'error');
        return;
      }
    }

    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleRegisterBiometrics = async () => {
    if (!window.isSecureContext || !window.PublicKeyCredential) {
      toast('Biometrics require HTTPS. PIN/Password will be used.', 'info');
      return;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'FinSathi' },
          user: {
            id: new Uint8Array(16),
            name: adminEmail || 'admin@finsathi.local',
            displayName: adminName || 'Master Admin'
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
        setBiometricIdLocal(id);
        toast('Biometrics registered successfully!', 'success');
      }
    } catch (err: any) {
      console.warn(err);
      toast('Biometric setup cancelled or unsupported in this browser.', 'info');
    }
  };

  const handleLaunch = async () => {
    setFY(fy);
    setRegime(regime);
    
    // Save Admin Profile
    updateProfile('prof_admin_master', {
      name: adminName.trim(),
      email: adminEmail.trim(),
    });

    // Save Security
    setVaultPassword(password);
    setVaultActive(true);
    setRecoveryEmail(adminEmail.trim());

    // Save hashed recovery key
    const cleanKey = recoveryKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hash = await sha256(cleanKey);
    setRecoveryKeyHash(hash);

    if (biometricIdLocal) {
      registerBiometrics(biometricIdLocal);
    }

    localStorage.setItem('finsathi-onboarded', '1');
    toast('Master Admin credentials configured and verified.', 'success');
    onComplete();
    navigate('/');
  };

  return (
    <div className="onboarding">
      <div className="onboarding-bg" />

      <div className="onboarding-card">
        {/* Progress */}
        <div className="onboarding-progress">
          {STEPS.map((s, i) => (
            <div key={s} className={`onboarding-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <div className="onboarding-step-dot" />
              <span className="onboarding-step-label">{s}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="onboarding-body">
          {/* STEP 0: IDENTITY & EMAIL */}
          {step === 0 && (
            <div className="onboarding-step-content animate-in">
              <div className="onboarding-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <FinSathiLogo size={32} glow />
                <span>FINSATHI</span>
              </div>
              <h1 className="text-headline-md onboarding-title">MASTER_ADMIN_SETUP</h1>
              <p className="text-body color-muted onboarding-desc">
                FinSathi runs locally on your private machine. Establish your Master Admin identity and emergency recovery email.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '380px', margin: '0 auto 20px', textAlign: 'left' }}>
                <div>
                  <label className="text-label-mono-sm color-muted">ADMIN_NAME</label>
                  <input
                    type="text"
                    className="onboarding-input"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Master Admin"
                  />
                </div>
                <div>
                  <label className="text-label-mono-sm color-muted">RECOVERY_EMAIL (FOR_OTP_RECOVERY)</label>
                  <input
                    type="email"
                    className="onboarding-input"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                  />
                  <span className="text-label-mono-xs color-muted" style={{ display: 'block', marginTop: '4px' }}>
                    Used for zero-cloud OTP identity confirmation if you forget your password.
                  </span>
                </div>
              </div>

              <div className="onboarding-profile-grid">
                {([
                  { type: 'salary' as ProfileType, icon: 'work', label: 'SALARIED', sub: 'Track salary, TDS, deductions' },
                  { type: 'trading' as ProfileType, icon: 'query_stats', label: 'TRADER', sub: 'STCG/LTCG, P&L, capital gains' },
                  { type: 'both' as ProfileType, icon: 'account_balance', label: 'HYBRID', sub: 'Full financial operating system' },
                ] as const).map((p) => (
                  <button
                    key={p.type}
                    type="button"
                    className={`onboarding-profile-card ${profileType === p.type ? 'active' : ''}`}
                    onClick={() => setProfileType(p.type)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>
                      {p.icon}
                    </span>
                    <span className="text-label-mono" style={{ fontSize: '11px', marginTop: '6px' }}>{p.label}</span>
                    <span className="text-label-mono-sm color-muted">{p.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: VAULT PIN / PASSWORD */}
          {step === 1 && (
            <div className="onboarding-step-content animate-in">
              <h2 className="text-headline-md onboarding-title">SET_MASTER_ACCESS_VAULT</h2>
              <p className="text-body color-muted onboarding-desc">
                Locks sensitive ledgers, tax filings, and trade records with 256-bit client-side hashing.
              </p>

              <div className="vault-mode-toggle" style={{ maxWidth: '340px', margin: '0 auto 16px' }}>
                <button
                  type="button"
                  className={`vault-mode-btn ${inputMode === 'pin' ? 'active' : ''}`}
                  onClick={() => setInputMode('pin')}
                >
                  <span className="material-symbols-outlined icon-sm">dialpad</span>
                  NUMERIC_PIN (RECOMMENDED FOR MOBILE)
                </button>
                <button
                  type="button"
                  className={`vault-mode-btn ${inputMode === 'password' ? 'active' : ''}`}
                  onClick={() => setInputMode('password')}
                >
                  <span className="material-symbols-outlined icon-sm">password</span>
                  PASSWORD
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '340px', margin: '0 auto', textAlign: 'left' }}>
                <div>
                  <label className="text-label-mono-sm color-muted">ENTER_CREDENTIALS</label>
                  <input
                    type="password"
                    className="onboarding-input"
                    inputMode={inputMode === 'pin' ? 'numeric' : 'text'}
                    placeholder={inputMode === 'pin' ? '• • • •' : 'Enter password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-label-mono-sm color-muted">CONFIRM_CREDENTIALS</label>
                  <input
                    type="password"
                    className="onboarding-input"
                    inputMode={inputMode === 'pin' ? 'numeric' : 'text'}
                    placeholder={inputMode === 'pin' ? '• • • •' : 'Confirm password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {isBiometricSupported && (
                  <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--outline-variant)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span className="text-label-mono" style={{ fontSize: '11px' }}>BIOMETRIC_SENSOR</span>
                        <p className="text-label-mono-xs color-muted">Touch ID or Face Unlock</p>
                      </div>
                      <button
                        type="button"
                        className={`onboarding-biometric-btn ${biometricIdLocal ? 'active' : ''}`}
                        onClick={handleRegisterBiometrics}
                      >
                        <span className="material-symbols-outlined">{biometricIdLocal ? 'check_circle' : 'fingerprint'}</span>
                        {biometricIdLocal ? 'LINKED' : 'ENABLE'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: MASTER RECOVERY KEY */}
          {step === 2 && (
            <div className="onboarding-step-content animate-in">
              <h2 className="text-headline-md onboarding-title">YOUR_MASTER_RECOVERY_KEY</h2>
              <p className="text-body color-muted onboarding-desc">
                If you ever forget your password or PIN, this cryptographic key restores complete access without losing any financial transactions.
              </p>

              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  border: '1px dashed var(--primary-container)',
                  borderRadius: '6px',
                  padding: '18px',
                  maxWidth: '440px',
                  margin: '0 auto 16px',
                  textAlign: 'center',
                }}
              >
                <span className="text-label-mono-xs color-muted">CRYPTOGRAPHIC_MASTER_KEY</span>
                <div
                  style={{
                    fontFamily: 'var(--font-code, monospace)',
                    fontSize: '20px',
                    letterSpacing: '0.12em',
                    color: '#00ff41',
                    fontWeight: 700,
                    margin: '10px 0',
                    userSelect: 'all',
                  }}
                >
                  {recoveryKey}
                </div>
                <button
                  type="button"
                  className="recovery-send-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(recoveryKey);
                    toast('Master Recovery Key copied to clipboard!', 'success');
                  }}
                  style={{ padding: '6px 14px' }}
                >
                  <span className="material-symbols-outlined icon-xs">content_copy</span>
                  COPY_KEY
                </button>
              </div>

              <div style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'left' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid var(--outline-variant)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hasConfirmedRecovery}
                    onChange={(e) => setHasConfirmedRecovery(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <span className="text-label-mono-xs color-muted" style={{ lineHeight: 1.4 }}>
                    I have saved this Master Recovery Key in a secure password manager. I acknowledge that FinSathi uses zero cloud servers, so this key cannot be retrieved by anyone else.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: FISCAL YEAR & REGIME */}
          {step === 3 && (
            <div className="onboarding-step-content animate-in">
              <h2 className="text-headline-md onboarding-title">SELECT_FISCAL_YEAR & REGIME</h2>
              <p className="text-body color-muted onboarding-desc">
                Indian Financial Year runs April 1 to March 31.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <select
                  className="settings-select"
                  value={fy}
                  onChange={(e) => setFYLocal(e.target.value)}
                  style={{ width: '240px', fontSize: '13px' }}
                >
                  {['2025-26', '2024-25', '2023-24'].map((y) => (
                    <option key={y} value={y}>
                      FY {y}
                    </option>
                  ))}

                </select>
              </div>

              <div className="onboarding-regime-grid">
                {[
                  { id: 'compare' as const, label: 'COMPARE_BOTH', desc: 'Recommended: evaluate Old vs New side-by-side' },
                  { id: 'new' as const, label: 'NEW_REGIME_115BAC', desc: 'Lower tax rates, zero itemized exemptions' },
                  { id: 'old' as const, label: 'OLD_REGIME', desc: 'Full 80C, 80D, HRA, & 24(b) home loan deductions' },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`onboarding-profile-card ${regime === r.id ? 'active' : ''}`}
                    onClick={() => setRegimeLocal(r.id)}
                    style={{ textAlign: 'left', padding: '12px' }}
                  >
                    <span className="text-label-mono" style={{ fontSize: '11px' }}>{r.label}</span>
                    <span className="text-label-mono-xs color-muted" style={{ marginTop: '4px' }}>{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: LAUNCH */}
          {step === 4 && (
            <div className="onboarding-step-content onboarding-launch animate-in">
              <div className="onboarding-logo onboarding-logo--lg">FS</div>
              <h2 className="text-headline-lg onboarding-title" style={{ marginTop: '16px' }}>SYSTEM_ARMED_AND_READY</h2>
              
              <div className="onboarding-summary" style={{ maxWidth: '380px', margin: '0 auto' }}>
                <div className="onboarding-summary-row">
                  <span className="text-label-mono-sm color-muted">ADMIN_NAME</span>
                  <span className="text-label-mono color-positive">{adminName}</span>
                </div>
                <div className="onboarding-summary-row">
                  <span className="text-label-mono-sm color-muted">RECOVERY_EMAIL</span>
                  <span className="text-label-mono color-positive">{adminEmail}</span>
                </div>
                <div className="onboarding-summary-row">
                  <span className="text-label-mono-sm color-muted">SECURITY</span>
                  <span className="text-label-mono color-positive">256-BIT ENCRYPTED</span>
                </div>
                <div className="onboarding-summary-row">
                  <span className="text-label-mono-sm color-muted">ANTI_PING_SHIELD</span>
                  <span className="text-label-mono color-positive">ACTIVE (60 REQ/M)</span>
                </div>
              </div>

              <p className="text-body color-muted" style={{ marginTop: '16px', fontSize: '12px', textAlign: 'center' }}>
                Ready to manage your personal wealth, trade taxes, and salary slips with zero cloud surveillance.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="onboarding-footer">
          {step > 0 && (
            <button className="onboarding-back-btn" onClick={goBack}>
              ← BACK
            </button>
          )}
          <div className="onboarding-footer-right">
            {step < STEPS.length - 1 ? (
              <button className="onboarding-next-btn" onClick={goNext}>
                NEXT →
              </button>
            ) : (
              <button className="onboarding-launch-btn" onClick={handleLaunch}>
                <span className="material-symbols-outlined icon-sm">rocket_launch</span>
                LAUNCH_FINSATHI
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
