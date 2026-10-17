/**
 * Advance Tax Calculator
 * Computes quarterly advance tax installments based on estimated annual tax.
 * Includes penalty estimation for late/short payments under sections 234B and 234C.
 * All amounts in paise.
 */

import { advanceTaxDates } from '../../shared/lib/dates';
import { compareRegimes } from './engine';
import type { TaxInput } from './engine';

export interface AdvanceTaxQuarter {
  quarter: string;
  dueDate: Date;
  cumulativePct: number;
  cumulativeTaxDuePaise: number;
  installmentPaise: number;
  paidPaise: number;
  shortfallPaise: number;
  isPast: boolean;
  isOverdue: boolean;
  penaltyEstPaise: number;
}

export interface AdvanceTaxResult {
  totalEstimatedTaxPaise: number;
  totalTDSPaise: number;
  netAdvanceTaxPaise: number;
  regime: 'old' | 'new';
  quarters: AdvanceTaxQuarter[];
  penalty234CPaise: number;
  penalty234BPaise: number;
  totalPenaltyPaise: number;
  shouldPayAdvanceTax: boolean;
  nextDue: AdvanceTaxQuarter | null;
  form10IEARequired: boolean;
}

export function computeAdvanceTax(
  taxInput: TaxInput,
  tradeTax: number,
  tdsPaidPaise: number,
  quarterPayments: number[], // paise paid per quarter [Q1, Q2, Q3, Q4]
  fy: string
): AdvanceTaxResult {
  // Total tax from salary
  const comparison = compareRegimes(taxInput);
  const betterRegime = comparison.recommendation;
  const salaryTax = betterRegime === 'new'
    ? comparison.newRegime.totalTaxPaise
    : comparison.oldRegime.totalTaxPaise;

  // Total estimated tax
  const totalEstimatedTax = salaryTax + tradeTax;
  const netAdvanceTax = Math.max(0, totalEstimatedTax - tdsPaidPaise);

  // If net tax < ₹10,000 — no advance tax required
  const shouldPay = netAdvanceTax >= 1000000; // ₹10,000 in paise

  const dates = advanceTaxDates(fy);
  const now = new Date();

  // Statutory thresholds for Section 234C:
  // Q1 (15% due, safe harbor >= 12%): 3 months @ 1%
  // Q2 (45% due, safe harbor >= 36%): 3 months @ 1%
  // Q3 (75% due, no safe harbor): 3 months @ 1%
  // Q4 (100% due, no safe harbor): 1 month @ 1%
  const statutorySafeHarbors = [12, 36, 75, 100];
  const statutoryMonths = [3, 3, 3, 1];

  let penalty234C = 0;

  const quarters: AdvanceTaxQuarter[] = dates.map((q, i) => {
    const cumulativePct = q.pct;
    const cumulativeTaxDue = Math.floor(netAdvanceTax * cumulativePct / 100);
    const prevCumulativePct = i > 0 ? dates[i - 1].pct : 0;
    const installment = Math.floor(netAdvanceTax * (cumulativePct - prevCumulativePct) / 100);
    const paid = quarterPayments[i] || 0;

    // Cumulative paid up to this quarter
    const cumulativePaid = quarterPayments.slice(0, i + 1).reduce((s, p) => s + p, 0);
    const shortfall = Math.max(0, cumulativeTaxDue - cumulativePaid);

    const isPast = q.date < now;
    const isOverdue = isPast && shortfall > 0 && shouldPay;

    // Statutory 234C calculation
    let qPenalty = 0;
    if (shouldPay && isPast) {
      const safeHarborAmount = Math.floor(netAdvanceTax * statutorySafeHarbors[i] / 100);
      if (cumulativePaid < safeHarborAmount) {
        // Interest applies on difference between cumulative due and cumulative paid
        const taxableShortfall = Math.max(0, cumulativeTaxDue - cumulativePaid);
        qPenalty = Math.floor(taxableShortfall * 0.01 * statutoryMonths[i]);
      }
    }

    penalty234C += qPenalty;

    return {
      quarter: q.quarter,
      dueDate: q.date,
      cumulativePct,
      cumulativeTaxDuePaise: cumulativeTaxDue,
      installmentPaise: installment,
      paidPaise: paid,
      shortfallPaise: shortfall,
      isPast,
      isOverdue,
      penaltyEstPaise: qPenalty,
    };
  });

  // Section 234B calculation:
  // Triggered if total advance tax paid before March 31 is < 90% of assessed net advance tax
  let penalty234B = 0;
  const totalAdvancePaid = quarterPayments.reduce((s, p) => s + p, 0);
  const minRequired90Pct = Math.floor(netAdvanceTax * 0.9);

  if (shouldPay && totalAdvancePaid < minRequired90Pct) {
    const parsedStartYear = parseInt(fy.split('-')[0], 10) || now.getFullYear();
    const ayStartDate = new Date(parsedStartYear + 1, 3, 1); // April 1 of AY
    if (now >= ayStartDate) {
      // Months elapsed since April 1
      const monthsElapsed = Math.max(1, Math.ceil((now.getTime() - ayStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      const shortfall234B = Math.max(0, netAdvanceTax - totalAdvancePaid);
      penalty234B = Math.floor(shortfall234B * 0.01 * monthsElapsed);
    }
  }

  const totalPenalty = penalty234C + penalty234B;
  const nextDue = quarters.find((q) => !q.isPast) || null;

  // Form 10-IEA is required if user chooses Old Regime AND has trading/business income
  const hasBusinessIncome = tradeTax > 0 || (taxInput.capitalGains?.intradayPaise || 0) > 0;
  const form10IEARequired = betterRegime === 'old' && hasBusinessIncome;

  return {
    totalEstimatedTaxPaise: totalEstimatedTax,
    totalTDSPaise: tdsPaidPaise,
    netAdvanceTaxPaise: netAdvanceTax,
    regime: betterRegime,
    quarters,
    penalty234CPaise: penalty234C,
    penalty234BPaise: penalty234B,
    totalPenaltyPaise: totalPenalty,
    shouldPayAdvanceTax: shouldPay,
    nextDue,
    form10IEARequired,
  };
}
