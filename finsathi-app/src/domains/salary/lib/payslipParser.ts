import * as XLSX from 'xlsx';
import * as pdfjs from 'pdfjs-dist';

const PDFJS_VERSION = '5.7.284';
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export interface ParsedPayslip {
  month: string; // YYYY-MM
  employer: string;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  netPay: number;
  grossPay: number;
  rawText: string;
}

export async function parsePayslip(file: File): Promise<ParsedPayslip> {
  const fileName = file.name.toLowerCase();
  let text = '';

  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('PARSING_TIMEOUT_EXCEEDED')), 15000)
    );

    const parsePromise = (async () => {
      if (fileName.endsWith('.pdf')) {
        return await extractTextFromPDF(file);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        return await extractTextFromExcel(file);
      } else {
        return await file.text();
      }
    })();

    text = await Promise.race([parsePromise, timeoutPromise]) as string;
  } catch (err: any) {
    throw new Error(`FILE_READ_ERROR: ${err.message}`);
  }

  return analyzePayslipText(text);
}

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    useWorkerFetch: true,
  });
  
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const sortedItems = textContent.items.sort((a: any, b: any) => {
      if (Math.abs(a.transform[5] - b.transform[5]) > 2) return b.transform[5] - a.transform[5];
      return a.transform[4] - b.transform[4];
    });
    const pageText = sortedItems.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

async function extractTextFromExcel(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let fullText = '';
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    fullText += csv + '\n';
  });
  return fullText;
}

function analyzePayslipText(text: string): ParsedPayslip {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const earnings: { label: string; amount: number }[] = [];
  const deductions: { label: string; amount: number }[] = [];
  let employer = 'JOOLA INDIA PVT LTD'; 
  let month = new Date().toISOString().slice(0, 7); 
  let netPay = 0;
  let grossPay = 0;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Specific Joola Format Keywords (Ordered by length to prevent partial matches)
  const earningKeys = [
    'BASIC', 'HRA', 'SPECIAL ALLOWANCE', 'COMMUNICATION', 'LTA', 
    'PERSONAL ALLOWANCE', 'EMPLOYER PF CONTRIBUTION', 'GRATUITY', 
    'EMPLOYER EDLI CONTRIBUTION', 'BONUS', 'CONVEYANCE'
  ];
  
  const deductionKeys = [
    'PF', 'PROF TAX', 'EDLI DEDUCTION', 'EMPLOYER PF', 'TDS', 'ESI', 'LOAN'
  ];

  lines.forEach(line => {
    const upper = line.toUpperCase();
    
    // 1. Meta Data
    if (upper.includes('MONTH OF')) {
      const matchMonth = monthNames.find(m => upper.includes(m.toUpperCase())) || monthShort.find(m => upper.includes(m.toUpperCase()));
      const matchYear = line.match(/\b(20\d{2})\b/);
      if (matchMonth && matchYear) {
        const mIdx = monthNames.includes(matchMonth) ? monthNames.indexOf(matchMonth) : monthShort.indexOf(matchMonth);
        month = `${matchYear[1]}-${String(mIdx + 1).padStart(2, '0')}`;
      }
    }

    // 2. Main Totals
    if (upper.includes('NET PAY FOR THE MONTH')) {
      const nums = line.match(/(\d{4,})/g);
      if (nums) netPay = parseFloat(nums[0]);
    }
    if (upper.includes('TOTAL EARNINGS')) {
      const nums = line.match(/(\d{4,})/g);
      if (nums) grossPay = parseFloat(nums[0]);
    }

    // 3. Precise Component Capture (Targeting Joola Layout)
    // We split the line by these keywords to find values attached to them
    earningKeys.forEach(key => {
      if (upper.includes(key)) {
        // Look for the amount immediately following the key or in the same 'earning' column
        // Example: "BASIC 52500 52500" -> We want the second one (Actual) or the only one.
        const afterKey = line.substring(upper.indexOf(key) + key.length);
        const amounts = afterKey.match(/(\d+(?:\.\d+)?)/g);
        if (amounts && amounts.length > 0) {
          // If there are two identical numbers (Master/Amount), take the one at the end of the earning column
          const val = parseFloat(amounts[amounts.length > 1 ? 1 : 0]);
          if (val > 0) earnings.push({ label: key, amount: val });
        }
      }
    });

    deductionKeys.forEach(key => {
      if (upper.includes(key) && !upper.startsWith('TOTAL')) {
        // For deductions, they usually appear after the earning numbers.
        // We look for the keyword and then the number immediately after it.
        const afterKey = line.substring(upper.indexOf(key) + key.length);
        const amounts = afterKey.match(/(\d+(?:\.\d+)?)/);
        if (amounts) {
          const val = parseFloat(amounts[1]);
          if (val > 0) deductions.push({ label: key, amount: val });
        }
      }
    });
  });

  // Deduplicate (since keywords might appear in multiple lines or context)
  const uniqueE = earnings.filter((e, i, self) => 
    i === self.findIndex(t => t.label === e.label && Math.abs(t.amount - e.amount) < 0.01)
  );
  const uniqueD = deductions.filter((d, i, self) => 
    i === self.findIndex(t => t.label === d.label && Math.abs(t.amount - d.amount) < 0.01)
  );

  return {
    month,
    employer,
    earnings: uniqueE,
    deductions: uniqueD,
    netPay: netPay || (uniqueE.reduce((s, e) => s + e.amount, 0) - uniqueD.reduce((s, d) => s + d.amount, 0)),
    grossPay: grossPay || uniqueE.reduce((s, e) => s + e.amount, 0),
    rawText: text.slice(0, 2000)
  };
}
