/**
 * Document Intelligence Unit (DIU)
 * Hardened Broker Import Engine using XLSX
 */

import * as XLSX from 'xlsx';

export type DocumentIntent =
  | 'payslip'
  | 'form16'
  | 'bank_statement'
  | 'broker_statement'
  | 'utility_bill'
  | 'subscription_invoice'
  | 'tax_notice'
  | 'unknown';

export interface ExtractedField {
  key: string;
  label: string;
  rawValue: string;
  value: string | number | null;
  confidence: number;
  source: string;
}

export interface DetectionResult {
  intent: DocumentIntent;
  intentLabel: string;
  intentDescription: string;
  whyItMatters: string;
  confidence: number;
  metadata: any;
  fields: ExtractedField[];
  records: any[];
  summarizedData?: any;
  mappingReport?: any;
  rawText: string;
  warnings: string[];
  fileType?: string;
  format?: string;
}

const INTENT_META: Record<DocumentIntent, { label: string; description: string; whyItMatters: string }> = {
  payslip: { label: 'Monthly Payslip', description: 'This looks like a monthly salary slip.', whyItMatters: 'Source of truth for salary income.' },
  form16: { label: 'Form 16 (TDS Certificate)', description: 'Annual TDS certificate.', whyItMatters: 'Essential for tax filing.' },
  bank_statement: { label: 'Bank Statement', description: 'Bank account statement.', whyItMatters: 'Tracks credits/debits.' },
  broker_statement: { label: 'Broker Statement', description: 'Trading or contract note.', whyItMatters: 'Needed for Capital Gains tax.' },
  utility_bill: { label: 'Utility Bill', description: 'Bill for electricity, gas, etc.', whyItMatters: 'Recurring expense tracking.' },
  subscription_invoice: { label: 'Subscription Invoice', description: 'Invoice from a service.', whyItMatters: 'Monthly budget impact.' },
  tax_notice: { label: 'Tax Notice', description: 'Notice from IT department.', whyItMatters: 'May have deadlines.' },
  unknown: { label: 'Unrecognised Document', description: 'Unknown type.', whyItMatters: 'Review carefully.' },
};

