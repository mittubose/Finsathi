/**
 * FinSathi Deep Document & Scanned Receipt OCR Engine
 * Runs 100% in-browser using pdfjs-dist and tesseract.js.
 * Zero cloud leakage: receipts and bank statements are processed entirely in browser memory.
 */

import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker if in browser
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch {}
}

export interface ExtractedTransaction {
  id: string;
  type: 'income' | 'expense';
  amountPaise: number;
  merchant: string;
  date: string;
  category: string;
  confidence?: number;
}

export interface DocumentVerificationReport {
  fileName: string;
  fileType: 'spreadsheet' | 'pdf_digital' | 'pdf_scanned_ocr' | 'image_receipt_ocr';
  totalRecords: number;
  totalCreditsPaise: number;
  totalDebitsPaise: number;
  dateRange: string;
  duplicateCount: number;
  merchantSummary?: string;
  extractedItems: ExtractedTransaction[];
  rawTextPreview?: string;
}

/**
 * Clean and parse Indian amount string (e.g. "1,25,000.50", "₹ 4,500", "500.00 Cr")
 */
export function parseIndianAmountPaise(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[₹RsINR,\s]/gi, '').replace(/\((.*?)\)/, '-$1');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(Math.abs(num) * 100);
}

/**
 * Parse Date string from common formats: DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YYYY
 */
export function parseFlexibleDate(str: string): string {
  if (!str) return new Date().toISOString().split('T')[0];

  const trimmed = str.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // DD Month YYYY (e.g. 15 Aug 2024 or 15-Aug-2024)
  const dMonthY = trimmed.match(/^(\d{1,2})[\s/-]([a-zA-Z]{3,9})[\s/-](\d{2,4})$/);
  if (dMonthY) {
    const day = parseInt(dMonthY[1]);
    const monthStr = dMonthY[2].toLowerCase();
    let year = parseInt(dMonthY[3]);
    if (year < 100) year += 2000;

    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const mIdx = months[monthStr.slice(0, 3)] ?? 0;
    const d = new Date(year, mIdx, day);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * 1. Parse Excel / CSV statement
 */
export async function parseSpreadsheet(file: File): Promise<DocumentVerificationReport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

  let totalCredits = 0;
  let totalDebits = 0;
  const extracted: ExtractedTransaction[] = [];
  const seenSignatures = new Set<string>();
  let duplicates = 0;

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length < 2) continue;

    const dateCandidate = String(row[0] || '').trim();
    const desc = String(row[1] || row[2] || 'Transaction').trim();
    if (!desc || /balance|opening|closing/i.test(desc)) continue;

    let val = 0;
    let isCredit = false;

    // Scan for credit/debit cells
    for (let c = 1; c < row.length; c++) {
      const cellVal = parseFloat(String(row[c]).replace(/,/g, ''));
      if (!isNaN(cellVal) && cellVal > 0) {
        val = cellVal;
        isCredit = /credit|salary|deposit|refund|interest|cr/i.test(desc) || c === 3;
        break;
      }
    }

    if (val > 0) {
      const amountPaise = Math.round(val * 100);
      if (isCredit) totalCredits += amountPaise;
      else totalDebits += amountPaise;

      const dateStr = parseFlexibleDate(dateCandidate);
      const sig = `${dateStr}_${desc.toLowerCase()}_${amountPaise}`;
      if (seenSignatures.has(sig)) duplicates++;
      seenSignatures.add(sig);

      extracted.push({
        id: `spr_${Date.now()}_${i}`,
        type: isCredit ? 'income' : 'expense',
        amountPaise,
        merchant: desc.slice(0, 45),
        date: dateStr,
        category: isCredit ? 'Income' : categorizeByMerchant(desc),
        confidence: 0.95
      });
    }
  }

  return {
    fileName: file.name,
    fileType: 'spreadsheet',
    totalRecords: extracted.length,
    totalCreditsPaise: totalCredits,
    totalDebitsPaise: totalDebits,
    dateRange: extracted.length > 0 ? `${extracted[0].date} to ${extracted[extracted.length - 1].date}` : 'N/A',
    duplicateCount: duplicates,
    extractedItems: extracted
  };
}

/**
 * 2. Parse PDF statement (Digital text or scanned fallback)
 */
