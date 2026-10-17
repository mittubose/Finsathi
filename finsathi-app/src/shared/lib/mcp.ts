/**
 * FinSathi Model Context Protocol (MCP) Tool Specifications & Execution Engine
 * Compliant with MCP standard tool schema for local AI chat and external agent integration.
 */

import { useAppStore } from '../hooks/useAppStore';
import { useProfileStore } from '../hooks/useProfileStore';
import { useWidgetStore } from '../widgets/useWidgetStore';
import { WIDGET_REGISTRY } from '../widgets/widgetTypes';
import { compareRegimes, type TaxInput } from '../../domains/tax/engine';

export interface McpToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface McpToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export const FINSATHI_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'query_ledger',
    description: 'Fetch income, expenses, and transaction history from the active financial vault.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Type of transaction: all, income, expense, or trade',
          enum: ['all', 'income', 'expense', 'trade']
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return (default: 20)'
        },
        search: {
          type: 'string',
          description: 'Filter keyword for merchant, source, or notes'
        }
      }
    }
  },
  {
    name: 'add_transaction',
    description: 'Log a new income or expense transaction into the user ledger.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Transaction type: income or expense',
          enum: ['income', 'expense']
        },
        amountRupees: {
          type: 'number',
          description: 'Transaction amount in Rupees (e.g. 450.50)'
        },
        categoryOrHead: {
          type: 'string',
          description: 'Category for expenses (e.g. Food, Travel) or head for income (salary, freelance, dividend)'
        },
        merchantOrSource: {
          type: 'string',
          description: 'Merchant name or income source (e.g. Starbucks, TCS, Amazon)'
        },
        notes: {
          type: 'string',
          description: 'Optional transaction notes or description'
        }
      },
      required: ['type', 'amountRupees', 'categoryOrHead', 'merchantOrSource']
    }
  },
  {
    name: 'calculate_tax',
    description: 'Compute Indian Income Tax liability comparing Old vs New tax regime.',
    parameters: {
      type: 'object',
      properties: {
        annualSalaryRupees: {
          type: 'number',
          description: 'Gross annual salary in INR (e.g. 1500000)'
        },
        fy: {
          type: 'string',
          description: 'Financial Year (default: 2024-25 or 2025-26)'
        },
        section80cRupees: {
          type: 'number',
          description: 'Optional Section 80C deductions (max 1.5L)'
        },
        npsRupees: {
          type: 'number',
          description: 'Optional Section 80CCD(1B) NPS deduction (max 50k)'
        }
      },
      required: ['annualSalaryRupees']
    }
  },
  {
    name: 'get_profile_summary',
    description: 'Fetch executive financial summary (active profile, net worth, income, expense, trade PnL).',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'search_trades',
    description: 'Search equity and mutual fund trade records and realized capital gains.',
    parameters: {
      type: 'object',
      properties: {
        instrument: {
          type: 'string',
          description: 'Stock symbol or instrument name (e.g. INFY, TATASTEEL)'
        }
      }
    }
  },
  {
    name: 'manage_widget',
    description: 'Enable, disable, or query modular dashboard widgets (trades, salary, tax, reminders, ai-chat, ledger).',
    parameters: {
      type: 'object',
      properties: {
        widgetType: {
          type: 'string',
          description: 'Widget type: trades, salary, tax, reminders, ai-chat, or ledger',
          enum: ['trades', 'salary', 'tax', 'reminders', 'ai-chat', 'ledger']
        },
        action: {
          type: 'string',
          description: 'Action: enable, disable, or list',
          enum: ['enable', 'disable', 'list']
        }
      },
      required: ['action']
    }
  }
];

/**
 * Execute an MCP tool call in the client context
 */
