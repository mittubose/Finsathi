import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandStore } from './useCommandStore';
import { useAppStore } from './useAppStore';

/**
 * Global keyboard shortcuts for FinSathi.
 * Mount once in the App layout.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const togglePrivacy = useAppStore(s => s.togglePrivacyMode);
  const lockVault = useAppStore(s => s.lockVault);
  const toggleCommand = useCommandStore(s => s.toggle);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire in input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.metaKey || e.ctrlKey;

      // Navigation shortcuts (no modifier needed)
      if (!mod && !e.altKey) {
        switch (e.key) {
          case '1': navigate('/'); return;
          case '2': navigate('/ledger'); return;
          case '3': navigate('/tax'); return;
          case '4': navigate('/trades'); return;
          case '5': navigate('/reminders'); return;
          case '6': navigate('/imports'); return;
          case '7': navigate('/reports'); return;
          case '8': navigate('/assistant'); return;
          case '/':
            e.preventDefault();
            toggleCommand();
            return;
          case '?':
            e.preventDefault();
            navigate('/settings?tab=shortcuts');
            return;
        }
      }

      // Cmd/Ctrl shortcuts
      if (mod) {
        switch (e.key) {
          case 'k':
          case 'K':
            e.preventDefault();
            toggleCommand();
            return;
          case 'j':
          case 'J':
            e.preventDefault();
            navigate('/assistant');
            return;
          case ',':
            e.preventDefault();
            navigate('/settings');
            return;
          case 'h':
          case 'H':
            e.preventDefault();
            togglePrivacy();
            return;
          case 'l':
          case 'L':
            e.preventDefault();
            lockVault();
            return;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);
}
