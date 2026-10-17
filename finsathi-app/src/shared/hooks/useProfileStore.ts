import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveProfileSnapshot, loadProfileSnapshot, clearProfileStorage } from '../lib/profileDataManager';

export type UserRole = 'admin' | 'individual';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  pan?: string;
  email?: string;
  tag: string;
  isMasterAdmin?: boolean;
  createdAt: string;
  hasCompletedOnboarding?: boolean;
  persona?: string;
  lastSeenVersion?: string;
}

interface ProfileState {
  profiles: UserProfile[];
  activeProfileId: string;
  
  // Actions
  getActiveProfile: () => UserProfile;
  setActiveProfile: (id: string) => void;
  addProfile: (profile: Omit<UserProfile, 'id' | 'createdAt'>) => string;
  updateProfile: (id: string, updates: Partial<UserProfile>) => void;
  deleteProfile: (id: string) => boolean;
  isAdmin: () => boolean;
  completeOnboarding: (profileId: string, persona: string) => void;
  markVersionSeen: (profileId: string, version: string) => void;
  resetOnboarding: (profileId: string) => void;
}

const DEFAULT_PROFILES: UserProfile[] = [
  {
    id: 'prof_admin_master',
    name: 'Master Admin',
    role: 'admin',
    tag: 'SYS_ADMIN',
    isMasterAdmin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prof_user_primary',
    name: 'Self (Primary)',
    role: 'individual',
    tag: 'INDIVIDUAL',
    createdAt: new Date().toISOString(),
  },
];

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: DEFAULT_PROFILES,
      activeProfileId: 'prof_admin_master',

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get();
        const found = profiles.find((p) => p.id === activeProfileId);
        return found || profiles[0] || DEFAULT_PROFILES[0];
      },

      setActiveProfile: (id: string) => {
        const { profiles, activeProfileId } = get();
        if (activeProfileId === id) return;
        if (profiles.some((p) => p.id === id)) {
          // 1. Save data snapshot for previous profile
          saveProfileSnapshot(activeProfileId);
          // 2. Switch active profile ID
          set({ activeProfileId: id });
          // 3. Load isolated data snapshot for newly activated profile
          loadProfileSnapshot(id);
        }
      },

      addProfile: (newProf) => {
        const id = `prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const profile: UserProfile = {
          ...newProf,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ profiles: [...state.profiles, profile] }));
        return id;
      },

      updateProfile: (id, updates) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      deleteProfile: (id) => {
        const { profiles, activeProfileId } = get();
        const target = profiles.find((p) => p.id === id);
        if (!target || target.isMasterAdmin) return false; // Prevent deleting master admin

        // Clear isolated data storage for deleted profile
        clearProfileStorage(id);

        const updated = profiles.filter((p) => p.id !== id);
        let nextActive = activeProfileId;
        if (activeProfileId === id) {
          nextActive = updated[0]?.id || 'prof_admin_master';
          loadProfileSnapshot(nextActive);
        }

        set({ profiles: updated, activeProfileId: nextActive });
        return true;
      },


      isAdmin: () => {
        const current = get().getActiveProfile();
        return current.role === 'admin';
      },

      completeOnboarding: (profileId, persona) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId
              ? { ...p, hasCompletedOnboarding: true, persona, lastSeenVersion: '2.1.0' }
              : p
          ),
        }));
      },

      markVersionSeen: (profileId, version) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId ? { ...p, lastSeenVersion: version } : p
          ),
        }));
      },

      resetOnboarding: (profileId) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId ? { ...p, hasCompletedOnboarding: false } : p
          ),
        }));
      },
    }),
    {
      name: 'finsathi-profiles-store',
    }
  )
);
