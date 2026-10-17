/**
 * FinSathi Modular Widget Contracts
 * Standardized plug-and-play widget definition with pipeline inputs and outputs.
 */

export type WidgetType = 
  | 'tax' 
  | 'salary' 
  | 'ledger' 
  | 'trades' 
  | 'reminders' 
  | 'planning' 
  | 'ai-chat';

export interface WidgetMetadata {
  type: WidgetType;
  name: string;
  category: 'TAX_AND_SALARY' | 'LEDGER_AND_CASH' | 'INVESTMENTS' | 'INTELLIGENCE';
  icon: string;
  defaultTitle: string;
  description: string;
  inputs?: string[];
  outputs?: string[];
}

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  title: string;
  enabled: boolean;
  order: number;
  collapsed?: boolean;
  config: Record<string, any>;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetMetadata> = {
  'tax': {
    type: 'tax',
    name: 'Tax Engine & Regime Compare',
    category: 'TAX_AND_SALARY',
    icon: 'account_balance',
    defaultTitle: 'TAX ESTIMATION & REGIME',
    description: 'Computes Old vs New regime tax liability and advance tax schedules.',
    inputs: ['salary.gross', 'trades.pnl'],
    outputs: ['tax.totalLiability', 'tax.preferredRegime'],
  },
  'salary': {
    type: 'salary',
    name: 'Salary Slip & CTC Breakdown',
    category: 'TAX_AND_SALARY',
    icon: 'payments',
    defaultTitle: 'SALARY & COMPENSATION',
    description: 'Tracks monthly gross, EPF, HRA exemption, and take-home pay.',
    outputs: ['salary.gross', 'salary.taxable'],
  },
  'ledger': {
    type: 'ledger',
    name: 'Cash Flow & Live Ledger',
    category: 'LEDGER_AND_CASH',
    icon: 'receipt_long',
    defaultTitle: 'CASH FLOW & RECENT ACTIVITY',
    description: 'Real-time record of income and expenses with inline editing.',
    outputs: ['ledger.netSavings', 'ledger.totalExpense'],
  },
  'trades': {
    type: 'trades',
    name: 'Capital Gains & Trading PnL',
    category: 'INVESTMENTS',
    icon: 'query_stats',
    defaultTitle: 'TRADES & CAPITAL GAINS',
    description: 'Summarizes realized equity/MF profits, STCG, and LTCG.',
    outputs: ['trades.pnl', 'trades.stcg', 'trades.ltcg'],
  },
  'reminders': {
    type: 'reminders',
    name: 'Upcoming Obligations & Bills',
    category: 'LEDGER_AND_CASH',
    icon: 'event_upcoming',
    defaultTitle: 'OBLIGATIONS & REMINDERS',
    description: 'Tracks pending bills, SIPs, and tax due dates with one-tap pay.',
  },
  'planning': {
    type: 'planning',
    name: 'Wealth & Emergency Fund',
    category: 'INVESTMENTS',
    icon: 'analytics',
    defaultTitle: 'WEALTH & EMERGENCY RUNWAY',
    description: 'Calculates financial runway and emergency corpus status.',
  },
  'ai-chat': {
    type: 'ai-chat',
    name: 'Local AI Assistant (MCP-Powered)',
    category: 'INTELLIGENCE',
    icon: 'auto_awesome',
    defaultTitle: 'LOCAL FINANCIAL AI ASSISTANT',
    description: 'Private in-app chat executing Model Context Protocol tools offline.',
    inputs: ['ledger.*', 'tax.*', 'trades.*'],
  },
};
