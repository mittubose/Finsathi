import React, { useState, useRef, useEffect } from 'react';
import { executeMcpTool } from '../lib/mcp';
import { 
  queryLocalOllama, 
  executeSalaryUpdate, 
  executeTaxPaidQuery, 
  executePaymentReminder, 
  executePaymentHistory, 
  executeDailyPlanning,
  verifyFinancialDocument,
  type VerificationReport
} from '../lib/localAi';
import { useAppStore } from '../hooks/useAppStore';
import { useProfileStore } from '../hooks/useProfileStore';
import { deepRecoverAccountData, getAccountChecklist } from '../lib/profileDataManager';
import { formatINR } from '../lib/currency';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  toolCall?: { name: string; result?: any };
  verificationReport?: VerificationReport;
  timestamp: string;
}

export function LocalAiChatWidget() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm_welcome',
      sender: 'assistant',
      text: 'FinSathi Financial AI ready.\n\nTry asking:\n• "Update salary to 20LPA"\n• "How much tax I paid last year?"\n• "Set reminder for HDFC credit card 25000 due on 25th"\n• "Total payment done to Amazon"\n• "Plan my day" (futuristic daily safe-to-spend compass)\n• Or click 📎 to verify a statement (PDF/Excel/CSV)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: `📎 Attached file: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Please verify data.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const report = await verifyFinancialDocument(file);
      const asstMsg: Message = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: `Statement Verified: "${file.name}"\n• Records Found: ${report.totalRecords}\n• Total Credits (Inflow): ${formatINR(report.totalCreditsPaise)}\n• Total Debits (Outflow): ${formatINR(report.totalDebitsPaise)}\n• Date Span: ${report.dateRange}\n• Potential Duplicates: ${report.duplicateCount}`,
        verificationReport: report,
        toolCall: { name: 'verify_statement', result: report },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, asstMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: `Failed to verify file: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportVerifiedData = (report: VerificationReport) => {
    if (!report.extractedItems || report.extractedItems.length === 0) return;

    const store = useAppStore.getState();
    for (const item of report.extractedItems) {
      if (item.type === 'income') {
        store.addIncome({
          id: item.id,
          type: 'income',
          head: 'other',
          amountPaise: item.amountPaise,
          source: item.merchant,
          fy: store.currentFY,
          isTaxable: true,
          notes: `Imported via AI statement verification`,
          tags: ['ai-imported'],
          date: item.date,
          createdAt: new Date().toISOString()
        });
      } else {
        store.addExpense({
          id: item.id,
          type: 'expense',
          category: item.category,
          amountPaise: item.amountPaise,
          merchant: item.merchant,
          date: item.date,
          notes: `Imported via AI statement verification`,
          tags: ['ai-imported'],
          isRecurring: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    setMessages(prev => [
      ...prev,
      {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: `✓ Successfully imported ${report.extractedItems.length} transactions from "${report.fileName}" into your ledger!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Task: Update Salary
      const salaryReply = executeSalaryUpdate(prompt);
      if (salaryReply) {
        setMessages(prev => [...prev, {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: salaryReply,
          toolCall: { name: 'update_salary_structure' },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsLoading(false);
        return;
      }

      // 2. Task: Tax Paid Query
      const taxReply = executeTaxPaidQuery(prompt);
      if (taxReply) {
        setMessages(prev => [...prev, {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: taxReply,
          toolCall: { name: 'query_tax_paid' },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsLoading(false);
        return;
      }

      // 3. Task: Payment Reminder
      const reminderReply = executePaymentReminder(prompt);
      if (reminderReply) {
        setMessages(prev => [...prev, {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: reminderReply,
          toolCall: { name: 'create_payment_reminder' },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsLoading(false);
        return;
      }

      // 4. Task: Payment History & Total Paid
      const historyReply = executePaymentHistory(prompt);
      if (historyReply) {
        setMessages(prev => [...prev, {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: historyReply,
          toolCall: { name: 'query_payment_history' },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsLoading(false);
        return;
      }

      // 5. Task: Futuristic Daily Planning
      if (/daily\s+plan|plan\s+my\s+day|financial\s+runway|futuristic\s+plan|safe\s+to\s+spend/i.test(prompt)) {
        const planReply = executeDailyPlanning();
        setMessages(prev => [...prev, {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: planReply,
          toolCall: { name: 'generate_daily_plan' },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsLoading(false);
        return;
      }

      // 5.1 Task: Data Recovery & Restore
      if (/recover.*data|recover.*recurring|restore.*data|missing.*data|find.*expenses|recover.*expenses/i.test(prompt)) {
        const activeProfId = useProfileStore.getState().activeProfileId;
        const rep = await deepRecoverAccountData(activeProfId);
        const replyText = `✓ Deep Recovery Scan Complete for your account:\n• Recovered Recurring Rules: ${rep.recoveredRecurringRules}\n• Recovered Salary Structures: ${rep.recoveredSalaryRevisions}\n• Recovered Reminders: ${rep.recoveredReminders}\n\n${rep.notes.join('\n') || 'All local storage caches and IndexedDB partitions are verified.'}\n\nYou can also open the Account Vault in Settings or Dashboard to view or rollback 5-point snapshot history.`;
        setMessages(prev => [...prev, {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          toolCall: { name: 'deep_recover_account_data' },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsLoading(false);
        return;
      }

      // 5.2 Task: 80/20 Financial Health Checklist
      if (/checklist|80\s*\/?\s*20|financial\s+health|health\s+score/i.test(prompt)) {
        const activeProfId = useProfileStore.getState().activeProfileId;
        const activeProf = useProfileStore.getState().getActiveProfile();
        const items = getAccountChecklist(activeProfId);
        const completed = items.filter(i => i.completed).length;
        const pct = Math.round((completed / items.length) * 100);
        
        const listText = items.map(i => `${i.completed ? '✓' : '○'} ${i.title} (${i.priority.toUpperCase()})`).join('\n');
        const replyText = `80/20 Financial Health Checklist for "${activeProf.name}":\n• Overall Score: ${pct}% Ready (${completed}/${items.length} pillars)\n\nPillars:\n${listText}\n\nTip: You can manage and mark these off anytime in your Account Vault in Settings or Dashboard.`;

        setMessages(prev => [...prev, {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          toolCall: { name: 'query_account_checklist' },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsLoading(false);
        return;
      }

      // 6. Generic MCP Tool & Local Ollama Execution
      const lower = prompt.toLowerCase();
      let toolName = 'query_ledger';
      let toolArgs: Record<string, any> = { limit: 5 };

      if (/(?:enable|activate|turn on|add|show|disable|turn off|hide)\s+(?:the\s+)?(trades?|trading|salary|tax|reminders?|ai[\s-]?chat|ledger)/i.test(lower)) {
        const isEnable = /enable|activate|turn on|add|show/i.test(lower);
        let widgetType = 'trades';
        if (/trades?|trading/i.test(lower)) widgetType = 'trades';
        else if (/salary/i.test(lower)) widgetType = 'salary';
        else if (/tax/i.test(lower)) widgetType = 'tax';
        else if (/reminders?|bill/i.test(lower)) widgetType = 'reminders';
        else if (/ai/i.test(lower)) widgetType = 'ai-chat';
        else if (/ledger/i.test(lower)) widgetType = 'ledger';

        toolName = 'manage_widget';
        toolArgs = { widgetType, action: isEnable ? 'enable' : 'disable' };
      } else if (/spent|expense|add expense|paid|bought/i.test(lower)) {
        const amtMatch = lower.match(/(?:[0-9]+(?:\.[0-9]+)?)/);
        const amt = amtMatch ? parseFloat(amtMatch[0]) : 100;
        toolName = 'add_transaction';
        toolArgs = {
          type: 'expense',
          amountRupees: amt,
          categoryOrHead: 'General',
          merchantOrSource: lower.replace(/(?:spent|paid|add expense|[0-9]+|on|for)/gi, '').trim() || 'Expense',
        };
      } else if (/summary|overview|status|net worth|finances/i.test(lower)) {
        toolName = 'get_profile_summary';
      }

      const mcpResponse = await executeMcpTool(toolName, toolArgs);
      const parsedToolData = JSON.parse(mcpResponse.content[0].text);

      let replyText = '';
      if (toolName === 'manage_widget') {
        replyText = `✓ ${parsedToolData.message}`;
      } else if (toolName === 'add_transaction') {
        replyText = `Recorded via MCP: ${parsedToolData.message}`;
      } else if (toolName === 'get_profile_summary') {
        const fin = parsedToolData.financials;
        replyText = `Executive Summary (${parsedToolData.profile.name}):\n• Total Income: ₹${fin.totalIncomeINR.toLocaleString('en-IN')}\n• Total Expenses: ₹${fin.totalExpenseINR.toLocaleString('en-IN')}\n• Net Cashflow: ₹${fin.netCashflowINR.toLocaleString('en-IN')}\n• Trading PnL: ₹${fin.realizedTradingPnlINR.toLocaleString('en-IN')}`;
      } else {
        // Fallback to local Ollama if available
        const ollamaRes = await queryLocalOllama(prompt);
        replyText = ollamaRes.text || `Retrieved ${parsedToolData.count || 0} financial records from your active vault.`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          toolCall: { name: toolName },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: `Error processing request: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="local-ai-chat-widget" style={{ display: 'flex', flexDirection: 'column', height: '380px' }}>
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".pdf,.xlsx,.xls,.csv" 
        onChange={handleFileUpload}
      />

      {/* Messages Scroll Area */}
      <div 
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '2px',
          marginBottom: '8px'
        }}
      >
        {messages.map((m) => (
          <div 
            key={m.id} 
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              background: m.sender === 'user' ? 'rgba(0, 255, 65, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${m.sender === 'user' ? 'rgba(0, 255, 65, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '3px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            {m.toolCall && (
              <span 
                style={{
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  color: 'var(--primary-container, #00ff41)',
                  letterSpacing: '0.05em'
                }}
              >
                ⚡ MCP_ACTION: {m.toolCall.name.toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: m.sender === 'user' ? '#fff' : 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
              {m.text}
            </span>

            {/* Verification Report Card with 1-Click Import Button */}
            {m.verificationReport && m.verificationReport.extractedItems.length > 0 && (
              <div style={{ marginTop: '6px', padding: '8px', background: 'rgba(0,255,65,0.06)', border: '1px dashed var(--primary-container)', borderRadius: '3px' }}>
                <span className="text-label-mono-xs color-positive" style={{ display: 'block', marginBottom: '6px' }}>
                  READY FOR LEDGER INGESTION ({m.verificationReport.extractedItems.length} ITEMS)
                </span>
                <button
                  type="button"
                  onClick={() => handleImportVerifiedData(m.verificationReport!)}
                  style={{
                    background: 'var(--primary-container, #00ff41)',
                    color: '#000',
                    border: 'none',
                    padding: '6px 12px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '11px',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                >
                  IMPORT ALL TO LEDGER
                </button>
              </div>
            )}

            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', alignSelf: 'flex-end', fontFamily: 'monospace' }}>
              {m.timestamp}
            </span>
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '6px 10px', fontSize: '11px', color: 'var(--primary-container)', fontFamily: 'monospace' }}>
            ⚡ PROCESSING FINANCIAL COPILOT TASK...
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload statement (PDF, Excel, CSV) to verify"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--primary-container, #00ff41)',
            padding: '0 8px',
            borderRadius: '2px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            attach_file
          </span>
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI ('update salary to 20LPA', 'tax paid', 'plan my day')..."
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white',
            padding: '8px 10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            borderRadius: '2px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            background: 'var(--primary-container, #00ff41)',
            color: '#000',
            border: 'none',
            borderRadius: '2px',
            padding: '0 12px',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
            opacity: isLoading || !input.trim() ? 0.5 : 1
          }}
        >
          SEND
        </button>
      </form>
    </div>
  );
}
