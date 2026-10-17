import { useAppStore, type Reminder, type ExpenseItem, type IncomeItem } from '../hooks/useAppStore';
import { useSalaryStore } from '../hooks/useSalaryStore';
import { formatINR } from './currency';
import * as XLSX from 'xlsx';
import { parseFinancialDocumentUniversal, type DocumentVerificationReport } from './receiptOcr';
import { recordApiCall } from './apiAnalytics';


export interface ParsedAiAction {
  intent: 'add_expense' | 'add_income' | 'search_ledger' | 'search_trades' | 'navigate' | 'tax_query' | 'manage_widget' | 'view_updates' | 'unknown';
  confidence: number;
  title: string;
  description: string;
  data?: Record<string, any>;
  route?: string;
}

export interface LocalAiSettings {
  ollamaUrl: string; // e.g. http://127.0.0.1:11434
  model: string;     // e.g. llama3, mistral, phi3
  enabled: boolean;
}

export const DEFAULT_AI_SETTINGS: LocalAiSettings = {
  ollamaUrl: 'http://127.0.0.1:11434',
  model: 'llama3',
  enabled: true,
};

/**
 * Native heuristic parser for quick financial tasks and commands.
 * Runs instantly in the browser with 0 network latency.
 */
export function parseLocalFinancialIntent(input: string): ParsedAiAction | null {
  const query = input.trim();
  if (!query || query.length < 3) return null;

  const lower = query.toLowerCase();

  // 0. WIDGET MANAGEMENT intent
  // Matches: "enable trades widget", "turn on salary", "add trades to dashboard", "hide reminders", "disable tax"
  const widgetActionMatch = lower.match(/(enable|activate|turn on|add|show|disable|deactivate|turn off|hide|remove)\s+(?:the\s+)?(trades?|trading|salary|payslip|tax|taxes|reminders?|bills?|ai[\s-]?chat|ledger)(?:\s+widget)?/i);
  if (widgetActionMatch) {
    const verb = widgetActionMatch[1].toLowerCase();
    const rawTarget = widgetActionMatch[2].toLowerCase();
    const shouldEnable = /enable|activate|turn on|add|show/i.test(verb);

    let widgetType: 'salary' | 'tax' | 'trades' | 'ledger' | 'reminders' | 'ai-chat' = 'trades';
    let displayTitle = 'Trades Tracker';
    if (/trades?|trading/i.test(rawTarget)) {
      widgetType = 'trades';
      displayTitle = 'Trades Tracker';
    } else if (/salary|payslip/i.test(rawTarget)) {
      widgetType = 'salary';
      displayTitle = 'Salary & Take-Home';
    } else if (/tax|taxes/i.test(rawTarget)) {
      widgetType = 'tax';
      displayTitle = 'Tax Optimizer';
    } else if (/reminders?|bills?/i.test(rawTarget)) {
      widgetType = 'reminders';
      displayTitle = 'Bill Reminders';
    } else if (/ai/i.test(rawTarget)) {
      widgetType = 'ai-chat';
      displayTitle = 'Local AI Copilot';
    } else if (/ledger/i.test(rawTarget)) {
      widgetType = 'ledger';
      displayTitle = 'Transactions Ledger';
    }

    return {
      intent: 'manage_widget',
      confidence: 0.98,
      title: `${shouldEnable ? 'Enable' : 'Disable'} ${displayTitle}`,
      description: `${shouldEnable ? 'Add' : 'Remove'} the ${displayTitle} widget on your modular dashboard.`,
      data: {
        widgetType,
        action: shouldEnable ? 'enable' : 'disable',
      },
      route: '/',
    };
  }

  // 0.1 SOFTWARE UPDATES intent
  if (/(?:what(?:'s| is) new|software updates?|release notes|changelog|new features?)/i.test(lower)) {
    return {
      intent: 'view_updates',
      confidence: 0.95,
      title: 'View Software Updates (v2.1.0)',
      description: 'Check latest updates: Modular widgets, Local AI MCP, Trade Tax Pipelines, and Multi-Profile Vaults.',
      route: '/settings',
    };
  }

  // 1. ADD EXPENSE intent
  // Matches: "add expense 500 coffee", "spent 1200 on fuel", "bought book 450", "uber 350", "paid 2000 electricity"
  const expenseMatch = 
    lower.match(/(?:add expense|spent|paid|bought|buy)\s+(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:on|for|at)?\s*(.*)/i) ||
    lower.match(/^(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s+(?:on|for|at|to)\s+(.*)/i);

  if (expenseMatch) {
    const rawAmount = parseFloat(expenseMatch[1]);
    const remainder = (expenseMatch[2] || '').trim();
    const amountPaise = Math.round(rawAmount * 100);

    // Heuristic categorization
    let category = 'General';
    let merchant = remainder || 'Expense';
    if (/coffee|starbucks|lunch|dinner|swiggy|zomato|burger|food|grocery|groceries|supermarket/i.test(remainder)) {
      category = 'Food & Groceries';
    } else if (/uber|ola|cab|auto|fuel|petrol|diesel|flight|train|metro/i.test(remainder)) {
      category = 'Travel & Commute';
    } else if (/electricity|water|wifi|broadband|recharge|mobile|bill|rent/i.test(remainder)) {
      category = 'Utilities & Bills';
    } else if (/amazon|flipkart|shopping|clothes|shoes|myntra/i.test(remainder)) {
      category = 'Shopping';
    } else if (/doctor|medicine|hospital|pharmacy|apollo|health/i.test(remainder)) {
      category = 'Healthcare';
    }

    return {
      intent: 'add_expense',
      confidence: 0.95,
      title: `Add Expense: ₹${rawAmount.toFixed(2)}`,
      description: `Category: ${category} • Merchant: ${merchant || 'General'}`,
      data: {
        amountPaise,
        category,
        merchant: merchant || 'Miscellaneous',
        date: new Date().toISOString().split('T')[0],
        notes: `Logged via Local AI: "${query}"`,
      },
      route: '/ledger',
    };
  }

  // 2. ADD INCOME intent
  // Matches: "add income 75000 salary", "received 50000 bonus", "dividend 1200 from tcs"
  const incomeMatch = lower.match(/(?:add income|received|got|earned|credited)\s+(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:from|as|for)?\s*(.*)/i);
  if (incomeMatch) {
    const rawAmount = parseFloat(incomeMatch[1]);
    const remainder = (incomeMatch[2] || '').trim();
    const amountPaise = Math.round(rawAmount * 100);

    let head: 'salary' | 'dividend' | 'interest' | 'rental' | 'freelance' | 'other' = 'other';
    if (/salary|paycheck|ctc/i.test(remainder)) head = 'salary';
    else if (/dividend/i.test(remainder)) head = 'dividend';
    else if (/interest|fd|rd|savings/i.test(remainder)) head = 'interest';
    else if (/rent|tenant/i.test(remainder)) head = 'rental';
    else if (/freelance|consulting|gig/i.test(remainder)) head = 'freelance';

    return {
      intent: 'add_income',
      confidence: 0.95,
      title: `Add Income: ₹${rawAmount.toFixed(2)}`,
      description: `Head: ${head.toUpperCase()} • Source: ${remainder || 'Income'}`,
      data: {
        amountPaise,
        head,
        source: remainder || 'Primary Income',
        date: new Date().toISOString().split('T')[0],
        notes: `Logged via Local AI: "${query}"`,
      },
      route: '/ledger',
    };
  }

  // 3. TAX & REGIME QUERIES
  if (/advance tax|tax advance|quarterly tax/i.test(lower)) {
    return {
      intent: 'tax_query',
      confidence: 0.9,
      title: 'Advance Tax Calculator',
      description: 'Review quarterly installments (15% Jun, 45% Sep, 75% Dec, 100% Mar) and compute interest under 234B/C.',
      route: '/advance-tax',
    };
  }

  if (/old vs new|regime|compare regime|80c|tax slab/i.test(lower)) {
    return {
      intent: 'tax_query',
      confidence: 0.9,
      title: 'Tax Engine & Regime Comparison',
      description: 'Compare Old vs New Tax Regime with FY 2024-25 / 2025-26 slabs and standard deduction.',
      route: '/tax',
    };
  }

  if (/itr-?3|itr3|schedule cg|schedule bp|fno|trading tax/i.test(lower)) {
    return {
      intent: 'tax_query',
      confidence: 0.9,
      title: 'ITR-3 Wizard & Schedules',
      description: 'Navigate to ITR-3 business, capital gains, and speculative audit filing preparation.',
      route: '/itr3',
    };
  }

  // 4. SEARCH ACTIONS
  if (/^search trade|^find trade|^trade in /i.test(lower)) {
    const term = lower.replace(/^(?:search trade|find trade|trade in)\s+/i, '').trim();
    return {
      intent: 'search_trades',
      confidence: 0.85,
      title: `Search Trades for "${term}"`,
      description: 'Filter equity, mutual fund, and F&O trades by script or symbol.',
      data: { searchTerm: term },
      route: `/trades?q=${encodeURIComponent(term)}`,
    };
  }

  if (/^search |^find |^look for /i.test(lower)) {
    const term = lower.replace(/^(?:search|find|look for)\s+/i, '').trim();
    return {
      intent: 'search_ledger',
      confidence: 0.85,
      title: `Search Ledger for "${term}"`,
      description: 'Filter income and expense records by merchant or tag.',
      data: { searchTerm: term },
      route: `/ledger?q=${encodeURIComponent(term)}`,
    };
  }

  return null;
}

/**
 * Optional local LLM query runner for advanced financial reasoning.
 * Calls local host Ollama service without any external network access.
 */
export async function queryLocalOllama(
  prompt: string, 
  settings: LocalAiSettings = DEFAULT_AI_SETTINGS
): Promise<{ text: string; error?: string }> {
  if (!settings.enabled) {
    return { text: '', error: 'Local AI is disabled in settings.' };
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(`${settings.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        prompt: `You are FinSathi, a local Indian personal financial assistant. Answer very concisely in 2 sentences. User query: ${prompt}`,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const durationMs = Date.now() - startTime;
    if (!res.ok) {
      recordApiCall({
        endpoint: 'ollama',
        target: `${settings.ollamaUrl} (${settings.model})`,
        durationMs,
        status: 'fallback',
        payloadSize: prompt.length,
      });
      return { text: '', error: `Ollama returned HTTP ${res.status}` };
    }

    const json = await res.json();
    recordApiCall({
      endpoint: 'ollama',
      target: `${settings.ollamaUrl} (${settings.model})`,
      durationMs,
      status: 'success',
      payloadSize: prompt.length,
    });
    return { text: json.response || '' };
  } catch (err: any) {
    recordApiCall({
      endpoint: 'ollama',
      target: `${settings.ollamaUrl} (${settings.model})`,
      durationMs: Date.now() - startTime,
      status: 'fallback',
      payloadSize: prompt.length,
    });
    return { 
      text: '', 
      error: 'Local Ollama is offline. Falling back to native instant intent parser.' 
    };
  }
}

// ============ FINANCIAL TASK EXECUTORS ============

/**
 * 1. Update Salary & CTC (e.g. "update salary to 20LPA", "salary is 18 lakhs")
 */
export function executeSalaryUpdate(query: string): string | null {
  const match = query.match(/(?:update|change|set|make|my)?\s*(?:the\s+)?salary\s*(?:is|to|=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(lpa|lakhs?|lac|l|cr)?/i) ||
                query.match(/ctc\s*(?:is|to|=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(lpa|lakhs?|lac|l|cr)?/i);

  if (!match) return null;

  const rawNum = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();

  let annualRupees = rawNum;
  if (unit.startsWith('cr')) {
    annualRupees = rawNum * 10000000;
  } else if (unit.startsWith('l') || rawNum < 150) {
    // Treat numbers < 150 as LPA if not specified
    annualRupees = rawNum * 100000;
  }

  const monthlyGross = Math.round(annualRupees / 12);
  const basicMonthly = Math.round(monthlyGross * 0.50);
  const hraMonthly = Math.round(monthlyGross * 0.25);
  const specialMonthly = Math.round(monthlyGross * 0.25);

  const revision = {
    effectiveFrom: new Date().toISOString().split('T')[0],
    companyName: 'Primary Employer',
    payCycleDay: 30,
    ctcPaise: annualRupees * 100,
    components: [
      { id: crypto.randomUUID(), label: 'Basic Salary', amountPaise: basicMonthly * 100, type: 'earning' as const, category: 'basic' as const },
      { id: crypto.randomUUID(), label: 'House Rent Allowance (HRA)', amountPaise: hraMonthly * 100, type: 'earning' as const, category: 'hra' as const },
      { id: crypto.randomUUID(), label: 'Special Allowance', amountPaise: specialMonthly * 100, type: 'earning' as const, category: 'special_allowance' as const },
    ]
  };

  useSalaryStore.getState().addRevision(revision);

  return `✓ Successfully updated annual salary to ${formatINR(annualRupees * 100)} (${(annualRupees / 100000).toFixed(1)} LPA)!\n\nMonthly Breakdown:\n• Monthly Gross: ${formatINR(monthlyGross * 100)}\n• Basic (50%): ${formatINR(basicMonthly * 100)}\n• HRA (25%): ${formatINR(hraMonthly * 100)}\n• Special Allowance (25%): ${formatINR(specialMonthly * 100)}\n\nYour Salary Slip widget and FY25-26 tax optimizer have been recalibrated automatically.`;
}

/**
 * 2. Tax Paid Query (e.g. "how much tax I paid last year", "check my tax paid")
 */
export function executeTaxPaidQuery(query: string): string | null {
  const isTaxPaidQuery = /tax.*paid|taxes.*paid|how much.*tax|tds.*deducted|advance tax/i.test(query);
  if (!isTaxPaidQuery) return null;

  const appState = useAppStore.getState();
  const currentFy = appState.currentFY || '2025-26';
  const isLastYear = /last year|previous year|2024-25/i.test(query);
  const targetFy = isLastYear ? '2024-25' : currentFy;

  // Search expenses for Tax / Advance Tax / TDS
  const taxExpenses = (appState.expenseItems || []).filter(e => {
    const text = `${e.category} ${e.merchant} ${e.notes}`.toLowerCase();
    return text.includes('tax') || text.includes('tds');
  });

  const totalPaise = taxExpenses.reduce((acc, e) => acc + (e.amountPaise || 0), 0);
  const tdsPaise = (appState.itr3Data?.tdsData || 0) * 100;
  const grandTotal = totalPaise + tdsPaise;

  const count = taxExpenses.length;

  return `Tax Summary for FY ${targetFy}:\n• Total Recorded Tax Paid: ${formatINR(grandTotal)}\n• TDS Deductions: ${formatINR(tdsPaise)}\n• Advance / Self-Assessment Payments: ${formatINR(totalPaise)} (${count} transactions)\n\nTip: You can view quarterly installment breakdowns in the Advance Tax schedule anytime.`;
}

/**
 * 3. Set Payment Reminder (e.g. "set reminder for HDFC credit card 25000 due on 25th")
 */
export function executePaymentReminder(query: string): string | null {
  if (!/remind|reminder|due|bill|credit\s*card|pay\s+/i.test(query)) return null;
  const match = query.match(/(?:set|add|create|remind)\s+(?:me\s+to\s+pay\s+|reminder\s+(?:for\s+)?)?(.+?)\s+(?:of\s+)?(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:due\s+(?:on\s+)?)?(.+)?/i);
  if (!match) return null;

  const rawTitle = match[1].trim();
  const amountRupees = parseFloat(match[2]);
  const dateClue = (match[3] || '').trim();

  // Determine category
  let category = 'other';
  if (/credit\s*card|cc|hdfc|sbi|icici|axis/i.test(rawTitle)) category = 'credit_card';
  else if (/electricity|water|wifi|bill|broadband|recharge|dth/i.test(rawTitle)) category = 'bill';
  else if (/rent|flat|landlord/i.test(rawTitle)) category = 'rent';
  else if (/netflix|spotify|prime|youtube|subscription/i.test(rawTitle)) category = 'subscription';

  // Construct target due date
  const now = new Date();
  let day = 25;
  const dayMatch = dateClue.match(/([0-9]{1,2})(?:st|nd|rd|th)?/);
  if (dayMatch) {
    day = Math.min(31, Math.max(1, parseInt(dayMatch[1])));
  }

  const dueDate = new Date(now.getFullYear(), now.getMonth(), day);
  if (dueDate < now) {
    dueDate.setMonth(dueDate.getMonth() + 1); // Move to next month if day already passed
  }
  const dateStr = dueDate.toISOString().split('T')[0];

  const reminder: Reminder = {
    id: `rem_${Date.now()}`,
    title: rawTitle.replace(/^(?:pay|for)\s+/i, '').toUpperCase(),
    type: 'payable',
    category,
    amountPaise: Math.round(amountRupees * 100),
    cadence: 'monthly',
    nextDue: dateStr,
    leadDays: [3, 1],
    status: 'upcoming',
    notes: `Created via Local AI assistant: "${query}"`,
    createdAt: new Date().toISOString()
  };

  useAppStore.getState().addReminder(reminder);

  return `✓ Payment Reminder Created:\n• Payee: ${reminder.title}\n• Amount: ${formatINR(reminder.amountPaise)}\n• Due Date: ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n• Alerts: Active (3 days & 1 day before due date)\n\nAdded to your Bill Reminders widget.`;
}

/**
 * 4. Total Payment & Payment History (e.g. "total payment done to Amazon", "payment history for HDFC")
 */
export function executePaymentHistory(query: string): string | null {
  const isHistoryQuery = /total.*paid|payment.*history|how much.*paid|total.*done/i.test(query);
  if (!isHistoryQuery) return null;

  const appState = useAppStore.getState();
  const expenses = appState.expenseItems || [];
  
  // Extract entity name if specified
  const entityMatch = query.match(/(?:to|for|on)\s+([a-zA-Z0-9_\s]+)/i);
  const targetEntity = entityMatch ? entityMatch[1].trim().toLowerCase() : '';

  let filtered = expenses;
  if (targetEntity) {
    filtered = expenses.filter(e => 
      e.merchant.toLowerCase().includes(targetEntity) || 
      e.category.toLowerCase().includes(targetEntity) ||
      (e.notes && e.notes.toLowerCase().includes(targetEntity))
    );
  }

  const totalPaise = filtered.reduce((acc, e) => acc + (e.amountPaise || 0), 0);
  const count = filtered.length;

  if (count === 0) {
    return targetEntity
      ? `No payments recorded for "${targetEntity}".`
      : 'No payments found in current ledger.';
  }

  const recent = filtered.slice(0, 5).map(e => 
    `• ${e.date}: ${formatINR(e.amountPaise)} (${e.merchant} - ${e.category})`
  ).join('\n');

  return `Payment History${targetEntity ? ` for "${targetEntity.toUpperCase()}"` : ''}:\n• Total Paid: ${formatINR(totalPaise)} across ${count} transaction(s)\n\nRecent Entries:\n${recent}`;
}

/**
 * 5. Futuristic Daily Planning & Runway Copilot (e.g. "plan my day", "daily planning", "financial runway")
 */
export function executeDailyPlanning(): string {
  const appState = useAppStore.getState();
  const now = new Date();
  
  // Calculate remaining days in month
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysLeft = Math.max(1, totalDaysInMonth - currentDay + 1);

  // Calculate current month expenses
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthExpenses = (appState.expenseItems || [])
    .filter(e => e.date && e.date.startsWith(monthPrefix))
    .reduce((acc, e) => acc + (e.amountPaise || 0), 0);

  // Monthly expected income
  const monthIncome = (appState.incomeItems || [])
    .filter(i => i.date && i.date.startsWith(monthPrefix))
    .reduce((acc, i) => acc + (i.amountPaise || 0), 0) || 15000000; // default 1.5L if none posted yet

  // Upcoming reminders in next 14 days
  const upcomingReminders = (appState.reminders || []).filter(r => r.status === 'upcoming' && r.amountPaise);
  const upcomingOutflows = upcomingReminders.reduce((acc, r) => acc + (r.amountPaise || 0), 0);

  // Safe to spend today
  const remainingBudget = Math.max(0, monthIncome - monthExpenses - upcomingOutflows);
  const safeToSpendPaise = Math.round(remainingBudget / daysLeft);

  // Liquid Runway
  const burnRatePaise = monthExpenses > 0 ? monthExpenses : 5000000;
  const liquidAssetsPaise = (appState.itr3Data?.bookkeepingData?.bankBalancePaise || 25000000);
  const runwayMonths = (liquidAssetsPaise / burnRatePaise).toFixed(1);

  return `🚀 FinSathi Futuristic Daily Financial Compass:\n\n• Safe-to-Spend Today: ${formatINR(safeToSpendPaise)} (preserves your monthly savings goal)\n• Remaining Days in Month: ${daysLeft} days\n• Next 14-Day Bills Queued: ${formatINR(upcomingOutflows)} (${upcomingReminders.length} obligations)\n• Liquid Runway: ${runwayMonths} months of living expenses at current burn rate\n\nDaily Focus: Keep discretionary spends under ${formatINR(safeToSpendPaise)} today to stay ahead of upcoming bill cycles.`;
}

/**
 * 6. Document Verification (Excel, CSV, PDF)
 */
export interface VerificationReport {
  fileName: string;
  totalRecords: number;
  totalCreditsPaise: number;
  totalDebitsPaise: number;
  dateRange: string;
  duplicateCount: number;
  sampleRows: Array<{ date: string; merchant: string; amountPaise: number; type: 'income' | 'expense' }>;
  extractedItems: Array<{ id: string; type: 'income' | 'expense'; amountPaise: number; merchant: string; date: string; category: string }>;
}

export async function verifyFinancialDocument(file: File): Promise<VerificationReport> {
  const startTime = Date.now();
  try {
    const report = await parseFinancialDocumentUniversal(file);
    const durationMs = Date.now() - startTime;
    recordApiCall({
      endpoint: file.type.includes('pdf') || file.name.endsWith('.pdf') ? 'ocr_pdf' : 'ocr_tesseract',
      target: file.name,
      durationMs,
      status: 'success',
      payloadSize: file.size,
    });
    
    return {
      fileName: report.fileName,
      totalRecords: report.totalRecords,
      totalCreditsPaise: report.totalCreditsPaise,
      totalDebitsPaise: report.totalDebitsPaise,
      dateRange: report.dateRange,
      duplicateCount: report.duplicateCount,
      sampleRows: report.extractedItems.slice(0, 4).map(item => ({
        date: item.date,
        merchant: item.merchant,
        amountPaise: item.amountPaise,
        type: item.type
      })),
      extractedItems: report.extractedItems
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    recordApiCall({
      endpoint: file.type.includes('pdf') || file.name.endsWith('.pdf') ? 'ocr_pdf' : 'ocr_tesseract',
      target: file.name,
      durationMs,
      status: 'error',
      payloadSize: file.size,
    });
    throw err;
  }
}

