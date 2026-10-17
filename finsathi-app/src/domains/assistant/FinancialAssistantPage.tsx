import React, { useState, useRef, useEffect } from 'react';
import { executeMcpTool } from '../../shared/lib/mcp';
import {
  queryLocalOllama,
  executeSalaryUpdate,
  executeTaxPaidQuery,
  executePaymentReminder,
  executePaymentHistory,
  executeDailyPlanning,
  verifyFinancialDocument,
  type VerificationReport
} from '../../shared/lib/localAi';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { formatINR } from '../../shared/lib/currency';
import { useToast } from '../../shared/ui/Toast';
import { FinSathiLogo } from '../../shared/ui/FinSathiLogo';
import './FinancialAssistantPage.css';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  toolCall?: { name: string; result?: any };
  verificationReport?: VerificationReport;
  timestamp: string;
}

const PROMPT_SUGGESTIONS = [
  {
    category: 'COMPENSATION',
    icon: 'payments',
    title: 'Salary & CTC',
    prompt: 'Update salary to 20LPA',
    description: 'Auto-calculates Basic, HRA, Special Allowance & Take-home',
  },
  {
    category: 'TAX & COMPLIANCE',
    icon: 'account_balance',
    title: 'Tax Liability',
    prompt: 'How much tax I paid last year?',
    description: 'Calculates TDS, advance tax, and regime savings',
  },
  {
    category: 'OBLIGATIONS',
    icon: 'notifications_active',
    title: 'Card & Bill Reminder',
    prompt: 'Set reminder for HDFC credit card 25000 due on 25th',
    description: 'Tracks credit cards, SIPs, insurance premiums & EMIs',
  },
  {
    category: 'MERCHANT AUDIT',
    icon: 'search_insights',
    title: 'Spend History',
    prompt: 'Total payment done to Amazon',
    description: 'Aggregates multi-account merchant outflows & frequency',
  },
  {
    category: 'RUNWAY COPILOT',
    icon: 'flight_takeoff',
    title: 'Daily Safe-to-Spend',
    prompt: 'Plan my day',
    description: 'Computes daily discretionary cap & months of runway',
  },
  {
    category: 'OCR & AUDIT',
    icon: 'document_scanner',
    title: 'Bank Statement OCR',
    prompt: 'Verify attached statement or receipt',
    description: 'Parses PDF tables & scanned receipt photos on device',
  },
];

