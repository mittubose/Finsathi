/**
 * Tax-Saving Suggestions Engine
 * Generates actionable suggestions based on current income, deductions, and regime comparison.
 * All amounts in paise.
 */

import { compareRegimes } from './engine';
import type { TaxInput, TaxRegime } from './engine';

export interface TaxSuggestion {
  id: string;
  section: string;
  title: string;
  description: string;
  currentPaise: number;
  limitPaise: number;
  gapPaise: number;
  potentialSavingPaise: number;
  priority: 'high' | 'medium' | 'low';
  regime: 'old' | 'both';
  icon: string;
}

// Deduction limits
const LIMITS = {
  '80C': 150000_00,
  '80D': 25000_00,
  '80D_SENIOR': 50000_00,
  '80TTA': 10000_00,
  'HOME_LOAN': 200000_00,
  'NPS_80CCD1B': 50000_00,
  'NPS_80CCD2': 0, // 10% of basic, computed dynamically
};

export function generateSuggestions(input: TaxInput): TaxSuggestion[] {
  const suggestions: TaxSuggestion[] = [];
  const comparison = compareRegimes(input);
  const d = input.deductions;
  const oldResult = comparison.oldRegime;

  // Helper: estimate saving for incremental deduction in old regime
  function estimateOldRegimeSaving(additionalDeductionPaise: number): number {
    // Marginal tax rate based on taxable income
    const taxable = oldResult.taxableIncomePaise;
    let marginalRate: number;
    if (taxable > 1000000_00) marginalRate = 30;
    else if (taxable > 500000_00) marginalRate = 20;
    else if (taxable > 250000_00) marginalRate = 5;
    else marginalRate = 0;

    // Tax saving = deduction × marginal rate × (1 + cess)
    const baseSaving = Math.floor(additionalDeductionPaise * marginalRate / 100);
    return Math.floor(baseSaving * 104 / 100); // 4% cess
  }

  // === Section 80C ===
  const current80C = d.section80C_paise;
  const limit80C = LIMITS['80C'];
  if (current80C < limit80C) {
    const gap = limit80C - current80C;
    const saving = estimateOldRegimeSaving(gap);
    if (saving > 0) {
      suggestions.push({
        id: '80C',
        section: '80C',
        title: 'Maximize Section 80C',
        description: `Invest ₹${Math.round(gap / 100).toLocaleString('en-IN')} more in PF, PPF, ELSS, LIC, or tax-saving FDs to use your full ₹1.5L limit.`,
        currentPaise: current80C,
        limitPaise: limit80C,
        gapPaise: gap,
        potentialSavingPaise: saving,
        priority: gap > 50000_00 ? 'high' : 'medium',
        regime: 'old',
        icon: 'savings',
      });
    }
  }

  // === Section 80D ===
  const current80D = d.section80D_paise;
  const limit80D = LIMITS['80D'];
  if (current80D < limit80D) {
    const gap = limit80D - current80D;
    const saving = estimateOldRegimeSaving(gap);
    if (saving > 0) {
      suggestions.push({
        id: '80D',
        section: '80D',
        title: 'Get Health Insurance',
        description: `Health insurance premium up to ₹${Math.round(limit80D / 100).toLocaleString('en-IN')} is deductible. You can save ₹${Math.round(saving / 100).toLocaleString('en-IN')} in tax.`,
        currentPaise: current80D,
        limitPaise: limit80D,
        gapPaise: gap,
        potentialSavingPaise: saving,
        priority: current80D === 0 ? 'high' : 'medium',
        regime: 'old',
        icon: 'health_and_safety',
      });
    }
  }

  // === HRA ===
  if (input.salary.hraPaise > 0 && (!input.hra || input.hra.rentPaidPaise === 0)) {
    // User gets HRA but hasn't claimed rent
    const potentialExemption = Math.floor(input.salary.hraPaise * 60 / 100); // rough estimate
    const saving = estimateOldRegimeSaving(potentialExemption);
    if (saving > 0) {
      suggestions.push({
        id: 'HRA',
        section: 'HRA',
        title: 'Claim HRA Exemption',
        description: 'You receive HRA but haven\'t declared rent. If you pay rent, the exemption could significantly reduce taxable income under Old Regime.',
        currentPaise: 0,
        limitPaise: input.salary.hraPaise,
        gapPaise: potentialExemption,
        potentialSavingPaise: saving,
        priority: 'high',
        regime: 'old',
        icon: 'home',
      });
    }
  }

  // === NPS 80CCD(1B) ===
  const currentNPS = d.nps80CCD_paise;
  const npsLimit = 50000_00;
  if (currentNPS < npsLimit) {
    const gap = npsLimit - currentNPS;
    const saving = estimateOldRegimeSaving(gap);
    if (saving > 0) {
      suggestions.push({
        id: 'NPS',
        section: '80CCD(1B)',
        title: 'Invest in NPS',
        description: `Additional ₹${Math.round(gap / 100).toLocaleString('en-IN')} in NPS qualifies for extra deduction beyond 80C limit.`,
        currentPaise: currentNPS,
        limitPaise: npsLimit,
        gapPaise: gap,
        potentialSavingPaise: saving,
        priority: 'medium',
        regime: 'old',
        icon: 'elderly',
      });
    }
  }

  // === Home Loan ===
  const currentHL = d.homeLoanInterestPaise;
  if (currentHL > 0 && currentHL < LIMITS['HOME_LOAN']) {
    const gap = LIMITS['HOME_LOAN'] - currentHL;
    suggestions.push({
      id: 'HOME_LOAN',
      section: '24(b)',
      title: 'Home Loan Interest',
      description: `You can claim up to ₹2L on home loan interest. ₹${Math.round(gap / 100).toLocaleString('en-IN')} more is eligible.`,
      currentPaise: currentHL,
      limitPaise: LIMITS['HOME_LOAN'],
      gapPaise: gap,
      potentialSavingPaise: estimateOldRegimeSaving(gap),
      priority: 'low',
      regime: 'old',
      icon: 'real_estate_agent',
    });
  }

  // === Regime Switch Suggestion ===
  if (comparison.savingsPaise > 0) {
    const betterRegime = comparison.recommendation;
    const currentRegime: TaxRegime = betterRegime === 'new' ? 'old' : 'new';
    suggestions.push({
      id: 'REGIME_SWITCH',
      section: 'Regime',
      title: `Switch to ${betterRegime.toUpperCase()} Regime`,
      description: `${betterRegime === 'new' ? 'New' : 'Old'} Regime saves ₹${Math.round(comparison.savingsPaise / 100).toLocaleString('en-IN')} compared to ${currentRegime === 'new' ? 'New' : 'Old'} Regime for your income level.`,
      currentPaise: 0,
      limitPaise: 0,
      gapPaise: 0,
      potentialSavingPaise: comparison.savingsPaise,
      priority: 'high',
      regime: 'both',
      icon: 'swap_horiz',
    });
  }

  // === Section 80E (Education Loan) ===
  if (d.section80E_paise === 0) {
    suggestions.push({
      id: '80E',
      section: '80E',
      title: 'Education Loan Interest',
      description: 'Interest on education loans is fully deductible with no upper limit under Old Regime.',
      currentPaise: 0,
      limitPaise: 0,
      gapPaise: 0,
      potentialSavingPaise: 0,
      priority: 'low',
      regime: 'old',
      icon: 'school',
    });
  }

  // Sort by potential saving (descending)
  suggestions.sort((a, b) => b.potentialSavingPaise - a.potentialSavingPaise);

  return suggestions;
}
