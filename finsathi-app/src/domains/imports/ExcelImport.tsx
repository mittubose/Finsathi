import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../../shared/hooks/useAppStore';
import { auditLog } from '../../shared/hooks/useAuditStore';
import { toPaise } from '../../shared/lib/currency';
import { getCurrentFY } from '../../shared/lib/dates';
import { Tabs, TabPanel } from '../../shared/ui/Tabs';
import './ExcelImport.css';

interface ParsedRow {
  raw: Record<string, unknown>;
  mapped?: {
    date: string;
    amount: number;
    label: string;
    category?: string;
    type?: 'income' | 'expense';
  };
  error?: string;
}

interface SheetInfo {
  name: string;
  rows: Record<string, unknown>[];
  headers: string[];
}

export function ExcelImport() {
  const { addIncome, addExpense } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{ ok: number; err: number } | null>(null);

  // Column mapping
  const [colDate, setColDate] = useState('');
  const [colAmount, setColAmount] = useState('');
  const [colLabel, setColLabel] = useState('');
  const [colCategory, setColCategory] = useState('');
  const [rowType, setRowType] = useState<'income' | 'expense'>('expense');

  const handleFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setImportDone(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetInfos: SheetInfo[] = workbook.SheetNames.map((name) => {
        const ws = workbook.Sheets[name];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { name, rows, headers };
      });
      setSheets(sheetInfos);
      setActiveSheet(sheetInfos[0]?.name || '');
      // Auto-detect columns
      const headers = sheetInfos[0]?.headers || [];
      autoDetect(headers);
    };
    reader.readAsArrayBuffer(file);
  };

  const autoDetect = (headers: string[]) => {
    const find = (keywords: string[]) =>
      headers.find((h) => keywords.some((k) => h.toLowerCase().includes(k))) || '';
    setColDate(find(['date', 'day', 'time', 'on', 'posted']));
    setColAmount(find(['amount', 'amt', 'value', 'price', 'debit', 'credit', 'sum']));
    setColLabel(find(['desc', 'note', 'narration', 'particular', 'merchant', 'name', 'label']));
    setColCategory(find(['category', 'cat', 'type', 'head', 'group']));
  };

  const currentSheet = sheets.find((s) => s.name === activeSheet);

  const handlePreview = () => {
    if (!currentSheet || !colDate || !colAmount) return;
    const rows = currentSheet.rows.slice(0, 50).map((row): ParsedRow => {
      const rawDate = String(row[colDate] || '').trim();
      const rawAmt = parseFloat(String(row[colAmount] || '0').replace(/[^0-9.-]/g, ''));
      const label = colLabel ? String(row[colLabel] || '').trim() : 'Imported';
      const category = colCategory ? String(row[colCategory] || '').trim() : '';

      if (!rawDate || isNaN(rawAmt)) {
        return { raw: row, error: `Missing date or invalid amount` };
      }

      // Try to parse date
      let parsedDate = '';
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        } else {
          return { raw: row, error: `Cannot parse date: ${rawDate}` };
        }
      } catch {
        return { raw: row, error: `Cannot parse date: ${rawDate}` };
      }

      return {
        raw: row,
        mapped: { date: parsedDate, amount: Math.abs(rawAmt), label, category },
      };
    });
    setParsedRows(rows);
  };

  const handleImport = () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    const fy = getCurrentFY();
    let ok = 0, err = 0;

    for (const row of parsedRows) {
      if (!row.mapped || row.error) { err++; continue; }
      const { date, amount, label, category } = row.mapped;
      const amtPaise = toPaise(amount);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      try {
        if (rowType === 'income') {
          addIncome({
            id, type: 'income', head: 'other', amountPaise: amtPaise, source: label,
            fy, isTaxable: true, notes: `Excel import: ${fileName}`, tags: [],
            date, createdAt: new Date().toISOString(),
          });
        } else {
          addExpense({
            id, type: 'expense', category: category || 'Other', amountPaise: amtPaise,
            date, merchant: label, notes: `Excel import: ${fileName}`, tags: [],
            isRecurring: false, createdAt: new Date().toISOString(),
          });
        }
        ok++;
      } catch {
        err++;
      }
    }

    auditLog({
      action: 'IMPORT', entity: 'import',
      label: `Excel Import — ${fileName}`,
      details: `${ok} rows imported, ${err} errors`,
    });

    setImporting(false);
    setImportDone({ ok, err });
    setParsedRows([]);
    setSheets([]);
    setFileName('');
  };

  const validRows = parsedRows.filter((r) => r.mapped && !r.error);
  const errorRows = parsedRows.filter((r) => r.error);

  return (
    <div className="excel-import">
      <div className="excel-header">
        <h2 className="text-headline-md">EXCEL_IMPORT</h2>
        <span className="text-label-mono color-muted">.XLSX / .XLS</span>
      </div>

      {/* Upload */}
      {sheets.length === 0 && (
        <div
          className="excel-dropzone glass-surface"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'rgba(255,255,255,0.12)', fontVariationSettings: "'wght' 200" }}>
            table_view
          </span>
          <span className="text-label-mono color-muted" style={{ marginTop: '8px' }}>DROP_EXCEL_OR_CLICK</span>
          <span className="text-label-mono-sm color-muted">.XLSX · .XLS FILES ONLY</span>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* Sheet Selector */}
      {sheets.length > 0 && (
        <div className="glass-surface excel-sheet-section">
          <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <span className="text-label-mono color-subtle">FILE: {fileName}</span>
            <button className="excel-reset-btn" onClick={() => { setSheets([]); setFileName(''); setParsedRows([]); setImportDone(null); }}>
              CHANGE FILE
            </button>
          </div>
          {sheets.length > 1 && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Tabs
                tabs={sheets.map((s) => ({ id: s.name, label: s.name }))}
                activeTab={activeSheet}
                onChange={(id) => { setActiveSheet(id); autoDetect(sheets.find((s) => s.name === id)?.headers || []); }}
              />
            </div>
          )}
          <div className="excel-sheet-info">
            <span className="text-label-mono-sm color-muted">{currentSheet?.rows.length} ROWS · {currentSheet?.headers.length} COLUMNS</span>
          </div>
        </div>
      )}

      {/* Column Mapping */}
      {sheets.length > 0 && (
        <div className="glass-surface excel-mapping">
          <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <span className="text-label-mono color-subtle">COLUMN_MAPPING</span>
          </div>
          <div className="excel-mapping-grid">
            <div className="excel-map-field">
              <label className="text-label-mono-sm color-muted">DATE_COLUMN *</label>
              <select className="excel-select" value={colDate} onChange={(e) => setColDate(e.target.value)}>
                <option value="">-- Select --</option>
                {currentSheet?.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="excel-map-field">
              <label className="text-label-mono-sm color-muted">AMOUNT_COLUMN *</label>
              <select className="excel-select" value={colAmount} onChange={(e) => setColAmount(e.target.value)}>
                <option value="">-- Select --</option>
                {currentSheet?.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="excel-map-field">
              <label className="text-label-mono-sm color-muted">DESCRIPTION_COLUMN</label>
              <select className="excel-select" value={colLabel} onChange={(e) => setColLabel(e.target.value)}>
                <option value="">-- None --</option>
                {currentSheet?.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="excel-map-field">
              <label className="text-label-mono-sm color-muted">CATEGORY_COLUMN</label>
              <select className="excel-select" value={colCategory} onChange={(e) => setColCategory(e.target.value)}>
                <option value="">-- None --</option>
                {currentSheet?.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="excel-map-field">
              <label className="text-label-mono-sm color-muted">IMPORT_AS</label>
              <div className="excel-type-toggle">
                {(['income', 'expense'] as const).map((t) => (
                  <button key={t} className={`excel-type-btn ${rowType === t ? 'active' : ''}`} onClick={() => setRowType(t)}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: '0 12px 12px' }}>
            <button className="excel-preview-btn" onClick={handlePreview} disabled={!colDate || !colAmount}>
              <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>preview</span>
              PREVIEW (FIRST 50 ROWS)
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {parsedRows.length > 0 && (
        <div className="glass-surface excel-preview">
          <div className="glass-card-header" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <span className="text-label-mono color-subtle">PREVIEW</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="text-label-mono-sm color-positive">{validRows.length} OK</span>
              {errorRows.length > 0 && <span className="text-label-mono-sm color-negative">{errorRows.length} ERRORS</span>}
            </div>
          </div>
          <div className="excel-preview-table-header">
            <span>DATE</span><span>AMOUNT</span><span>LABEL</span><span>CATEGORY</span><span>STATUS</span>
          </div>
          {parsedRows.map((row, i) => (
            <div key={i} className={`glass-row excel-preview-row ${row.error ? 'excel-preview-row--error' : ''}`}>
              <span className="text-label-mono-sm">{row.mapped?.date || '—'}</span>
              <span className="text-label-mono-sm">{row.mapped?.amount ? `₹${row.mapped.amount}` : '—'}</span>
              <span className="text-body" style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.mapped?.label || '—'}
              </span>
              <span className="text-label-mono-sm color-muted">{row.mapped?.category || '—'}</span>
              <span className={`text-label-mono-sm ${row.error ? 'color-negative' : 'color-positive'}`}>
                {row.error ? '✗ ' + row.error : '✓ OK'}
              </span>
            </div>
          ))}
          <div style={{ padding: '12px' }}>
            <button className="excel-import-btn" onClick={handleImport} disabled={importing || validRows.length === 0}>
              <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'wght' 300" }}>upload</span>
              IMPORT {validRows.length} ROWS
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {importDone && (
        <div className="glass-surface-elevated excel-done">
          <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary-container)' }}>check_circle</span>
          <span className="text-headline-md color-positive" style={{ marginTop: '8px' }}>IMPORT_COMPLETE</span>
          <span className="text-label-mono-sm color-muted">{importDone.ok} IMPORTED · {importDone.err} ERRORS</span>
        </div>
      )}
    </div>
  );
}