export async function parsePdfStatement(file: File): Promise<DocumentVerificationReport> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items.map((item: any) => item.str);
    const pageText = pageStrings.join(' ');
    fullText += pageText + '\n';
    lines.push(...pageStrings);
  }

  // Check if text layer is empty (Scanned PDF)
  if (fullText.trim().length < 50) {
    // Fall back to OCR for scanned receipt or single-page PDF
    return parseScannedPdfOcr(file, pdfDoc);
  }

  // Parse digital text lines for transaction patterns
  const extracted: ExtractedTransaction[] = [];
  let totalCredits = 0;
  let totalDebits = 0;
  const seenSignatures = new Set<string>();
  let duplicates = 0;

  // Regex looking for: Date (DD/MM/YYYY or DD-MMM-YYYY) Description Amount (Credit/Debit/Balance)
  const lineRegex = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[a-zA-Z]{3}\s+\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR|DR|credit|debit)?/gi;
  let match;

  while ((match = lineRegex.exec(fullText)) !== null) {
    const rawDate = match[1];
    const desc = match[2].trim();
    const rawAmount = match[3];
    const indicator = (match[4] || '').toUpperCase();

    const amountPaise = parseIndianAmountPaise(rawAmount);
    if (amountPaise <= 0 || /closing|opening|balance/i.test(desc)) continue;

    const isCredit = indicator === 'CR' || indicator === 'CREDIT' || /salary|interest|deposit|refund/i.test(desc);
    if (isCredit) totalCredits += amountPaise;
    else totalDebits += amountPaise;

    const parsedDate = parseFlexibleDate(rawDate);
    const sig = `${parsedDate}_${desc.toLowerCase()}_${amountPaise}`;
    if (seenSignatures.has(sig)) duplicates++;
    seenSignatures.add(sig);

    extracted.push({
      id: `pdf_${Date.now()}_${extracted.length}`,
      type: isCredit ? 'income' : 'expense',
      amountPaise,
      merchant: desc.slice(0, 45),
      date: parsedDate,
      category: isCredit ? 'Income' : categorizeByMerchant(desc),
      confidence: 0.90
    });
  }

  // If table regex did not match, parse line-by-line fallback
  if (extracted.length === 0) {
    const rows = fullText.split('\n');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].trim();
      const amtMatch = r.match(/₹?\s*([\d,]+\.\d{2})/);
      const dateMatch = r.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
      if (amtMatch && dateMatch) {
        const amountPaise = parseIndianAmountPaise(amtMatch[1]);
        const isCredit = /credit|cr|salary|deposit/i.test(r);
        const merchant = r.replace(amtMatch[0], '').replace(dateMatch[0], '').trim().slice(0, 40) || 'PDF Transaction';
        const parsedDate = parseFlexibleDate(dateMatch[1]);

        if (amountPaise > 0) {
          if (isCredit) totalCredits += amountPaise;
          else totalDebits += amountPaise;

          extracted.push({
            id: `pdf_fallback_${Date.now()}_${i}`,
            type: isCredit ? 'income' : 'expense',
            amountPaise,
            merchant,
            date: parsedDate,
            category: isCredit ? 'Income' : categorizeByMerchant(merchant),
            confidence: 0.82
          });
        }
      }
    }
  }

  return {
    fileName: file.name,
    fileType: 'pdf_digital',
    totalRecords: extracted.length,
    totalCreditsPaise: totalCredits,
    totalDebitsPaise: totalDebits,
    dateRange: extracted.length > 0 ? `${extracted[0].date} to ${extracted[extracted.length - 1].date}` : 'N/A',
    duplicateCount: duplicates,
    extractedItems: extracted,
    rawTextPreview: fullText.slice(0, 200) + '...'
  };
}

/**
 * 3. Scanned PDF fallback using Canvas rasterization + Tesseract OCR
 */
async function parseScannedPdfOcr(file: File, pdfDoc: any): Promise<DocumentVerificationReport> {
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Convert canvas to blob for Tesseract
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
  if (!blob) {
    throw new Error('Canvas render failed for scanned PDF');
  }

  const receiptReport = await parseImageReceiptOcr(new File([blob], `${file.name}.png`, { type: 'image/png' }));
  receiptReport.fileType = 'pdf_scanned_ocr';
  receiptReport.fileName = file.name;
  return receiptReport;
}

