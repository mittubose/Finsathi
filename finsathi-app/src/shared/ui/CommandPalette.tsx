import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandStore } from '../hooks/useCommandStore';
import { useAppStore, type ExpenseItem, type IncomeItem } from '../hooks/useAppStore';
import { useToast } from './Toast';
import { parseLocalFinancialIntent, type ParsedAiAction } from '../lib/localAi';
import { useWidgetStore } from '../widgets/useWidgetStore';
import { motion, AnimatePresence } from 'framer-motion';
import './CommandPalette.css';

interface CommandItem {
  id: string;
  label: string;
  icon: string;
  category: 'AI ACTION' | 'NAVIGATION' | 'ACTIONS' | 'DATA';
  shortcut?: string;
  action: () => void;
  description?: string;
}

export function CommandPalette() {
  const { isOpen, close } = useCommandStore();
  const navigate = useNavigate();
  const { lockVault, togglePrivacyMode, addExpense, addIncome, currentFY } = useAppStore();
  const { toast } = useToast();
  
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute local AI parsed action
  const aiAction: ParsedAiAction | null = useMemo(() => {
    return parseLocalFinancialIntent(query);
  }, [query]);

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-dash', label: 'Go to Dashboard', icon: 'dashboard', category: 'NAVIGATION', shortcut: '1', action: () => { navigate('/'); close(); } },
    { id: 'nav-assistant', label: 'Go to Financial AI Assistant', icon: 'smart_toy', category: 'NAVIGATION', shortcut: '8', action: () => { navigate('/assistant'); close(); } },
    { id: 'nav-ledger', label: 'Go to Ledger', icon: 'receipt_long', category: 'NAVIGATION', shortcut: '2', action: () => { navigate('/ledger'); close(); } },
    { id: 'nav-tax', label: 'Go to Tax Engine', icon: 'account_balance', category: 'NAVIGATION', shortcut: '3', action: () => navigate('/tax') },
    { id: 'nav-advance-tax', label: 'Go to Advance Tax', icon: 'event_upcoming', category: 'NAVIGATION', action: () => navigate('/advance-tax') },
    { id: 'nav-itr3', label: 'Go to ITR-3 Wizard', icon: 'auto_awesome', category: 'NAVIGATION', action: () => navigate('/itr3') },
    { id: 'nav-trades', label: 'Go to Trades', icon: 'query_stats', category: 'NAVIGATION', shortcut: '4', action: () => navigate('/trades') },
    { id: 'nav-family', label: 'Go to Family Hub', icon: 'diversity_3', category: 'NAVIGATION', action: () => navigate('/family') },
    { id: 'nav-planning', label: 'Go to Planning Hub', icon: 'analytics', category: 'NAVIGATION', action: () => navigate('/planning') },
    { id: 'nav-reminders', label: 'Go to Reminders', icon: 'notifications', category: 'NAVIGATION', shortcut: '5', action: () => navigate('/reminders') },
    { id: 'nav-imports', label: 'Go to Imports', icon: 'upload_file', category: 'NAVIGATION', shortcut: '6', action: () => navigate('/imports') },
    { id: 'nav-reports', label: 'Go to Reports', icon: 'summarize', category: 'NAVIGATION', shortcut: '7', action: () => navigate('/reports') },
    { id: 'nav-settings', label: 'Go to Settings', icon: 'settings', category: 'NAVIGATION', action: () => navigate('/settings') },
    
    // Actions
    { id: 'act-lock', label: 'Lock Application', icon: 'lock', category: 'ACTIONS', shortcut: '⌘L', action: () => { lockVault(); close(); } },
    { id: 'act-privacy', label: 'Toggle Privacy Mode', icon: 'visibility_off', category: 'ACTIONS', shortcut: '⌘H', action: () => { togglePrivacyMode(); close(); } },
    { id: 'act-export', label: 'Export All Data (JSON)', icon: 'download', category: 'ACTIONS', action: () => navigate('/settings') },
    
    // Data Quick Adds
    { id: 'add-income', label: 'Add New Income', icon: 'add_circle', category: 'DATA', action: () => navigate('/ledger?action=add-income') },
    { id: 'add-expense', label: 'Add New Expense', icon: 'remove_circle', category: 'DATA', action: () => navigate('/ledger?action=add-expense') },
    { id: 'add-trade', label: 'Add New Trade', icon: 'show_chart', category: 'DATA', action: () => navigate('/trades?action=add-trade') },
  ], [navigate, lockVault, togglePrivacyMode, close]);

  const executeAiAction = (action: ParsedAiAction) => {
    if (action.intent === 'add_expense' && action.data) {
      const exp: ExpenseItem = {
        id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'expense',
        category: action.data.category,
        amountPaise: action.data.amountPaise,
        date: action.data.date,
        merchant: action.data.merchant,
        notes: action.data.notes,
        tags: ['local-ai'],
        isRecurring: false,
        createdAt: new Date().toISOString(),
      };
      addExpense(exp);
      toast(`Expense added: ₹${(exp.amountPaise / 100).toFixed(2)} (${exp.merchant})`, 'success');
      navigate('/ledger');
      close();
    } else if (action.intent === 'add_income' && action.data) {
      const inc: IncomeItem = {
        id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'income',
        head: action.data.head,
        amountPaise: action.data.amountPaise,
        source: action.data.source,
        fy: currentFY,
        isTaxable: true,
        notes: action.data.notes,
        tags: ['local-ai'],
        date: action.data.date,
        createdAt: new Date().toISOString(),
      };
      addIncome(inc);
      toast(`Income added: ₹${(inc.amountPaise / 100).toFixed(2)} (${inc.source})`, 'success');
      navigate('/ledger');
      close();
    } else if (action.intent === 'manage_widget' && action.data) {
      const widgetStore = useWidgetStore.getState();
      const shouldEnable = action.data.action === 'enable';
      widgetStore.enableWidgetType(action.data.widgetType, shouldEnable);
      toast(`Widget "${action.data.widgetType.toUpperCase()}" ${shouldEnable ? 'enabled' : 'disabled'}`, 'success');
      navigate('/');
      close();
    } else if (action.route) {
      navigate(action.route);
      close();
    }
  };

  const filteredCommands = useMemo(() => {
    const list: CommandItem[] = [];

    // Prepend AI command if detected
    if (aiAction) {
      list.push({
        id: 'ai-task-action',
        label: aiAction.title,
        description: aiAction.description,
        icon: 'auto_awesome',
        category: 'AI ACTION',
        shortcut: '↵ EXECUTE',
        action: () => executeAiAction(aiAction),
      });
    }

    if (!query) return [...list, ...commands];
    const q = query.toLowerCase();
    const matching = commands.filter(c => 
      c.label.toLowerCase().includes(q) || 
      c.category.toLowerCase().includes(q)
    );

    return [...list, ...matching];
  }, [query, commands, aiAction]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (filteredCommands.length ? (i + 1) % filteredCommands.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (filteredCommands.length ? (i - 1 + filteredCommands.length) % filteredCommands.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          close();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close, filteredCommands, selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="cmd-palette-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      >
        <motion.div 
          className="cmd-palette"
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cmd-input-wrap">
            <span className="material-symbols-outlined icon-sm color-muted">search</span>
            <input 
              ref={inputRef}
              className="cmd-input"
              placeholder="Ask AI, add expense (e.g. 'spent 500 coffee'), search trades, or jump..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {aiAction && (
              <span className="cmd-ai-indicator">
                <span className="cmd-ai-dot" />
                LOCAL AI ACTIVE
              </span>
            )}
          </div>

          <div className="cmd-results">
            {filteredCommands.length === 0 ? (
              <div className="cmd-item" style={{ cursor: 'default' }}>
                <span className="text-label-mono-sm color-muted">NO_MATCHING_COMMANDS_OR_TASKS</span>
              </div>
            ) : (
              (() => {
                let currentCat = '';
                return filteredCommands.map((cmd, idx) => {
                  const showCat = cmd.category !== currentCat;
                  currentCat = cmd.category;
                  const isAi = cmd.category === 'AI ACTION';
                  return (
                    <React.Fragment key={cmd.id}>
                      {showCat && <div className="cmd-group-label">{cmd.category}</div>}
                      <div 
                        className={`cmd-item ${idx === selectedIndex ? 'selected' : ''} ${isAi ? 'cmd-item--ai' : ''}`}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => { cmd.action(); close(); }}
                      >
                        <span className={`material-symbols-outlined cmd-item-icon ${isAi ? 'ai-icon' : ''}`}>
                          {cmd.icon}
                        </span>
                        <div className="cmd-item-text-wrap">
                          <span className="cmd-item-label">{cmd.label}</span>
                          {cmd.description && (
                            <span className="cmd-item-desc">{cmd.description}</span>
                          )}
                        </div>
                        {cmd.shortcut && <span className="cmd-item-shortcut">{cmd.shortcut}</span>}
                      </div>
                    </React.Fragment>
                  );
                });
              })()
            )}
          </div>

          <div className="cmd-footer">
            <div className="cmd-hint">
              <span className="cmd-hint-kbd">↵</span> to select / execute
            </div>
            <div className="cmd-hint">
              <span className="cmd-hint-kbd">↑↓</span> to navigate
            </div>
            <div className="cmd-hint">
              <span className="cmd-hint-kbd">esc</span> to close
            </div>
            <div className="cmd-engine-status">
              100% PRIVATE • LOCAL HOST
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
