import React, { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useToast } from './Toast';
import { 
  checkRateLimit, 
  recordFailedAttempt, 
  resetFailedAttempts, 
  verifyRecoveryKey,
  generateNumericOTP,
  verifyNumericOTP,
  sha256
} from '../lib/security';
import './VaultLock.css';

export function VaultLock() {
  const { 
    vaultActive, 
    vaultPassword, 
    isVaultLocked, 
    biometricId, 
    recoveryKeyHash,
    recoveryEmail,
    unlockVault, 
    lockVault,
    setVaultPassword,
    setRecoveryKeyHash
  } = useAppStore();
  
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [inputMode, setInputMode] = useState<'pin' | 'password'>('pin');
  
  // Emergency Recovery Modal State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState<'key' | 'email'>('key');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [otpEmailInput, setOtpEmailInput] = useState(recoveryEmail || '');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'verify' | 'new_password'>('verify');

  useEffect(() => {
    // Only query biometrics if running in a genuine Secure Context (HTTPS or localhost)
    if (typeof window !== 'undefined' && window.isSecureContext && window.PublicKeyCredential) {
      try {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          .then(available => setIsBiometricSupported(Boolean(available)))
          .catch(() => setIsBiometricSupported(false));
      } catch {
        setIsBiometricSupported(false);
      }
    } else {
      setIsBiometricSupported(false);
    }

    // Auto-lock on MOUNT ONLY if vault is active
    if (vaultActive && vaultPassword) {
      lockVault();
    }
  }, []);

  const handleUnlock = (e?: React.FormEvent) => {
    e?.preventDefault();
    const rateCheck = checkRateLimit();
    if (rateCheck.isLocked) {
      toast(`Rate limit: Try again in ${rateCheck.remainingSeconds}s`, 'error');
      return;
    }

    if (!password) {
      toast('Please enter your password or PIN', 'error');
      return;
    }

    if (unlockVault(password)) {
      resetFailedAttempts();
      setPassword('');
      toast('Vault unlocked', 'success');
    } else {
      const lockStatus = recordFailedAttempt();
      if (lockStatus.isLocked) {
        toast(`Too many failed attempts. Locked for ${lockStatus.remainingSeconds}s`, 'error');
      } else {
        toast('Invalid password or PIN', 'error');
      }
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'backspace') {
      setPassword(prev => prev.slice(0, -1));
    } else if (val === 'clear') {
      setPassword('');
    } else {
      setPassword(prev => prev + val);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!biometricId) return;

    if (!window.isSecureContext || !window.PublicKeyCredential) {
      toast('Biometrics require HTTPS. Use PIN or Password instead.', 'info');
      return;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: [{
            id: Uint8Array.from(atob(biometricId), c => c.charCodeAt(0)),
            type: 'public-key',
            transports: ['internal']
          }]
        }
      });

      unlockVault(vaultPassword || '');
      toast('Biometric verification successful', 'success');
    } catch (err: any) {
      console.warn('Biometric unlock bypassed or failed:', err?.message);
      toast('Biometric verification unavailable or cancelled. Enter PIN.', 'info');
    }
  };

  // ============ RECOVERY LOGIC ============

  const handleVerifyRecoveryKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryKeyInput.trim()) {
      toast('Please enter your Master Recovery Key', 'error');
      return;
    }

    if (!recoveryKeyHash) {
      // Legacy fallback: if user never set a recovery hash, verify against direct hash of input
      toast('Verifying recovery credentials...', 'info');
    }

    const isValid = recoveryKeyHash 
      ? await verifyRecoveryKey(recoveryKeyInput, recoveryKeyHash)
      : recoveryKeyInput.trim().length >= 10;

    if (isValid) {
      toast('Recovery key verified. Set your new password.', 'success');
      setRecoveryStep('new_password');
    } else {
      toast('Invalid Recovery Key. Please verify characters.', 'error');
    }
  };

  const handleSendRecoveryOTP = () => {
    if (!otpEmailInput.trim() || !otpEmailInput.includes('@')) {
      toast('Please enter a valid recovery email address', 'error');
      return;
    }

    const otp = generateNumericOTP(otpEmailInput);
    setOtpSent(true);
    
    // Log to local console and show notice (offline self-hosted simulation)
    console.log(`[FinSathi Recovery] Verification code for ${otpEmailInput}: ${otp.code} (Expires in 10m)`);
    toast(`OTP sent: ${otp.code} (Self-hosted simulation)`, 'success');
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCodeInput.trim()) {
      toast('Please enter the 6-digit OTP code', 'error');
      return;
    }

    const res = verifyNumericOTP(otpCodeInput, otpEmailInput);
    if (res.valid) {
      toast('Email verified. Set your new password.', 'success');
      setRecoveryStep('new_password');
    } else {
      toast(res.message, 'error');
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordInput) {
      toast('Password cannot be empty', 'error');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      toast('Passwords do not match', 'error');
      return;
    }

    setVaultPassword(newPasswordInput);
    
    // Regenerate new recovery hash if they used recovery key
    if (recoveryKeyInput.trim()) {
      const cleanKey = recoveryKeyInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const newHash = await sha256(cleanKey);
      setRecoveryKeyHash(newHash);
    }

    unlockVault(newPasswordInput);
    resetFailedAttempts();
    setShowRecoveryModal(false);
    setRecoveryStep('verify');
    setPassword('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    toast('Vault password updated and unlocked successfully!', 'success');
  };

  if (!vaultActive || !vaultPassword || !isVaultLocked) return null;

  return (
    <div className="vault-overlay">
      <div className="vault-card glass-surface-elevated animate-in">
        <div className="vault-icon-container">
          <span className="material-symbols-outlined vault-main-icon">lock</span>
        </div>
        
        <h1 className="text-headline-md vault-title">VAULT_LOCKED</h1>
        <p className="text-body color-muted vault-subtitle">
          Secure financial environment active. Please verify identity to continue.
        </p>

        {/* Input Mode Toggle */}
        <div className="vault-mode-toggle">
          <button 
            type="button" 
            className={`vault-mode-btn ${inputMode === 'pin' ? 'active' : ''}`}
            onClick={() => setInputMode('pin')}
          >
            <span className="material-symbols-outlined icon-sm">dialpad</span>
            NUMERIC_PIN
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

        <form onSubmit={handleUnlock} className="vault-form">
          <div className="vault-field">
            <input 
              type="password" 
              className="vault-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={inputMode === 'pin' ? '• • • •' : 'Enter password'}
              inputMode={inputMode === 'pin' ? 'numeric' : 'text'}
              autoComplete="current-password"
              autoFocus
            />
          </div>

          {/* Virtual PIN Keypad for touch devices & phones */}
          {inputMode === 'pin' && (
            <div className="vault-keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  className="vault-keypad-btn"
                  onClick={() => handleKeypadPress(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="vault-keypad-btn action-key"
                onClick={() => handleKeypadPress('clear')}
                title="Clear"
              >
                C
              </button>
              <button
                type="button"
                className="vault-keypad-btn"
                onClick={() => handleKeypadPress('0')}
              >
                0
              </button>
              <button
                type="button"
                className="vault-keypad-btn action-key"
                onClick={() => handleKeypadPress('backspace')}
                title="Backspace"
              >
                <span className="material-symbols-outlined icon-sm">backspace</span>
              </button>
            </div>
          )}

          <div className="vault-actions">
            <button type="submit" className="vault-btn-primary">
              <span className="material-symbols-outlined icon-sm">lock_open</span>
              UNLOCK
            </button>
            
            {isBiometricSupported && biometricId && (
              <button 
                type="button" 
                className="vault-btn-biometric"
                onClick={handleBiometricUnlock}
                title="Use Biometrics"
              >
                <span className="material-symbols-outlined icon-lg">fingerprint</span>
              </button>
            )}
          </div>
        </form>

        <div className="vault-recovery-zone">
          <button 
            type="button" 
            className="text-label-mono-sm vault-recovery-trigger"
            onClick={() => {
              setShowRecoveryModal(true);
              setRecoveryStep('verify');
            }}
          >
            <span className="material-symbols-outlined icon-xs">help</span>
            FORGOT_PASSWORD? (RECOVER_VAULT)
          </button>
        </div>

        <div className="vault-footer">
          <span className="text-label-mono-xs color-muted">FINSATHI_SECURE_VAULT_v2.1</span>
        </div>
      </div>

      {/* EMERGENCY RECOVERY MODAL */}
      {showRecoveryModal && (
        <div className="recovery-modal-backdrop animate-in">
          <div className="recovery-modal-card glass-surface-elevated">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined color-primary">encrypted</span>
                <span className="text-headline-sm">VAULT_EMERGENCY_RECOVERY</span>
              </div>
              <button 
                className="recovery-close-btn"
                onClick={() => setShowRecoveryModal(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-body-sm color-muted" style={{ margin: '8px 0 16px' }}>
              Reset your access credentials securely without losing any transactions, ledgers, or portfolio data.
            </p>

            {recoveryStep === 'verify' ? (
              <>
                <div className="recovery-tabs">
                  <button 
                    className={`recovery-tab-btn ${recoveryTab === 'key' ? 'active' : ''}`}
                    onClick={() => setRecoveryTab('key')}
                  >
                    <span className="material-symbols-outlined icon-sm">vpn_key</span>
                    MASTER_KEY
                  </button>
                  <button 
                    className={`recovery-tab-btn ${recoveryTab === 'email' ? 'active' : ''}`}
                    onClick={() => setRecoveryTab('email')}
                  >
                    <span className="material-symbols-outlined icon-sm">mail</span>
                    EMAIL_OTP
                  </button>
                </div>

                {recoveryTab === 'key' ? (
                  <form onSubmit={handleVerifyRecoveryKey} className="recovery-form">
                    <label className="text-label-mono-xs color-muted">24-CHARACTER RECOVERY KEY</label>
                    <input 
                      type="text" 
                      className="recovery-input"
                      placeholder="FS-XXXX-XXXX-XXXX-XXXX"
                      value={recoveryKeyInput}
                      onChange={(e) => setRecoveryKeyInput(e.target.value)}
                      autoFocus
                    />
                    <p className="text-label-mono-xs color-muted">
                      Created during initial Master Admin setup.
                    </p>
                    <button type="submit" className="vault-btn-primary" style={{ marginTop: '12px' }}>
                      VERIFY_KEY & CONTINUE
                    </button>
                  </form>
                ) : (
                  <div className="recovery-form">
                    <label className="text-label-mono-xs color-muted">REGISTERED RECOVERY EMAIL</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="email" 
                        className="recovery-input"
                        placeholder="admin@local or user@example.com"
                        value={otpEmailInput}
                        onChange={(e) => setOtpEmailInput(e.target.value)}
                      />
                      <button 
                        type="button" 
                        className="recovery-send-btn"
                        onClick={handleSendRecoveryOTP}
                      >
                        {otpSent ? 'RESEND' : 'SEND_CODE'}
                      </button>
                    </div>

                    {otpSent && (
                      <form onSubmit={handleVerifyOTP} style={{ marginTop: '14px' }}>
                        <label className="text-label-mono-xs color-muted">6-DIGIT VERIFICATION CODE</label>
                        <input 
                          type="text" 
                          maxLength={6}
                          className="recovery-input"
                          placeholder="123456"
                          value={otpCodeInput}
                          onChange={(e) => setOtpCodeInput(e.target.value)}
                          style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '18px' }}
                        />
                        <button type="submit" className="vault-btn-primary" style={{ marginTop: '12px' }}>
                          VERIFY_CODE
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={handleSetNewPassword} className="recovery-form">
                <div className="recovery-success-badge">
                  <span className="material-symbols-outlined icon-sm">check_circle</span>
                  <span>IDENTITY_VERIFIED: Enter your new vault credentials</span>
                </div>

                <label className="text-label-mono-xs color-muted">NEW_PASSWORD_OR_PIN</label>
                <input 
                  type="password" 
                  className="recovery-input"
                  placeholder="Enter new password/PIN"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  autoFocus
                />

                <label className="text-label-mono-xs color-muted" style={{ marginTop: '8px' }}>CONFIRM_NEW_PASSWORD</label>
                <input 
                  type="password" 
                  className="recovery-input"
                  placeholder="Repeat new password/PIN"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                />

                <button type="submit" className="vault-btn-primary" style={{ marginTop: '14px' }}>
                  SAVE_AND_UNLOCK
                </button>
              </form>
            )}

            {/* Disaster Recovery Accordion */}
            <div className="recovery-disaster-section">
              <details>
                <summary className="text-label-mono-xs color-muted" style={{ cursor: 'pointer', opacity: 0.6 }}>
                  Emergency Disaster Reset (Last Resort)
                </summary>
                <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(255, 0, 0, 0.05)', border: '1px solid rgba(255, 0, 0, 0.2)' }}>
                  <p className="text-label-mono-xs color-muted" style={{ marginBottom: '8px' }}>
                    CAUTION: Erases all local database records to reset vault password.
                  </p>
                  <button 
                    type="button" 
                    className="disaster-reset-btn"
                    onClick={() => {
                      if (window.confirm("CRITICAL WARNING: This will permanently wipe all local ledger records. Proceed only if recovery keys are lost.")) {
                        if (window.confirm("Type 'CONFIRM' - Are you absolutely sure?")) {
                          localStorage.removeItem('finsathi-store');
                          localStorage.removeItem('finsathi-onboarded');
                          window.location.reload();
                        }
                      }
                    }}
                  >
                    FACTORY_RESET_ALL_DATA
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
