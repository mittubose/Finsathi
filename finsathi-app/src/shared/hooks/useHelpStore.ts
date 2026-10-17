import { create } from 'zustand';

interface HelpState {
  isOpen: boolean;
  activeTerm: string | null;
  openHelp: (term?: string) => void;
  closeHelp: () => void;
}

export const useHelpStore = create<HelpState>((set) => ({
  isOpen: false,
  activeTerm: null,
  openHelp: (term) => set({ isOpen: true, activeTerm: term || null }),
  closeHelp: () => set({ isOpen: false, activeTerm: null }),
}));