/**
 * 4. Image Receipt OCR using Tesseract.js
 */
export async function parseImageReceiptOcr(file: File): Promise<DocumentVerificationReport> {
  const worker = await createWorker('eng');
  const ret = await worker.recognize(file);
  await worker.terminate();

  const text = ret.data.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let merchant = 'Store / Merchant';
  let date = new Date().toISOString().split('T')[0];
  let grandTotalPaise = 0;

  // 1. Merchant Candidate (Usually line 1 or 2)
  if (lines.length > 0) {
    merchant = lines[0].replace(/[^a-zA-Z0-9\s&.-]/g, '').trim().slice(0, 35) || merchant;
  }

  // 2. Date scan
  for (const line of lines) {
    const dMatch = line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[a-zA-Z]{3}\s+\d{2,4})/);
    if (dMatch) {
      date = parseFlexibleDate(dMatch[1]);
      break;
    }
  }

  // 3. Amount scan (Look for TOTAL / GRAND TOTAL / AMOUNT / NET)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/total|grand total|net amount|amount payable|paid/i.test(line)) {
      const amtMatch = line.match(/([\d,]+\.\d{2}|[\d,]+)/);
      if (amtMatch) {
        grandTotalPaise = parseIndianAmountPaise(amtMatch[1]);
        if (grandTotalPaise > 0) break;
      }
    }
  }

  // Fallback: maximum numeric amount found in receipt
  if (grandTotalPaise === 0) {
    for (const line of lines) {
      const nums = line.match(/\b\d+(?:\.\d{2})?\b/g);
      if (nums) {
        for (const n of nums) {
          const paise = parseIndianAmountPaise(n);
          if (paise > grandTotalPaise && paise < 100000000) { // < ₹10 Lakhs
            grandTotalPaise = paise;
          }
        }
      }
    }
  }

  const extracted: ExtractedTransaction[] = grandTotalPaise > 0 ? [{
    id: `ocr_${Date.now()}`,
    type: 'expense',
    amountPaise: grandTotalPaise,
    merchant: merchant || 'Receipt Expense',
    date,
    category: categorizeByMerchant(merchant),
    confidence: ret.data.confidence ? ret.data.confidence / 100 : 0.85
  }] : [];

  return {
    fileName: file.name,
    fileType: 'image_receipt_ocr',
    totalRecords: extracted.length,
    totalCreditsPaise: 0,
    totalDebitsPaise: grandTotalPaise,
    dateRange: date,
    duplicateCount: 0,
    merchantSummary: merchant,
    extractedItems: extracted,
    rawTextPreview: text.slice(0, 250) + '...'
  };
}

/**
 * Categorize by merchant keywords
 */
function categorizeByMerchant(merchant: string): string {
  const m = merchant.toLowerCase();
  if (/swiggy|zomato|coffee|restaurant|hotel|food|supermarket|mart|grocery|bazaar/i.test(m)) return 'Food';
  if (/uber|ola|fuel|petrol|diesel|railway|irctc|metro|flight|air/i.test(m)) return 'Transport';
  if (/electricity|water|wifi|broadband|airtel|jio|bill/i.test(m)) return 'Utilities';
  if (/amazon|flipkart|myntra|zara|shopping|store/i.test(m)) return 'Shopping';
  if (/hospital|clinic|pharmacy|apollo|medplus|doctor/i.test(m)) return 'Healthcare';
  if (/school|college|udemy|coursera|tuition|education/i.test(m)) return 'Education';
  if (/netflix|spotify|prime|hotstar|cinema|pvr|movie/i.test(m)) return 'Entertainment';
  if (/insurance|lic|hdfc life|max life/i.test(m)) return 'Insurance';
  return 'Other';
}

/**
 * Master universal document router
 */
export async function parseFinancialDocumentUniversal(file: File): Promise<DocumentVerificationReport> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return parseSpreadsheet(file);
  }

  if (ext === 'pdf') {
    return parsePdfStatement(file);
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext || '')) {
    return parseImageReceiptOcr(file);
  }

  throw new Error(`Unsupported document extension .${ext}. FinSathi supports .xlsx, .csv, .pdf, .png, and .jpg.`);
}
