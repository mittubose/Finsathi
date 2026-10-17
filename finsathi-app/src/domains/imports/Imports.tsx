import React, { useState, useRef } from 'react';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { toPaise } from '../../shared/lib/currency';
import { classifyTrade } from '../tax/engine';
import { holdingDays } from '../../shared/lib/dates';
import { SmartImport } from './SmartImport';
import { DocsSync } from './DocsSync';
import './Imports.css';

type ImportType = 'income' | 'expense' | 'trade';

interface ParsedRow {
  raw: string[];
  parsed: Record<string, string>;
  valid: boolean;
  error?: string;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const TEMPLATES: Record<ImportType, { headers: string[]; example: string }> = {
  income: {
    headers: ['date', 'head', 'amount', 'source', 'notes'],
    example: '2025-04-15,salary,50000,Acme Corp,April salary',
  },
  expense: {
    headers: ['date', 'category', 'amount', 'merchant', 'notes'],
    example: '2025-04-16,Food,450,Swiggy,Lunch',
  },
  trade: {
    headers: ['instrument', 'buy_date', 'sell_date', 'qty', 'buy_price', 'sell_price', 'charges'],
    example: 'RELIANCE,2024-06-15,2025-04-10,10,2500,2800,50',
  },
};

export function Imports() {
  const { addIncome, addExpense, addTrade } = useAppStore();
  const [importType, setImportType] = useState<ImportType>('income');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim());
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => { record[h] = cells[idx] || ''; });

      let valid = true;
      let error: string | undefined;

      if (importType === 'income' || importType === 'expense') {
        if (!record.date || !record.amount || isNaN(Number(record.amount))) {
          valid = false;
          error = 'MISSING_DATA';
        }
      } else {
        if (!record.instrument || !record.buy_date || !record.sell_date || !record.qty || !record.buy_price || !record.sell_price) {
          valid = false;
          error = 'FIELDS_MISSING';
        }
      }

      rows.push({ raw: cells, parsed: record, valid, error });
    }
    return rows;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImported(false);
    setIsScanning(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Simulate scanning for "Retro-Terminal" feel
      setTimeout(() => {
        const rows = parseCSV(text);
        setParsed(rows);
        setIsScanning(false);
      }, 800);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const validRows = parsed.filter((r) => r.valid);
    const now = new Date().toISOString();

    for (const row of validRows) {
      const d = row.parsed;
      if (importType === 'income') {
        addIncome({
          id: generateId(),
          type: 'income',
          head: (d.head || 'other') as any,
          amountPaise: toPaise(Number(d.amount)),
          source: d.source || '',
          fy: '',
          isTaxable: true,
          notes: d.notes || '',
          tags: [],
          date: d.date,
          createdAt: now,
        });
      } else if (importType === 'expense') {
        addExpense({
          id: generateId(),
          type: 'expense',
          category: d.category || 'Other',
          amountPaise: toPaise(Number(d.amount)),
          date: d.date,
          merchant: d.merchant || '',
          notes: d.notes || '',
          tags: [],
          isRecurring: false,
          createdAt: now,
        });
      } else {
        const bDate = new Date(d.buy_date);
        const sDate = new Date(d.sell_date);
        const q = Number(d.qty);
        const bp = toPaise(Number(d.buy_price));
        const sp = toPaise(Number(d.sell_price));
        const ch = toPaise(Number(d.charges) || 0);
        const cls = classifyTrade(bDate, sDate);
        addTrade({
          id: generateId(),
          type: 'trade',
          accountId: 'default',
          instrument: d.instrument.toUpperCase(),
          buyDate: d.buy_date,
          sellDate: d.sell_date,
          qty: q,
          buyPricePaise: bp,
          sellPricePaise: sp,
          chargesPaise: ch,
          assetType: 'equity',
          classification: cls,
          realizedPnlPaise: (sp - bp) * q - ch,
          notes: '',
          createdAt: now,
        });
      }
    }

    setImported(true);
  };

  const template = TEMPLATES[importType];
  const validCount = parsed.filter((r) => r.valid).length;
  const errorCount = parsed.filter((r) => !r.valid).length;

  const [importMode, setImportMode] = useState<'smart' | 'csv' | 'docs'>('smart');

  return (
    <div className="imports" role="main" aria-label="Data Imports">
      <div className="imports-header">
        <h1 className="text-headline-md">IMPORTS</h1>
        <span className="text-label-mono color-muted">SYSTEM_INGEST_V2</span>
      </div>

      {/* Mode Tab */}
      <div className="imports-mode-tabs">
        <button
          className={`imports-mode-tab ${importMode === 'smart' ? 'active' : ''}`}
          onClick={() => setImportMode('smart')}
        >
          <span className="material-symbols-outlined icon-xs" style={{ fontVariationSettings: "'wght' 200" }}>auto_awesome</span>
          SMART_IMPORT
        </button>
        <button
          className={`imports-mode-tab ${importMode === 'csv' ? 'active' : ''}`}
          onClick={() => setImportMode('csv')}
        >
          <span className="material-symbols-outlined icon-xs" style={{ fontVariationSettings: "'wght' 200" }}>table_rows</span>
          CSV_IMPORT
        </button>
        <button
          className={`imports-mode-tab ${importMode === 'docs' ? 'active' : ''}`}
          onClick={() => setImportMode('docs')}
        >
          <span className="material-symbols-outlined icon-xs" style={{ fontVariationSettings: "'wght' 200" }}>description</span>
          DOCS_SYNC
        </button>
      </div>

      {/* Smart Import */}
      {importMode === 'smart' && <SmartImport />}

      {/* Docs Sync */}
      {importMode === 'docs' && <DocsSync />}

      {/* CSV Import (existing) */}
      {importMode === 'csv' && (
        <div className="imports-csv-body">
      {/* Type Selector */}
      <nav className="imports-type-selector" aria-label="Import Categories">
        {(['income', 'expense', 'trade'] as ImportType[]).map((t) => (
          <button
            key={t}
            className={`imports-type-btn ${importType === t ? 'active' : ''}`}
            onClick={() => { setImportType(t); setParsed([]); setImported(false); setFileName(''); }}
            aria-pressed={importType === t}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* Template Info */}
      <section className="glass-surface imports-template" aria-labelledby="template-header">
        <div className="glass-card-header" id="template-header">
          <span className="text-label-mono color-subtle">CSV_STRUCTURE</span>
          <span className="text-label-mono-sm color-muted">{importType.toUpperCase()}</span>
        </div>
        <div className="imports-template-body">
          <div className="text-label-mono-sm color-muted" style={{ marginBottom: '4px' }}>EXPECTED_HEADERS:</div>
          <code className="imports-code">{template.headers.join(',')}</code>
          <div className="text-label-mono-sm color-muted" style={{ marginTop: '12px', marginBottom: '4px' }}>EXAMPLE_ROW:</div>
          <code className="imports-code">{template.example}</code>
        </div>
      </section>

      {/* Upload Area */}
      <div
        className={`imports-upload glass-surface ${isScanning ? 'is-scanning' : ''}`}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        aria-label="Upload CSV File"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        {isScanning ? (
          <div className="scanning-pulse">
            <span className="text-label-mono color-positive">SCANNING_FILE...</span>
          </div>
        ) : (
          <React.Fragment>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'rgba(255,255,255,0.2)' }}>
              {fileName ? 'refresh' : 'upload_file'}
            </span>
            <span className="text-label-mono color-muted" style={{ marginTop: '8px' }}>
              {fileName || 'DROP_CSV_OR_CLICK'}
            </span>
            <span className="text-label-mono-sm color-muted" style={{ marginTop: '4px' }}>
              {fileName ? 'CLICK_TO_REPLACE' : 'COMPLIANT_.CSV_ONLY'}
            </span>
          </React.Fragment>
        )}
      </div>

      {/* Preview */}
      {parsed.length > 0 && !isScanning && (
        <section className="glass-surface imports-preview animate-in" aria-label="Import Preview">
          <div className="glass-card-header">
            <span className="text-label-mono color-subtle">INGESTION_PREVIEW</span>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="status-pill positive">
                <span className="text-label-mono-sm">{validCount} VALID</span>
              </div>
              {errorCount > 0 && (
                <div className="status-pill negative">
                  <span className="text-label-mono-sm">{errorCount} ERRORS</span>
                </div>
              )}
            </div>
          </div>
          <div className="imports-preview-table">
            <div className="preview-header-row">
              <span className="text-label-mono-sm color-muted" style={{ width: '24px' }}>#</span>
              <span className="text-label-mono-sm color-muted" style={{ flex: 1 }}>RAW_DATA_STREAM</span>
              <span className="text-label-mono-sm color-muted" style={{ width: '60px' }}>STATUS</span>
            </div>
            {parsed.slice(0, 50).map((row, i) => (
              <div key={i} className={`glass-row imports-preview-row ${!row.valid ? 'imports-preview-row--error' : ''}`}>
                <span className="text-label-mono-sm" style={{ width: '24px', color: 'rgba(255,255,255,0.2)' }}>
                  {(i + 1).toString().padStart(2, '0')}
                </span>
                <span className="text-body truncate" style={{ flex: 1, fontSize: '11px', letterSpacing: '0.02em' }}>
                  {row.raw.join(' │ ')}
                </span>
                <div style={{ width: '60px', display: 'flex', justifyContent: 'flex-end' }}>
                  {!row.valid ? (
                    <span className="text-label-mono-sm color-negative" title={row.error}>{row.error}</span>
                  ) : (
                    <span className="material-symbols-outlined icon-xs color-positive">check</span>
                  )}
                </div>
              </div>
            ))}
            {parsed.length > 50 && (
              <div className="text-label-mono-sm color-muted" style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                OVERFLOW: + {parsed.length - 50} ADDITIONAL_RECORDS_HIDDEN
              </div>
            )}
          </div>

          {!imported ? (
            <div className="imports-actions">
              <button 
                className="btn-primary" 
                onClick={handleImport}
                disabled={validCount === 0}
              >
                EXECUTE_IMPORT [{validCount}]
              </button>
              <button className="btn-secondary" onClick={() => { setParsed([]); setFileName(''); }}>
                ABORT_SEQUENCE
              </button>
            </div>
          ) : (
            <div className="imports-success">
              <span className="material-symbols-outlined color-positive">verified</span>
              <span className="text-label-mono color-positive">INGESTION_COMPLETE: {validCount} RECORDS_ARCHIVED</span>
            </div>
          )}
        </section>
      )}
        </div>
      )}
    </div>
  );
}
