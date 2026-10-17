import { NavLink, useLocation } from 'react-router-dom';
import { useCommandStore } from '../hooks/useCommandStore';
import './MobileNav.css';

const MOBILE_ITEMS = [
  { path: '/', label: 'HOME', icon: 'dashboard' },
  { path: '/assistant', label: 'AI', icon: 'smart_toy' },
  { path: '/ledger', label: 'LEDGER', icon: 'receipt_long' },
  { path: '/tax', label: 'TAX', icon: 'account_balance' },
];

export function MobileNav() {
  const location = useLocation();
  const { toggleMobileDrawer, isMobileDrawerOpen } = useCommandStore();

  return (
    <nav className="mobile-nav">
      {MOBILE_ITEMS.map((item) => {
        const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
        return (
          <NavLink key={item.path} to={item.path} className={`mobile-nav-item ${isActive ? 'active' : ''}`}>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '18px',
                fontVariationSettings: `'FILL' ${isActive ? 1 : 0}, 'wght' ${isActive ? 400 : 200}`,
              }}
            >
              {item.icon}
            </span>
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        );
      })}

      {/* Menu / Drawer Toggle */}
      <button 
        type="button"
        className={`mobile-nav-item mobile-nav-btn ${isMobileDrawerOpen ? 'active' : ''}`}
        onClick={toggleMobileDrawer}
        aria-label="Toggle Navigation Drawer"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '18px', fontVariationSettings: "'wght' 300" }}
        >
          {isMobileDrawerOpen ? 'close' : 'menu'}
        </span>
        <span className="mobile-nav-label">MENU</span>
      </button>
    </nav>
  );
}