export function FinancialAssistantPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm_welcome',
      sender: 'assistant',
      text: 'Hello! I am your FinSathi Local Financial Assistant.\n\nI run 100% on your device with zero cloud tracking. You can ask me to update CTC, query tax, schedule credit card reminders, calculate daily runway, or upload PDF/image receipts for instant OCR verification.\n\nClick any prompt card above or type below to begin.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOllamaReady, setIsOllamaReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Ollama status on mount
  useEffect(() => {
    const url = localStorage.getItem('finsathi_ollama_url') || 'http://127.0.0.1:11434';
    fetch(`${url}/api/tags`, { method: 'GET' })
      .then((r) => r.ok && setIsOllamaReady(true))
      .catch(() => setIsOllamaReady(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Check for salary update intent
      const salaryRes = executeSalaryUpdate(textToSend);
      if (salaryRes) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: salaryRes,
            toolCall: { name: 'update_salary' },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        toast('Salary structure updated successfully', 'success');
        return;
      }

      // 2. Check for tax query
      const taxRes = executeTaxPaidQuery(textToSend);
      if (taxRes) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: taxRes,
            toolCall: { name: 'query_tax' },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      // 3. Check for payment reminder
      const reminderRes = executePaymentReminder(textToSend);
      if (reminderRes) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: reminderRes,
            toolCall: { name: 'set_reminder' },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        toast('Payment reminder queued', 'success');
        return;
      }

      // 4. Check for merchant spend history
      const historyRes = executePaymentHistory(textToSend);
      if (historyRes) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: historyRes,
            toolCall: { name: 'payment_history' },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      // 5. Check for daily planning
      if (/plan|runway|safe|today|budget/i.test(textToSend)) {
        const planRes = executeDailyPlanning();
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: planRes,
            toolCall: { name: 'daily_planning' },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      // 6. Fallback to local Ollama LLM
      const ollamaUrl = localStorage.getItem('finsathi_ollama_url') || 'http://127.0.0.1:11434';
      const ollamaModel = localStorage.getItem('finsathi_ollama_model') || 'llama3';

      const ollamaRes = await queryLocalOllama(textToSend, {
        ollamaUrl,
        model: ollamaModel,
        enabled: true,
      });

      if (ollamaRes.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: ollamaRes.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `Understood: "${textToSend}". I processed this with FinSathi's local heuristics engine. For unstructured general Q&A, you can launch Ollama on your machine (\`ollama run llama3\`).`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: `Error processing request: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: `📎 Attached file for verification: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const report = await verifyFinancialDocument(file);
      const asstMsg: Message = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: `Statement Verified: "${file.name}"\n• Records Extracted: ${report.totalRecords}\n• Total Credits: ${formatINR(report.totalCreditsPaise)}\n• Total Debits: ${formatINR(report.totalDebitsPaise)}\n• Period: ${report.dateRange}\n• Potential Duplicates: ${report.duplicateCount}`,
        verificationReport: report,
        toolCall: { name: 'verify_statement', result: report },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, asstMsg]);
      toast(`Successfully parsed ${report.totalRecords} records from ${file.name}`, 'success');
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: `Document verification failed: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      toast('OCR parsing error', 'error');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportVerifiedData = (report: VerificationReport) => {
    if (!report.extractedItems || report.extractedItems.length === 0) return;

    const store = useAppStore.getState();
    let importedCount = 0;

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
          notes: 'Imported via Financial AI statement verification',
          tags: ['ai-imported'],
          date: item.date,
          createdAt: new Date().toISOString(),
        });
        importedCount++;
      } else {
        store.addExpense({
          id: item.id,
          type: 'expense',
          category: (item.category as any) || 'Other',
          amountPaise: item.amountPaise,
          merchant: item.merchant,
          notes: 'Imported via Financial AI statement verification',
          tags: ['ai-imported'],
          date: item.date,
          isRecurring: false,
          createdAt: new Date().toISOString(),
        });
        importedCount++;
      }
    }

    toast(`Imported ${importedCount} transactions into Ledger`, 'success');
  };

  return (
    <div className="asst-page">
      {/* Header */}
      <div className="asst-header">
        <div className="asst-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FinSathiLogo size={28} glow />
            <h1 className="text-headline-md" style={{ margin: 0 }}>LOCAL_FINANCIAL_AI_ASSISTANT</h1>
          </div>
          <span className="text-label-mono color-muted">
            100% PRIVATE • ZERO CLOUD TELEMETRY • IN-BROWSER PARSER & OCR
          </span>
        </div>

        <div className="asst-status-row">
          <div className={`asst-badge ${isOllamaReady ? 'asst-badge--online' : ''}`}>
            <span className="asst-badge--pulse" />
            <span>{isOllamaReady ? 'OLLAMA READY (11434)' : 'DETERMINISTIC FALLBACK (0ms)'}</span>
          </div>
          <div className="asst-badge">
            <span className="material-symbols-outlined icon-xs">lock</span>
            <span>AIR-GAPPED DATA</span>
          </div>
        </div>
      </div>

      {/* Capabilities Showcase & Clickable Prompts */}
      <div className="asst-capabilities-grid">
        {PROMPT_SUGGESTIONS.map((item) => (
          <div
            key={item.title}
            className="asst-cap-card"
            onClick={() => handleSend(item.prompt)}
            role="button"
            tabIndex={0}
          >
            <div className="asst-cap-header">
              <span className="material-symbols-outlined asst-cap-icon">{item.icon}</span>
              <span className="text-body-bold" style={{ fontSize: '13px' }}>{item.title}</span>
              <span className="asst-cap-pill">{item.category}</span>
            </div>
            <div className="asst-cap-prompt">↳ "{item.prompt}"</div>
            <span className="text-label-mono-xs color-muted">{item.description}</span>
          </div>
        ))}
      </div>

      {/* Chat Conversation Panel */}
      <div className="asst-chat-panel">
        <div className="asst-chat-messages" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`asst-msg asst-msg--${msg.sender}`}>
              <div className="asst-msg-bubble">{msg.text}</div>

              {msg.verificationReport && (
                <div className="asst-tool-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-label-mono-sm color-positive">
                      ⚡ {msg.verificationReport.extractedItems.length} TRANSACTIONS EXTRACTED
                    </span>
                    <button
                      className="settings-action-btn"
                      onClick={() => handleImportVerifiedData(msg.verificationReport!)}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      [POST ALL TO LEDGER]
                    </button>
                  </div>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
                    {msg.verificationReport.sampleRows.map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{row.date} · {row.merchant}</span>
                        <span style={{ color: row.type === 'income' ? 'var(--positive, #00ff41)' : 'var(--error, #ff4d4d)' }}>
                          {formatINR(row.amountPaise)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="asst-msg-meta">
                <span>{msg.sender === 'user' ? 'YOU' : 'FINSATHI AI'}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="asst-msg asst-msg--assistant">
              <div className="asst-msg-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined icon-sm spin">sync</span>
                <span className="text-label-mono-sm color-muted">Thinking & analyzing local financial records...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="asst-chat-input-bar">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
          />

          <button
            className="asst-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach bank PDF or receipt image for OCR"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>attach_file</span>
          </button>

          <input
            className="asst-input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything: 'Update salary to 20LPA', 'Plan my day', or upload a receipt..."
            disabled={isLoading}
          />

          <button
            className="asst-send-btn"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
          >
            <span>SEND</span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
