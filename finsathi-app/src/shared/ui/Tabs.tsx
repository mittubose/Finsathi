import { useState, type ReactNode } from 'react';
import './Tabs.css';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'line' | 'pill';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'line' }: TabsProps) {
  return (
    <div className={`vault-tabs vault-tabs--${variant}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`vault-tab ${activeTab === tab.id ? 'vault-tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && (
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'wght' 300" }}>
              {tab.icon}
            </span>
          )}
          {tab.label}
          {tab.count !== undefined && (
            <span className={`vault-tab-count ${activeTab === tab.id ? 'vault-tab-count--active' : ''}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// TabPanel — just a simple conditional renderer
interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  if (id !== activeTab) return null;
  return <div className="vault-tab-panel">{children}</div>;
}
