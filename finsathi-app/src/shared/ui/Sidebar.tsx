import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useHelpStore } from '../hooks/useHelpStore';
import { useAppStore } from '../hooks/useAppStore';
import { useProfileStore } from '../hooks/useProfileStore';
import { useCommandStore } from '../hooks/useCommandStore';
import { getCurrentFY } from '../lib/dates';
import { APP_VERSION } from '../lib/versioning';
import { FinSathiLogo } from './FinSathiLogo';
import './Sidebar.css';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  filled?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    label: 'OVERVIEW',
    icon: 'space_dashboard',
    items: [
      { path: '/', label: 'Dashboard', icon: 'dashboard', filled: true },
      { path: '/assistant', label: 'Financial AI', icon: 'smart_toy', filled: true },
    ],
  },
  {
    id: 'ledger',
    label: 'LEDGER & DATA',
    icon: 'receipt_long',
    items: [
      { path: '/ledger', label: 'Ledger', icon: 'receipt_long' },
      { path: '/imports', label: 'Imports', icon: 'upload_file' },
      { path: '/imports/excel', label: 'Excel Import', icon: 'table_view' },
    ],
  },
  {
    id: 'reports',
    label: 'REPORTS & ANALYTICS',
    icon: 'insights',
    items: [
      { path: '/reports', label: 'Reports', icon: 'summarize' },
      { path: '/insights', label: 'Insights', icon: 'insights' },
      { path: '/fy-summary', label: 'FY Summary', icon: 'receipt' },
      { path: '/inflation', label: 'Inflation', icon: 'trending_up' },
      { path: '/financial-calc', label: 'Calculators', icon: 'calculate' },
    ],
  },
  {
    id: 'planning',
    label: 'PLANNING & WEALTH',
    icon: 'account_balance_wallet',
    items: [
      { path: '/family', label: 'Family Hub', icon: 'diversity_3' },
      { path: '/planning', label: 'Planning', icon: 'analytics' },
      { path: '/insurance', label: 'Insurance', icon: 'health_and_safety' },
    ],
  },
  {
    id: 'tax',
    label: 'TAX & TRADES',
    icon: 'account_balance',
    items: [
      { path: '/tax', label: 'Tax Engine', icon: 'account_balance' },
      { path: '/itr3', label: 'ITR-3 Wizard', icon: 'auto_awesome' },
      { path: '/itr3/s', label: 'Schedule S', icon: 'payments' },
      { path: '/itr3/hp', label: 'Schedule HP', icon: 'home' },
      { path: '/itr3/bp', label: 'Schedule BP', icon: 'business_center' },
      { path: '/itr3/cg', label: 'Schedule CG', icon: 'trending_up' },
      { path: '/itr3/os', label: 'Schedule OS', icon: 'account_balance' },
      { path: '/itr3/via', label: 'Schedule VI-A', icon: 'savings' },
      { path: '/advance-tax', label: 'Advance Tax', icon: 'event_upcoming' },
      { path: '/trades', label: 'Trades', icon: 'query_stats' },
      { path: '/loss-harvesting', label: 'Loss Harvest', icon: 'energy_savings_leaf' },
    ],
  },
  {
    id: 'settings',
    label: 'SETTINGS & SYSTEM',
    icon: 'settings',
    items: [
      { path: '/settings', label: 'Settings', icon: 'settings' },
      { path: '/global-variables', label: 'Global Variables', icon: 'tune' },
      { path: '/audit', label: 'Audit Log', icon: 'manage_search' },
    ],
  },
];

