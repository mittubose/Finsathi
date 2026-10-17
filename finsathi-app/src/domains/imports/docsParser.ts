export interface ParsedDocItem {
  id: string;
  name: string;
  amountPaise: number;
  dateStr: string;
  isStrikethrough: boolean;
  type: 'income' | 'expense' | 'credit' | 'loan' | 'null' | 'unknown';
  originalText: string;
  category?: string;
  importAnyway?: boolean;
}

export interface ParsedDocMonth {
  id: string;
  monthYear: string;
  items: ParsedDocItem[];
  totalExpected?: number;
}

function extractTextWithStrike(node: Node, isStriked = false): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!text.trim()) return text;
    return isStriked ? `[[S]]${text}[[/S]]` : text;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    let hasStrike = isStriked;
    if (el.tagName === 'S' || el.tagName === 'STRIKE' || el.tagName === 'DEL') {
      hasStrike = true;
    }
    const style = el.getAttribute('style') || '';
    if (style.includes('line-through')) {
      hasStrike = true;
    }
    
    let result = '';
    for (const child of Array.from(el.childNodes)) {
      result += extractTextWithStrike(child, hasStrike);
    }
    
    const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'TR'];
    if (blockTags.includes(el.tagName)) {
      result += '\n';
    }
    return result;
  }
  return '';
}

export function parsePastedHtml(html: string): ParsedDocMonth[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const fullText = extractTextWithStrike(doc.body);
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  const months: ParsedDocMonth[] = [];
  let currentMonth: ParsedDocMonth | null = null;
  let itemIdCounter = 0;

  for (const line of lines) {
    // 1. Detect Month Header
    const monthMatch = line.match(/Payment list\s+(.*)/i);
    if (monthMatch) {
      const monthYear = monthMatch[1].replace(/\[\[\/?S\]\]/g, '').trim();
      currentMonth = {
        id: `month-${Date.now()}-${Math.random()}`,
        monthYear,
        items: []
      };
      months.push(currentMonth);
      continue;
    }

    if (!currentMonth) continue;

    // 2. Ignore lines that are totals or separators
    if (line.match(/^Total:/i) || line.match(/^_+$/)) {
      continue;
    }

    // 3. Detect strikethrough (expense)
    const isExpense = line.includes('[[S]]');
    
    // Clean the string for extraction
    let cleanLine = line.replace(/\[\[S\]\]/g, '').replace(/\[\[\/S\]\]/g, '').trim();
    cleanLine = cleanLine.replace(/^[•*-\s]+/, '');

    // Extract dates
    const DATE_REGEX = /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{2,4})?)\b/gi;
    const dates: string[] = [];
    cleanLine = cleanLine.replace(DATE_REGEX, (match) => {
      dates.push(match.trim());
      return '';
    });

    // Remove math equations to prevent extracting 1000+500=1500 as 3 amounts
    const MATH_REGEX = /([\d,.]+[+-][\d,.]+(?:[+-][\d,.]+)*)\s*=\s*([\d,.]+)/g;
    cleanLine = cleanLine.replace(MATH_REGEX, (match, expr, result) => result);

    // Extract amounts
    // Avoid pulling out random numbers like passwords (sample_pass123) or paths (sample/path/1)
    // Match amounts with Rs, /-, or k
    const AMOUNT_REGEX = /(?:Rs\.?\s*|₹\s*|[-]?\s*)(?<![a-zA-Z0-9@/_-])([\d,]{1,8}(?:\.\d+)?)\s*(k)?\s*(?:\/-|rs)?\b/gi;
    const amounts: { val: number, str: string }[] = [];
    
    cleanLine = cleanLine.replace(AMOUNT_REGEX, (match, numStr, kFlag) => {
      const rawNum = parseFloat(numStr.replace(/,/g, ''));
      if (isNaN(rawNum)) return match;
      let val = rawNum;
      if (kFlag && kFlag.toLowerCase() === 'k') val *= 1000;
      
      if (match.trim().startsWith('-') && !match.includes('/-')) {
        val = -val;
      }
      amounts.push({ val, str: match });
      return '';
    });

    if (amounts.length === 0 && line.includes('/-')) {
      amounts.push({ val: 0, str: '/-' });
    }

    const baseName = cleanLine
      .replace(/^[-\s]+|[-\s]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[()]/g, '')
      .trim();

    if (amounts.length === 0 && baseName.length > 0) {
      // Just a note or name without amount
      continue;
    }

    for (let i = 0; i < amounts.length; i++) {
      const amt = amounts[i];
      const isNegative = amt.val < 0;
      const finalAmount = Math.round(Math.abs(amt.val) * 100);
      const dateStr = dates.length > i ? dates[i] : (dates.length > 0 ? dates[0] : '');
      
      let finalType: 'income' | 'expense' | 'credit' | 'loan' | 'null' | 'unknown' = 
        isNegative ? 'expense' : (isExpense ? 'expense' : 'expense');

      // Default type based on keywords
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('received') || lowerLine.includes('salary')) {
        finalType = 'income';
      } else if (lowerLine.includes('refund')) {
        finalType = 'credit';
      }

      // Null heuristics
      if (finalAmount === 0 || lowerLine.includes('not paid') || lowerLine.includes('no credit card bill') || lowerLine.includes('not utilized') || lowerLine.includes('no data')) {
        finalType = 'null';
      } else if (lowerLine.includes('null')) {
        finalType = 'null';
      }

      // Unknown heuristics
      if (lowerLine.includes('pending') || lowerLine.includes('estimate') || lowerLine.includes('=')) {
        finalType = 'unknown';
      }
      
      if (finalType === 'unknown') {
        finalType = 'null';
      }
      
      let finalDateStr = dateStr;
      if (!finalDateStr) {
        // Fallback to the 1st of the section's month/year
        finalDateStr = new Date(`${currentMonth.monthYear} 1 12:00:00`).toISOString().split('T')[0];
      } else {
        // If it's just '5 May', try to append the year from currentMonth
        if (!finalDateStr.match(/\d{4}/)) {
           const yearMatch = currentMonth.monthYear.match(/\d{4}/);
           if (yearMatch) {
             const parsedDate = new Date(`${finalDateStr} ${yearMatch[0]} 12:00:00`);
             if (!isNaN(parsedDate.getTime())) {
               finalDateStr = parsedDate.toISOString().split('T')[0];
             }
           }
        }
      }

      currentMonth.items.push({
        id: `doc-item-${itemIdCounter++}`,
        name: baseName || 'Transaction unknown',
        amountPaise: finalAmount,
        dateStr: finalDateStr,
        isStrikethrough: isExpense,
        type: finalType,
        originalText: line.trim()
      });
    }
  }

  return months;
}