export async function executeMcpTool(name: string, args: Record<string, any> = {}): Promise<McpToolResponse> {
  const store = useAppStore.getState();
  const profileStore = useProfileStore.getState();
  const activeProfile = profileStore.getActiveProfile();

  try {
    switch (name) {
      case 'query_ledger': {
        const type = args.type || 'all';
        const limit = args.limit || 20;
        const search = (args.search || '').toLowerCase();

        let items: any[] = [];
        if (type === 'all' || type === 'income') items.push(...store.incomeItems);
        if (type === 'all' || type === 'expense') items.push(...store.expenseItems);
        if (type === 'all' || type === 'trade') items.push(...store.tradeItems);

        if (search) {
          items = items.filter(it => 
            (it.merchant && it.merchant.toLowerCase().includes(search)) ||
            (it.source && it.source.toLowerCase().includes(search)) ||
            (it.category && it.category.toLowerCase().includes(search)) ||
            (it.instrument && it.instrument.toLowerCase().includes(search)) ||
            (it.notes && it.notes.toLowerCase().includes(search))
          );
        }

        const sorted = items.sort((a, b) => {
          const dateA = a.date || a.sellDate || a.createdAt;
          const dateB = b.date || b.sellDate || b.createdAt;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        }).slice(0, limit);

        const summary = sorted.map(it => ({
          id: it.id,
          type: it.type,
          label: it.merchant || it.source || it.instrument,
          category: it.category || it.head || it.assetType,
          amountINR: (it.amountPaise ? it.amountPaise / 100 : (it.realizedPnlPaise ? it.realizedPnlPaise / 100 : 0)),
          date: it.date || it.sellDate || it.createdAt
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ count: summary.length, totalAvailable: items.length, records: summary }, null, 2)
          }]
        };
      }

      case 'add_transaction': {
        const { type, amountRupees, categoryOrHead, merchantOrSource, notes = '' } = args;
        const amountPaise = Math.round(Number(amountRupees) * 100);
        const id = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();

        if (type === 'income') {
          store.addIncome({
            id,
            type: 'income',
            head: categoryOrHead || 'other',
            amountPaise,
            source: merchantOrSource,
            fy: store.currentFY,
            isTaxable: true,
            notes: notes || 'Logged via MCP Tool',
            tags: ['mcp'],
            date: now.split('T')[0],
            createdAt: now,
          });
        } else {
          store.addExpense({
            id,
            type: 'expense',
            category: categoryOrHead || 'General',
            amountPaise,
            date: now.split('T')[0],
            merchant: merchantOrSource,
            notes: notes || 'Logged via MCP Tool',
            tags: ['mcp'],
            isRecurring: false,
            createdAt: now,
          });
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Created ${type} record of ₹${amountRupees} for ${merchantOrSource}`,
              recordId: id
            }, null, 2)
          }]
        };
      }

      case 'calculate_tax': {
        const salaryPaise = Math.round(Number(args.annualSalaryRupees) * 100);
        const sec80cPaise = Math.round(Number(args.section80cRupees || 0) * 100);
        const npsPaise = Math.round(Number(args.npsRupees || 0) * 100);

        const taxInput: TaxInput = {
          salary: {
            basicPaise: Math.round(salaryPaise * 0.5),
            hraPaise: 0,
            specialAllowancePaise: Math.round(salaryPaise * 0.5),
            conveyancePaise: 0,
            ltaPaise: 0,
            bonusPaise: 0,
            otherTaxablePaise: 0,
            employerPfPaise: 0,
            professionTaxPaise: 0,
          },
          deductions: {
            section80C_paise: sec80cPaise,
            section80D_paise: 0,
            section80E_paise: 0,
            section80TTA_paise: 0,
            homeLoanInterestPaise: 0,
            nps80CCD_paise: npsPaise,
            otherDeductionsPaise: 0,
          },
          tdsDeductedPaise: 0,
          fy: store.currentFY || '2025-26',
        };

        const comparison = compareRegimes(taxInput);
        const oldResult = comparison.oldRegime;
        const newResult = comparison.newRegime;

        const savings = comparison.savingsPaise;
        const betterRegime = comparison.recommendation === 'old' ? 'Old Regime' : 'New Regime';

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              grossSalaryINR: args.annualSalaryRupees,
              recommendation: `${betterRegime} saves ₹${(savings / 100).toLocaleString('en-IN')}`,
              oldRegime: {
                totalTaxINR: oldResult.totalTaxPaise / 100,
                effectiveRate: `${oldResult.effectiveRate.toFixed(1)}%`,
              },
              newRegime: {
                totalTaxINR: newResult.totalTaxPaise / 100,
                effectiveRate: `${newResult.effectiveRate.toFixed(1)}%`,
              }
            }, null, 2)
          }]
        };
      }

      case 'get_profile_summary': {
        const totalIncomePaise = store.incomeItems.reduce((acc, i) => acc + i.amountPaise, 0);
        const totalExpensePaise = store.expenseItems.reduce((acc, i) => acc + i.amountPaise, 0);
        const totalTradingPnlPaise = store.tradeItems.reduce((acc, t) => acc + t.realizedPnlPaise, 0);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              profile: {
                name: activeProfile.name,
                role: activeProfile.role,
                pan: activeProfile.pan || 'NOT_SET',
              },
              currentFY: store.currentFY,
              financials: {
                totalIncomeINR: totalIncomePaise / 100,
                totalExpenseINR: totalExpensePaise / 100,
                netCashflowINR: (totalIncomePaise - totalExpensePaise) / 100,
                realizedTradingPnlINR: totalTradingPnlPaise / 100,
                activeObligationsCount: store.reminders.filter(r => r.status === 'upcoming').length,
              }
            }, null, 2)
          }]
        };
      }

      case 'search_trades': {
        const query = (args.instrument || '').toLowerCase();
        const trades = store.tradeItems.filter(t => 
          !query || t.instrument.toLowerCase().includes(query)
        );

        const mapped = trades.slice(0, 20).map(t => ({
          id: t.id,
          instrument: t.instrument,
          qty: t.qty,
          buyPriceINR: t.buyPricePaise / 100,
          sellPriceINR: t.sellPricePaise / 100,
          realizedPnlINR: t.realizedPnlPaise / 100,
          classification: t.classification,
          sellDate: t.sellDate
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ count: mapped.length, trades: mapped }, null, 2)
          }]
        };
      }

      case 'manage_widget': {
        const widgetStore = useWidgetStore.getState();
        const { widgetType, action = 'enable' } = args;

        if (action === 'list') {
          const list = widgetStore.widgets.map(w => ({
            type: w.type,
            title: w.title,
            enabled: w.enabled,
            order: w.order
          }));
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                message: 'Current dashboard modular widgets:',
                widgets: list
              }, null, 2)
            }]
          };
        }

        if (widgetType) {
          const shouldEnable = action === 'enable';
          widgetStore.enableWidgetType(widgetType as any, shouldEnable);
          const title = (WIDGET_REGISTRY as any)[widgetType]?.defaultTitle || widgetType;
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Widget "${title}" has been ${shouldEnable ? 'ENABLED' : 'DISABLED'} on your dashboard.`,
                widgetType,
                enabled: shouldEnable
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: 'Please specify a widgetType (trades, salary, tax, reminders, ai-chat, or ledger).'
          }],
          isError: true
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Tool error: ${err.message}` }],
      isError: true
    };
  }
}