function getFYOptions(): string[] {
  const current = getCurrentFY();
  const startYear = parseInt(current.split('-')[0]);
  const options: string[] = [];
  for (let i = startYear - 2; i <= startYear + 1; i++) {
    options.push(`${i}-${String(i + 1).slice(-2)}`);
  }
  return options;
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentFY = useAppStore((s) => s.currentFY);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const vaultActive = useAppStore.getState().vaultActive;
  
  const { profiles, activeProfileId, setActiveProfile, getActiveProfile } = useProfileStore();
  const activeProfile = getActiveProfile();
  const { 
    open: openCommandPalette, 
    isMobileDrawerOpen, 
    closeMobileDrawer, 
    toggleMobileDrawer,
    openServerWizard 
  } = useCommandStore();
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);


  const getActiveGroupId = (): string => {
    for (const group of NAV_GROUPS) {
      if (group.items.some((item) => {
        if (item.path === '/') return location.pathname === '/';
        return location.pathname.startsWith(item.path);
      })) {
        return group.id;
      }
    }
    return 'core';
  };

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    return new Set([getActiveGroupId()]);
  });

  useEffect(() => {
    const activeGroup = getActiveGroupId();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.add(activeGroup);
      return next;
    });
    closeMobileDrawer();
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const renderNavLinks = (isMobile = false) => (
    <div className={isMobile ? 'mobile-drawer-nav' : 'sidebar-nav'}>
      {NAV_GROUPS.map((group) => {
        const isExpanded = expandedGroups.has(group.id);
        if (group.items.length === 1) {
          const item = group.items[0];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `sidebar-link sidebar-link--solo ${isActive ? 'sidebar-link--active' : ''}`
              }
              onClick={() => isMobile && closeMobileDrawer()}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '16px',
                  fontVariationSettings: `'FILL' ${item.filled ? 1 : 0}, 'wght' 300`,
                }}
              >
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          );
        }

        return (
          <div key={group.id} className={`sidebar-group ${isExpanded ? 'expanded' : ''}`}>
            <div className="sidebar-group-header" onClick={() => toggleGroup(group.id)}>
              <span className="sidebar-group-label">{group.label}</span>
              <span className="material-symbols-outlined sidebar-group-chevron">
                chevron_right
              </span>
            </div>
            <div className="sidebar-group-items">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
                  }
                  onClick={() => isMobile && closeMobileDrawer()}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '14px',
                      fontVariationSettings: `'FILL' ${item.filled ? 1 : 0}, 'wght' 300`,
                    }}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                  {item.path === '/settings' && activeProfile.lastSeenVersion && activeProfile.lastSeenVersion !== APP_VERSION && (
                    <span style={{ marginLeft: 'auto', background: 'var(--primary-container, #00ff41)', color: '#000', fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '2px', fontFamily: 'monospace' }}>
                      NEW
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FinSathiLogo size={22} glow />
              <div className="sidebar-logo">FINSATHI</div>
            </div>
            <div className="sidebar-fy-selector">
              <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                calendar_month
              </span>
              <select
                className="sidebar-fy-select"
                value={currentFY}
                onChange={(e) => useAppStore.getState().setFY(e.target.value)}
              >
                {getFYOptions().map((fy) => (
                  <option key={fy} value={fy}>FY {fy}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Profile Switcher */}
          <div className="sidebar-profile-card">
            <div 
              className="profile-active-btn" 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title="Click to switch profile"
            >
              <div className="profile-indicator">
                <span className="profile-role-dot" />
                <span className="profile-name-text">{activeProfile.name}</span>
              </div>
              <span className="profile-role-badge">
                {activeProfile.role === 'admin' ? 'ADMIN' : 'USER'}
              </span>
            </div>

            {showProfileMenu && (
              <div className="profile-dropdown-menu">
                <div className="profile-dropdown-header">SWITCH PROFILE</div>
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className={`profile-dropdown-item ${p.id === activeProfileId ? 'active' : ''}`}
                    onClick={() => {
                      setActiveProfile(p.id);
                      setShowProfileMenu(false);
                    }}
                  >
                    <span className="profile-item-name">{p.name}</span>
                    <span className="profile-item-tag">{p.role.toUpperCase()}</span>
                  </div>
                ))}
                <div 
                  className="profile-dropdown-manage" 
                  onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                >
                  Manage Profiles →
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Search & AI Command Palette */}
        <div 
          className="sidebar-quick-search-box"
          onClick={openCommandPalette}
          role="button"
          tabIndex={0}
          title="Press ⌘K or / to open Search & AI"
        >
          <span className="material-symbols-outlined sidebar-search-icon">search</span>
          <span className="sidebar-search-placeholder">Search / Ask AI...</span>
          <kbd className="sidebar-search-kbd">⌘K</kbd>
        </div>

        {/* Desktop Nav Groups */}
        {renderNavLinks(false)}

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className="sidebar-footer-btn"
            onClick={() => useAppStore.getState().togglePrivacyMode()}
            data-tooltip={privacyMode ? 'Show Values' : 'Hide Values'}
          >
            <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>
              {privacyMode ? 'visibility_off' : 'visibility'}
            </span>
          </button>
          <button 
            className="sidebar-footer-btn ai-btn" 
            onClick={openCommandPalette} 
            data-tooltip="Search / Local AI"
          >
            <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary-container)' }}>
              auto_awesome
            </span>
          </button>
          <button className="sidebar-footer-btn" onClick={() => useHelpStore.getState().openHelp()}>
            <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>
              help
            </span>
          </button>
          <button 

            className="sidebar-footer-btn"
            onClick={openServerWizard}
            title="Server Diagnostics & Mobile QR Pairing"
            data-tooltip="Server Diagnostics & QR"
          >
            <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>
              dns
            </span>
          </button>
          <NavLink to="/settings" className="sidebar-footer-btn">
            <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>
              settings
            </span>
          </NavLink>
          {vaultActive && (
            <button
              className="sidebar-footer-btn"
              onClick={() => useAppStore.getState().lockVault()}
              data-tooltip="Lock Vault"
            >
              <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>
                lock
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <header className="mobile-topbar">
        <div className="mobile-brand-wrap" onClick={toggleMobileDrawer}>
          <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary-container)' }}>
            menu
          </span>
          <FinSathiLogo size={20} glow />
          <span className="sidebar-logo">FINSATHI</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Server Diagnostics & QR */}
          <button
            style={{ background: 'none', border: 'none', padding: '4px', display: 'flex', color: 'var(--primary-container)' }}
            onClick={openServerWizard}
            aria-label="Server Diagnostics & QR"
            title="Server Setup & QR"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              dns
            </span>
          </button>

          {/* AI Omnisearch Trigger */}
          <button
            className="mobile-ai-pill"
            onClick={openCommandPalette}
            aria-label="Ask Local AI"
          >
            <span className="material-symbols-outlined icon-xs" style={{ fontSize: '14px', color: 'var(--primary-container)' }}>
              auto_awesome
            </span>
            <span className="mobile-ai-text">AI SEARCH</span>
          </button>

          {/* Active Profile Pill */}
          <div 
            className="mobile-profile-pill" 
            onClick={() => {
              const other = profiles.find(p => p.id !== activeProfileId);
              if (other) setActiveProfile(other.id);
            }}
          >
            <span className="profile-role-dot" />
            <span className="mobile-profile-name">{activeProfile.role === 'admin' ? 'ADMIN' : 'USER'}</span>
          </div>

          <button
            style={{ background: 'none', border: 'none', padding: '4px', display: 'flex' }}
            onClick={() => useAppStore.getState().togglePrivacyMode()}
            aria-label="Toggle Privacy"
          >
            <span className="material-symbols-outlined color-subtle" style={{ fontSize: '18px' }}>
              {privacyMode ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      </header>


      {/* Mobile Navigation Drawer */}
      {isMobileDrawerOpen && (
        <div className="mobile-drawer-overlay" onClick={closeMobileDrawer}>
          <div className="mobile-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FinSathiLogo size={20} glow />
                <div className="mobile-drawer-title">FINSATHI VAULT MENU</div>
              </div>
              <button className="mobile-drawer-close" onClick={closeMobileDrawer}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {renderNavLinks(true)}
          </div>
        </div>
      )}
    </>
  );
}