function normalizeDate(dateStr: any): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  const clean = String(dateStr).trim().replace(/\//g, '-');
  
  // Handle Excel Serial Dates (numeric)
  if (typeof dateStr === 'number' && dateStr > 40000) {
    const d = new Date((dateStr - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }

  // Handle DD-MM-YYYY
  const ddmmyyyy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(clean);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) {
    return clean;
  }

  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  
  return new Date().toISOString().split('T')[0];
}

function extractBrokerData(buffer: ArrayBuffer): { records: any[], mapping: any } {
  const records: any[] = [];
  let currentMap: any = null;
  
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  rows.forEach((cols) => {
    if (!cols || cols.length < 2) return;

    const lowerCols = cols.map(c => String(c || '').toLowerCase().trim());
    
    // Header detection logic
    const isHeaderCandidate = (lowerCols.includes('symbol') || lowerCols.includes('instrument') || lowerCols.includes('stock name')) && 
                              (lowerCols.includes('qty') || lowerCols.includes('quantity') || lowerCols.includes('buy price') || lowerCols.includes('buy value') || lowerCols.includes('buy date'));

    if (isHeaderCandidate) {
      currentMap = {};
      lowerCols.forEach((h, i) => {
        if (!h) return;
        if (h.includes('symbol') || h === 'ticker' || h === 'instrument' || h.includes('stock name')) currentMap.instrument = i;
        if (h.includes('isin')) currentMap.isin = i;
        if (h.includes('qty') || h.includes('quantity')) currentMap.qty = i;
        if (h.includes('trade_date') || h.includes('buy date') || h.includes('entry date') || h.includes('execution_time')) currentMap.buyDate = i;
        if (h.includes('sell date') || h.includes('exit date')) currentMap.sellDate = i;
        if (h.includes('buy value') || h === 'buy_amt' || h.includes('invested')) currentMap.buyValue = i;
        if (h.includes('buy price') || h.includes('buy_avg') || h.includes('average price')) currentMap.buyPrice = i;
        if (h.includes('sell value') || h === 'sell_amt') currentMap.sellValue = i;
        if (h.includes('sell price') || h === 'sell_avg' || h.includes('price')) currentMap.sellPrice = i;
        if (h.includes('profit') || h.includes('realised p&l') || h.includes('realized p&l') || h.includes('realised pnl')) currentMap.pnl = i;
        if (h.includes('brokerage')) currentMap.brokerage = i;
        if (h.includes('stt')) currentMap.stt = i;
        if (h.includes('exchange txn') || h.includes('exchange transaction') || h.includes('txn charge')) currentMap.exchangeTxn = i;
        if (h.includes('sebi')) currentMap.sebiCharges = i;
        if (h.includes('stamp duty')) currentMap.stampDuty = i;
        if (h.includes('cgst')) currentMap.cgst = i;
        if (h.includes('sgst')) currentMap.sgst = i;
        if (h.includes('igst')) currentMap.igst = i;
        if (h.includes('charges') && !h.includes('sebi') && !h.includes('gst') && !h.includes('stt')) currentMap.charges = i;
        if (h.includes('trade_type') || h.includes('side') || h.includes('type')) currentMap.tradeType = i;
        if (h.includes('trade_id')) currentMap.tradeId = i;
      });
      return;
    }

    if (currentMap) {
      const inst = String(cols[currentMap.instrument] || '').toUpperCase().trim();
      if (!inst || inst === 'SYMBOL' || inst === 'INSTRUMENT' || inst === 'TOTAL' || inst === 'ACCOUNT HEAD') return;

      const qty = parseFloat(String(cols[currentMap.qty] || '').replace(/[^\d.-]/g, ''));
      if (isNaN(qty) || qty === 0) return;

      const tType = currentMap.tradeType !== undefined ? String(cols[currentMap.tradeType] || '').toLowerCase() : '';
      const tradeId = currentMap.tradeId !== undefined ? String(cols[currentMap.tradeId] || '') : '';

      let bP = 0;
      let sP = 0;
      
      // If it's a single leg (Tradebook format)
      if (tType === 'buy') {
        bP = parseFloat(String(cols[currentMap.sellPrice || currentMap.buyPrice] || '').replace(/[^\d.-]/g, '')) || 0;
      } else if (tType === 'sell') {
        sP = parseFloat(String(cols[currentMap.sellPrice || currentMap.buyPrice] || '').replace(/[^\d.-]/g, '')) || 0;
      } else {
        // Tax P&L format (matched pairs)
        bP = parseFloat(String(cols[currentMap.buyPrice] || '').replace(/[^\d.-]/g, '')) || 0;
        if (bP === 0 && currentMap.buyValue !== undefined) {
          bP = (parseFloat(String(cols[currentMap.buyValue] || '').replace(/[^\d.-]/g, '')) || 0) / Math.abs(qty);
        }

        sP = parseFloat(String(cols[currentMap.sellPrice] || '').replace(/[^\d.-]/g, '')) || 0;
        if (sP === 0 && currentMap.sellValue !== undefined) {
          sP = (parseFloat(String(cols[currentMap.sellValue] || '').replace(/[^\d.-]/g, '')) || 0) / Math.abs(qty);
        }
      }

      const pnl = parseFloat(String(cols[currentMap.pnl] || '').replace(/[^\d.-]/g, '')) || 0;

      const getVal = (idx: number | undefined) => idx !== undefined ? (parseFloat(String(cols[idx] || '').replace(/[^\d.-]/g, '')) || 0) : 0;
      
      const brokerage = getVal(currentMap.brokerage);
      const stt = getVal(currentMap.stt);
      const exchangeTxn = getVal(currentMap.exchangeTxn);
      const sebiCharges = getVal(currentMap.sebiCharges);
      const stampDuty = getVal(currentMap.stampDuty);
      const cgst = getVal(currentMap.cgst);
      const sgst = getVal(currentMap.sgst);
      const igst = getVal(currentMap.igst);
      const otherCharges = getVal(currentMap.charges);

      const totalCharges = brokerage + stt + exchangeTxn + sebiCharges + stampDuty + cgst + sgst + igst + otherCharges;

      records.push({
        instrument: inst,
        isin: String(cols[currentMap.isin] || ''),
        qty,
        buyDate: normalizeDate(cols[currentMap.buyDate]),
        sellDate: normalizeDate(cols[currentMap.sellDate] || cols[currentMap.buyDate]),
        buyPrice: bP,
        sellPrice: sP,
        charges: totalCharges,
        chargeBreakdown: {
          brokerage, stt, exchangeTxn, sebiCharges, stampDuty, cgst, sgst, igst, other: otherCharges
        },
        pnl: pnl || (sP - bP) * qty,
        tradeId: tradeId || `${inst}-${cols[currentMap.buyDate]}-${qty}`, // Fallback unique key
      });
    }
  });

  return { records, mapping: currentMap };
}

export async function detectDocument(file: File): Promise<DetectionResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const text = XLSX.utils.sheet_to_txt(firstSheet).slice(0, 5000);
  const lower = text.toLowerCase();

  let intent: DocumentIntent = 'unknown';
  if (lower.includes('payslip') || lower.includes('salary slip')) intent = 'payslip';
  else if (lower.includes('form 16') || lower.includes('tds certificate')) intent = 'form16';
  else if (lower.includes('statement') && (lower.includes('bank') || lower.includes('hdfc') || lower.includes('icici'))) intent = 'bank_statement';
  else if (lower.includes('zerodha') || lower.includes('groww') || lower.includes('broker') || lower.includes('trade book') || lower.includes('p&l')) intent = 'broker_statement';

  const meta = INTENT_META[intent];
  const { records, mapping } = extractBrokerData(buffer);

  return {
    intent,
    intentLabel: meta.label,
    intentDescription: meta.description,
    whyItMatters: meta.whyItMatters,
    confidence: intent === 'unknown' ? 0 : 95,
    metadata: { fileName: file.name, rowCount: records.length },
    fields: [],
    records,
    mappingReport: mapping,
    rawText: text,
    warnings: [],
  };
}
