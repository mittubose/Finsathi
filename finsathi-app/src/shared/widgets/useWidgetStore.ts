import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type WidgetInstance, type WidgetType, WIDGET_REGISTRY } from './widgetTypes';

export type WorkflowPreset = 'salaried' | 'salaried_investor' | 'active_trader' | 'minimalist';

interface WidgetState {
  widgets: WidgetInstance[];
  
  // Actions
  toggleWidget: (id: string) => void;
  enableWidgetType: (type: WidgetType, enabled?: boolean) => void;
  configureCustomWidgets: (enabledTypes: WidgetType[]) => void;
  toggleCollapse: (id: string) => void;
  moveWidget: (id: string, direction: 'up' | 'down') => void;
  updateWidgetConfig: (id: string, updates: { title?: string; config?: Record<string, any> }) => void;
  applyPreset: (preset: WorkflowPreset) => void;
  resetToDefault: () => void;
}

const DEFAULT_WIDGETS: WidgetInstance[] = [
  {
    id: 'w_ledger',
    type: 'ledger',
    title: WIDGET_REGISTRY['ledger'].defaultTitle,
    enabled: true,
    order: 0,
    collapsed: false,
    config: { showQuickAdd: true, maxRows: 5 },
  },
  {
    id: 'w_tax',
    type: 'tax',
    title: WIDGET_REGISTRY['tax'].defaultTitle,
    enabled: true,
    order: 1,
    collapsed: false,
    config: { defaultRegime: 'compare', showAdvanceTax: true },
  },
  {
    id: 'w_salary',
    type: 'salary',
    title: WIDGET_REGISTRY['salary'].defaultTitle,
    enabled: true,
    order: 2,
    collapsed: false,
    config: { showTakeHome: true },
  },
  {
    id: 'w_trades',
    type: 'trades',
    title: WIDGET_REGISTRY['trades'].defaultTitle,
    enabled: true,
    order: 3,
    collapsed: false,
    config: { showStcgVsLtcg: true },
  },
  {
    id: 'w_reminders',
    type: 'reminders',
    title: WIDGET_REGISTRY['reminders'].defaultTitle,
    enabled: true,
    order: 4,
    collapsed: false,
    config: { daysAhead: 30 },
  },
  {
    id: 'w_ai_chat',
    type: 'ai-chat',
    title: WIDGET_REGISTRY['ai-chat'].defaultTitle,
    enabled: true,
    order: 5,
    collapsed: false,
    config: { mcpToolsEnabled: true },
  },
];

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,

      toggleWidget: (id) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, enabled: !w.enabled } : w
          ),
        }));
      },

      enableWidgetType: (type, enabled = true) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.type === type ? { ...w, enabled } : w
          ),
        }));
      },

      configureCustomWidgets: (enabledTypes) => {
        set((state) => ({
          widgets: state.widgets.map((w) => ({
            ...w,
            enabled: enabledTypes.includes(w.type),
          })),
        }));
      },

      toggleCollapse: (id) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, collapsed: !w.collapsed } : w
          ),
        }));
      },

      moveWidget: (id, direction) => {
        const sorted = [...get().widgets].sort((a, b) => a.order - b.order);
        const index = sorted.findIndex((w) => w.id === id);
        if (index === -1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= sorted.length) return;

        // Swap order numbers
        const currentOrder = sorted[index].order;
        const targetOrder = sorted[targetIndex].order;
        sorted[index].order = targetOrder;
        sorted[targetIndex].order = currentOrder;

        set({ widgets: sorted });
      },

      updateWidgetConfig: (id, updates) => {
        set((state) => ({
          widgets: state.widgets.map((w) => {
            if (w.id !== id) return w;
            return {
              ...w,
              title: updates.title !== undefined ? updates.title : w.title,
              config: updates.config ? { ...w.config, ...updates.config } : w.config,
            };
          }),
        }));
      },

      applyPreset: (preset) => {
        if (preset === 'salaried') {
          // Salaried professional: Salary, Tax, Ledger, Reminders, AI Chat (No Trades)
          set({
            widgets: [
              { ...DEFAULT_WIDGETS[2], order: 0, enabled: true }, // Salary
              { ...DEFAULT_WIDGETS[1], order: 1, enabled: true }, // Tax
              { ...DEFAULT_WIDGETS[0], order: 2, enabled: true }, // Ledger
              { ...DEFAULT_WIDGETS[4], order: 3, enabled: true }, // Reminders
              { ...DEFAULT_WIDGETS[5], order: 4, enabled: true }, // AI Chat
              { ...DEFAULT_WIDGETS[3], order: 5, enabled: false }, // Trades DISABLED
            ]
          });
        } else if (preset === 'salaried_investor') {
          set({
            widgets: [
              { ...DEFAULT_WIDGETS[1], order: 0, enabled: true }, // Tax
              { ...DEFAULT_WIDGETS[2], order: 1, enabled: true }, // Salary
              { ...DEFAULT_WIDGETS[3], order: 2, enabled: true }, // Trades
              { ...DEFAULT_WIDGETS[0], order: 3, enabled: true }, // Ledger
              { ...DEFAULT_WIDGETS[4], order: 4, enabled: true }, // Reminders
              { ...DEFAULT_WIDGETS[5], order: 5, enabled: true }, // AI Chat
            ]
          });
        } else if (preset === 'active_trader') {
          set({
            widgets: [
              { ...DEFAULT_WIDGETS[3], order: 0, enabled: true }, // Trades
              { ...DEFAULT_WIDGETS[1], order: 1, enabled: true }, // Tax
              { ...DEFAULT_WIDGETS[0], order: 2, enabled: true }, // Ledger
              { ...DEFAULT_WIDGETS[5], order: 3, enabled: true }, // AI Chat
              { ...DEFAULT_WIDGETS[4], order: 4, enabled: false }, // Reminders DISABLED
              { ...DEFAULT_WIDGETS[2], order: 5, enabled: false }, // Salary DISABLED
            ]
          });
        } else if (preset === 'minimalist') {
          set({
            widgets: [
              { ...DEFAULT_WIDGETS[0], order: 0, enabled: true }, // Ledger
              { ...DEFAULT_WIDGETS[4], order: 1, enabled: true }, // Reminders
              { ...DEFAULT_WIDGETS[5], order: 2, enabled: true }, // AI Chat
              { ...DEFAULT_WIDGETS[1], order: 3, enabled: false }, // Tax DISABLED
              { ...DEFAULT_WIDGETS[2], order: 4, enabled: false }, // Salary DISABLED
              { ...DEFAULT_WIDGETS[3], order: 5, enabled: false }, // Trades DISABLED
            ]
          });
        }
      },

      resetToDefault: () => set({ widgets: DEFAULT_WIDGETS }),
    }),
    {
      name: 'finsathi-widgets-store',
    }
  )
);
