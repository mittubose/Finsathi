import { useAppStore } from '../../shared/hooks/useAppStore';
import { useRecurringStore } from '../../shared/hooks/useRecurringStore';
import type { RecurringType } from '../../shared/hooks/useRecurringStore';

export interface PatternSuggestion {
  id: string;
  title: string;
  type: RecurringType;
  averageAmountPaise: number;
  frequency: 'monthly'; // We'll stick to monthly as default for simplicity
  detectedCount: number;
}

export function detectPatterns(): PatternSuggestion[] {
  const { expenseItems, incomeItems } = useAppStore.getState();
  const { rules } = useRecurringStore.getState();

  const suggestions: PatternSuggestion[] = [];
  
  // A helper to normalize strings
  // E.g., "Electricity bill (user_id, pass_123)" -> "electricity bill"
  // "Water (CoID: 0000000000, CoNo:X00/0000/Y) 500/- 1 May  with due" -> "water"
  // KSFE chit -> ksfe chit
  const normalize = (str: string) => {
    let s = str.toLowerCase();
    
    // Remove stuff in parentheses completely
    s = s.replace(/\(.*?\)/g, '');
    
    // Extract common keywords first if they exist
    const keywords = ['kwa', 'electricity', 'airtel', 'broadband', 'swathi', 'ksfe', 'loan', 'insurance', 'rent', 'water'];
    for (const kw of keywords) {
      if (s.includes(kw)) {
        return kw;
      }
    }
    
    // Fallback: strip special characters and numbers
    s = s.replace(/[^a-z\s]/g, '').trim();
    return s.split(' ').slice(0, 2).join(' '); // Keep first 2 words
  };

  // Process items
  const processItems = (items: any[], type: RecurringType) => {
    const groups = new Map<string, {
      title: string;
      amounts: number[];
      months: Set<string>;
    }>();

    for (const item of items) {
      const rawTitle = type === 'expense' ? item.merchant : item.source;
      const normalized = normalize(rawTitle);
      
      if (!normalized) continue;
      if (normalized.length < 3) continue; // skip tiny arbitrary names

      const month = item.date.slice(0, 7); // YYYY-MM
      
      if (!groups.has(normalized)) {
        groups.set(normalized, {
          title: rawTitle.replace(/\(.*?\)/g, '').trim() || normalized, // Pick a clean representative title
          amounts: [],
          months: new Set(),
        });
      }
      
      const group = groups.get(normalized)!;
      group.amounts.push(item.amountPaise);
      group.months.add(month);
    }

    for (const [key, group] of groups.entries()) {
      // Must appear in at least 2 distinct months
      if (group.months.size >= 2) {
        // Calculate average
        const avg = Math.round(group.amounts.reduce((a, b) => a + b, 0) / group.amounts.length);
        
        // Capitalize title
        const cleanTitle = key.charAt(0).toUpperCase() + key.slice(1);

        // Check if existing rule already covers this
        // Simple heuristic: if any active rule's title includes our keyword
        const isCovered = rules.some(r => r.title.toLowerCase().includes(key));
        
        if (!isCovered) {
          suggestions.push({
            id: `pattern-${key}`,
            title: cleanTitle,
            type,
            averageAmountPaise: avg,
            frequency: 'monthly',
            detectedCount: group.amounts.length
          });
        }
      }
    }
  };

  processItems(expenseItems.filter(e => !e.isRecurring), 'expense');
  processItems(incomeItems.filter(i => i.head === 'salary' || i.head === 'other'), 'income'); // Assuming regular incomes

  // Sort by highest detected count
  suggestions.sort((a, b) => b.detectedCount - a.detectedCount);

  return suggestions;
}
