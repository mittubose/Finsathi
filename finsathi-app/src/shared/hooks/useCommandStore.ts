import { create } from 'zustand';

interface CommandState {
  isOpen: boolean;
  isMobileDrawerOpen: boolean;
  isServerWizardOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  openMobileDrawer: () => void;
  closeMobileDrawer: () => void;
  toggleMobileDrawer: () => void;
  openServerWizard: () => void;
  closeServerWizard: () => void;
  toggleServerWizard: () => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  isOpen: false,
  isMobileDrawerOpen: false,
  isServerWizardOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  openMobileDrawer: () => set({ isMobileDrawerOpen: true }),
  closeMobileDrawer: () => set({ isMobileDrawerOpen: false }),
  toggleMobileDrawer: () => set((s) => ({ isMobileDrawerOpen: !s.isMobileDrawerOpen })),
  openServerWizard: () => set({ isServerWizardOpen: true }),
  closeServerWizard: () => set({ isServerWizardOpen: false }),
  toggleServerWizard: () => set((s) => ({ isServerWizardOpen: !s.isServerWizardOpen })),
}));

