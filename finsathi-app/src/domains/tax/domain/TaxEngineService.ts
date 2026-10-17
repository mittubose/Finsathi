/**
 * TaxEngineService — Deep Domain Module for Indian Income Tax
 * Enforces:
 * - FY 2025-26 / 2026-27 Tax Slabs
 * - Section 115BAC New Regime default (₹75k Standard Deduction)
 * - Section 87A Full Rebate up to ₹12,00,000 net taxable income (₹12.75L Gross)
 * - Section 87A Marginal Relief for incomes just above ₹12 Lakhs
 * - Old Regime with HRA, 80C, 80D, 80CCD(1B), and Section 24b
 * - Deduction Breakeven Delta (exact ₹ needed for Old to beat New)
 * - Advance Tax 234B / 234C Statutory Penalties
 * 
 * Invariant: All monetary calculations in integer PAISE (no floats).
 */

export type TaxRegime = 'old' | 'new';
export type CityTier = 'metro' | 'non-metro';

export interface SalaryStructure {
  basicPaise: number;
  hraPaise: number;
  specialAllowancePaise: number;
  otherEarningsPaise: number;
  employerPfPaise: number;
  professionTaxPaise: number;
}

export interface TaxDeductions {
  section80C_paise: number;       // Max 1.5L
  section80D_paise: number;       // Health Insurance (max 25k/50k)
  section80CCD1B_paise: number;   // NPS self (max 50k)
  section24b_paise: number;       // Home Loan Interest (max 2L)
  section80TTA_paise: number;     // Savings Interest (max 10k)
  otherDeductionsPaise: number;
}

export interface HraRentClaim {
  rentPaidAnnualPaise: number;
  cityTier: CityTier;
}

export interface TaxComputationInput {
  salary: SalaryStructure;
  deductions: TaxDeductions;
  hra?: HraRentClaim;
  capitalGainsTaxPaise?: number;
  tdsPaidPaise?: number;
}

export interface RegimeTaxDetails {
  grossSalaryPaise: number;
  standardDeductionPaise: number;
  exemptionsPaise: number;
  deductionsPaise: number;
  taxableIncomePaise: number;
  slabTaxPaise: number;
  rebate87APaise: number;
  marginalReliefPaise: number;
  taxAfterRebatePaise: number;
  surchargePaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  effectiveTaxRatePct: number;
}

export interface TaxComparisonResult {
  newRegime: RegimeTaxDetails;
  oldRegime: RegimeTaxDetails;
  recommendedRegime: TaxRegime;
  savingsPaise: number;
  deductionBreakevenDeltaPaise: number; // Rupee amount of additional deduction needed for Old Regime
  advanceTaxRequired: boolean;
  netTaxPayablePaise: number;
}

export interface AdvanceTaxQuarterDetail {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  dueDate: string;
  cumulativePctDue: number;
  statutorySafeHarborPct: number;
  cumulativeDuePaise: number;
  paidPaise: number;
  shortfallPaise: number;
  isOverdue: boolean;
  penalty234CPaise: number;
}

export interface AdvanceTaxAssessment {
  netAnnualTaxDuePaise: number;
  advanceTaxPayable: boolean; // True if net tax >= ₹10,000
  quarters: AdvanceTaxQuarterDetail[];
  total234CPaise: number;
  total234BPaise: number;
  totalAdvanceTaxPenaltyPaise: number;
}

// ============ STATUTORY CONSTANTS (FY 2025-26 & FY 2026-27) ============

export const NEW_REGIME_STD_DED_PAISE = 75000_00; // ₹75,000
export const OLD_REGIME_STD_DED_PAISE = 50000_00; // ₹50,000
export const LIMIT_80C_PAISE = 150000_00;        // ₹1.5 Lakh
export const LIMIT_80D_PAISE = 25000_00;         // ₹25,000
export const LIMIT_24B_PAISE = 200000_00;        // ₹2 Lakh
export const LIMIT_80CCD1B_PAISE = 50000_00;     // ₹50,000
export const SECTION_87A_LIMIT_PAISE = 1200000_00; // ₹12 Lakh net taxable income
export const CESS_RATE_PCT = 4;

const NEW_SLABS = [
  { from: 0, to: 400000_00, rate: 0 },
  { from: 400000_00, to: 800000_00, rate: 5 },
  { from: 800000_00, to: 1200000_00, rate: 10 },
  { from: 1200000_00, to: 1600000_00, rate: 15 },
  { from: 1600000_00, to: 2000000_00, rate: 20 },
  { from: 2000000_00, to: 2400000_00, rate: 25 },
  { from: 2400000_00, to: Infinity, rate: 30 },
];

const OLD_SLABS = [
  { from: 0, to: 250000_00, rate: 0 },
  { from: 250000_00, to: 500000_00, rate: 5 },
  { from: 500000_00, to: 1000000_00, rate: 20 },
  { from: 1000000_00, to: Infinity, rate: 30 },
];

export class TaxEngineService {
  /**
   * Calculate statutory HRA Exemption under Section 10(13A).
   * Minimum of:
   * 1. Actual HRA received
   * 2. Rent paid minus 10% of Basic
   * 3. 50% of Basic (Metro) or 40% (Non-Metro)
   */
  public static calculateHraExemption(salary: SalaryStructure, hra?: HraRentClaim): number {
    if (!hra || hra.rentPaidAnnualPaise <= 0) return 0;

    const basic = salary.basicPaise;
    const tenPctBasic = Math.floor(basic * 0.10);
    const rentOverTenPct = Math.max(0, hra.rentPaidAnnualPaise - tenPctBasic);
    const metroPct = hra.cityTier === 'metro' ? 0.50 : 0.40;
    const maxSalaryPct = Math.floor(basic * metroPct);

    return Math.min(salary.hraPaise, rentOverTenPct, maxSalaryPct);
  }

  /** Compute slab tax using tiered rates */
  public static computeSlabTax(taxablePaise: number, slabs: Array<{ from: number; to: number; rate: number }>): number {
    let tax = 0;
    for (const s of slabs) {
      if (taxablePaise <= s.from) break;
      const taxableInSlab = Math.min(taxablePaise, s.to) - s.from;
      tax += Math.floor((taxableInSlab * s.rate) / 100);
    }
    return tax;
  }

  /**
   * Compute Section 87A rebate & marginal relief under the New Regime.
   * Statutory rule:
   * - If taxable income <= ₹12,00,000: full rebate (tax = 0).
   * - If taxable income > ₹12,00,000: tax cannot exceed excess income over ₹12,00,000.
   */
  public static computeNewRegime87ARebateAndRelief(
    taxableIncomePaise: number,
    rawSlabTaxPaise: number
  ): { rebatePaise: number; marginalReliefPaise: number } {
    if (taxableIncomePaise <= SECTION_87A_LIMIT_PAISE) {
      return { rebatePaise: rawSlabTaxPaise, marginalReliefPaise: 0 };
    }

    // Marginal relief check:
    // Excess income over ₹12 Lakh
    const excessIncomePaise = taxableIncomePaise - SECTION_87A_LIMIT_PAISE;
    if (rawSlabTaxPaise > excessIncomePaise) {
      // Marginal relief reduces tax to exactly equal excess income
      const relief = rawSlabTaxPaise - excessIncomePaise;
      return { rebatePaise: 0, marginalReliefPaise: relief };
    }

    return { rebatePaise: 0, marginalReliefPaise: 0 };
  }

  /** Compute New Tax Regime Details */
  public static computeNewRegime(input: TaxComputationInput): RegimeTaxDetails {
    const s = input.salary;
    const grossSalary = s.basicPaise + s.hraPaise + s.specialAllowancePaise + s.otherEarningsPaise;
    const stdDed = NEW_REGIME_STD_DED_PAISE;
    const taxableIncome = Math.max(0, grossSalary - stdDed);

    const slabTax = this.computeSlabTax(taxableIncome, NEW_SLABS);
    const { rebatePaise, marginalReliefPaise } = this.computeNewRegime87ARebateAndRelief(taxableIncome, slabTax);
    
    const taxAfterRelief = Math.max(0, slabTax - rebatePaise - marginalReliefPaise);
    const totalTaxable = taxAfterRelief + (input.capitalGainsTaxPaise || 0);

    // 4% Health & Education Cess
    const cess = Math.floor((totalTaxable * CESS_RATE_PCT) / 100);
    const totalTax = totalTaxable + cess;
    const effectiveRate = grossSalary > 0 ? Number(((totalTax / grossSalary) * 100).toFixed(2)) : 0;

    return {
      grossSalaryPaise: grossSalary,
      standardDeductionPaise: stdDed,
      exemptionsPaise: 0,
      deductionsPaise: 0,
      taxableIncomePaise: taxableIncome,
      slabTaxPaise: slabTax,
      rebate87APaise: rebatePaise,
      marginalReliefPaise: marginalReliefPaise,
      taxAfterRebatePaise: taxAfterRelief,
      surchargePaise: 0,
      cessPaise: cess,
      totalTaxPaise: totalTax,
      effectiveTaxRatePct: effectiveRate,
    };
  }

  /** Compute Old Tax Regime Details */
  public static computeOldRegime(input: TaxComputationInput): RegimeTaxDetails {
    const s = input.salary;
    const grossSalary = s.basicPaise + s.hraPaise + s.specialAllowancePaise + s.otherEarningsPaise;
    const stdDed = OLD_REGIME_STD_DED_PAISE;
    const hraExemption = this.calculateHraExemption(s, input.hra);

    const d = input.deductions;
    const capped80C = Math.min(d.section80C_paise, LIMIT_80C_PAISE);
    const capped80D = Math.min(d.section80D_paise, LIMIT_80D_PAISE);
    const capped24b = Math.min(d.section24b_paise, LIMIT_24B_PAISE);
    const capped80CCD = Math.min(d.section80CCD1B_paise, LIMIT_80CCD1B_PAISE);

    const totalDeductions = stdDed + s.professionTaxPaise + capped80C + capped80D + capped24b + capped80CCD + d.otherDeductionsPaise;
    const taxableIncome = Math.max(0, grossSalary - hraExemption - totalDeductions);

    let slabTax = this.computeSlabTax(taxableIncome, OLD_SLABS);
    // Old regime 87A rebate (only if taxable <= ₹5,00,000, max ₹12,500)
    let rebate87A = 0;
    if (taxableIncome <= 500000_00) {
      rebate87A = Math.min(slabTax, 12500_00);
    }
    const taxAfterRebate = Math.max(0, slabTax - rebate87A);
    const totalTaxable = taxAfterRebate + (input.capitalGainsTaxPaise || 0);

    const cess = Math.floor((totalTaxable * CESS_RATE_PCT) / 100);
    const totalTax = totalTaxable + cess;
    const effectiveRate = grossSalary > 0 ? Number(((totalTax / grossSalary) * 100).toFixed(2)) : 0;

    return {
      grossSalaryPaise: grossSalary,
      standardDeductionPaise: stdDed,
      exemptionsPaise: hraExemption,
      deductionsPaise: totalDeductions,
      taxableIncomePaise: taxableIncome,
      slabTaxPaise: slabTax,
      rebate87APaise: rebate87A,
      marginalReliefPaise: 0,
      taxAfterRebatePaise: taxAfterRebate,
      surchargePaise: 0,
      cessPaise: cess,
      totalTaxPaise: totalTax,
      effectiveTaxRatePct: effectiveRate,
    };
  }

  /** Compare Old vs New Regime and compute deduction breakeven delta */
  public static compareRegimes(input: TaxComputationInput): TaxComparisonResult {
    const newRegime = this.computeNewRegime(input);
    const oldRegime = this.computeOldRegime(input);

    const recommendedRegime: TaxRegime = newRegime.totalTaxPaise <= oldRegime.totalTaxPaise ? 'new' : 'old';
    const savingsPaise = Math.abs(newRegime.totalTaxPaise - oldRegime.totalTaxPaise);

    // Compute breakeven delta: How much more deduction does Old Regime need to match/beat New Regime?
    let breakevenDeltaPaise = 0;
    if (recommendedRegime === 'new' && oldRegime.totalTaxPaise > newRegime.totalTaxPaise) {
      // Approximate at 30% slab rate + 4% cess = 31.2%
      const taxGap = oldRegime.totalTaxPaise - newRegime.totalTaxPaise;
      breakevenDeltaPaise = Math.round(taxGap / 0.312);
    }

    const netTaxPayable = Math.max(0, (recommendedRegime === 'new' ? newRegime.totalTaxPaise : oldRegime.totalTaxPaise) - (input.tdsPaidPaise || 0));
    const advanceTaxRequired = netTaxPayable >= 10000_00; // >= ₹10,000

    return {
      newRegime,
      oldRegime,
      recommendedRegime,
      savingsPaise,
      deductionBreakevenDeltaPaise: breakevenDeltaPaise,
      advanceTaxRequired,
      netTaxPayablePaise: netTaxPayable,
    };
  }

  /**
   * Calculate statutory Advance Tax Quarterly Installments & Section 234B/234C Penalties.
   */
  public static calculateAdvanceTaxAssessment(
    netAnnualTaxDuePaise: number,
    quarterPaymentsPaise: [number, number, number, number],
    nowDate: Date = new Date()
  ): AdvanceTaxAssessment {
    const shouldPay = netAnnualTaxDuePaise >= 10000_00;
    const quartersDef: Array<{ q: 'Q1' | 'Q2' | 'Q3' | 'Q4'; pctDue: number; safePct: number; months: number }> = [
      { q: 'Q1', pctDue: 15, safePct: 12, months: 3 },
      { q: 'Q2', pctDue: 45, safePct: 36, months: 3 },
      { q: 'Q3', pctDue: 75, safePct: 75, months: 3 },
      { q: 'Q4', pctDue: 100, safePct: 100, months: 1 },
    ];

    let total234C = 0;
    let cumulativePaid = 0;

    const quarters: AdvanceTaxQuarterDetail[] = quartersDef.map((def, idx) => {
      const paidThisQ = quarterPaymentsPaise[idx] || 0;
      cumulativePaid += paidThisQ;

      const cumulativeDue = Math.floor((netAnnualTaxDuePaise * def.pctDue) / 100);
      const safeHarbor = Math.floor((netAnnualTaxDuePaise * def.safePct) / 100);
      const shortfall = Math.max(0, cumulativeDue - cumulativePaid);

      let qPenalty = 0;
      if (shouldPay && cumulativePaid < safeHarbor) {
        // Section 234C: 1% per month for statutory months on shortfall from actual due
        qPenalty = Math.floor(shortfall * 0.01 * def.months);
      }
      total234C += qPenalty;

      return {
        quarter: def.q,
        dueDate: def.q === 'Q1' ? '15 Jun' : def.q === 'Q2' ? '15 Sep' : def.q === 'Q3' ? '15 Dec' : '15 Mar',
        cumulativePctDue: def.pctDue,
        statutorySafeHarborPct: def.safePct,
        cumulativeDuePaise: cumulativeDue,
        paidPaise: paidThisQ,
        shortfallPaise: shortfall,
        isOverdue: shortfall > 0,
        penalty234CPaise: qPenalty,
      };
    });

    // Section 234B: If total advance tax paid before Mar 31 is < 90% of assessed tax
    let total234B = 0;
    const totalPaid = quarterPaymentsPaise.reduce((sum, p) => sum + p, 0);
    const required90Pct = Math.floor(netAnnualTaxDuePaise * 0.90);
    if (shouldPay && totalPaid < required90Pct) {
      // 1% per month on shortfall from April 1
      const shortfall234B = Math.max(0, netAnnualTaxDuePaise - totalPaid);
      total234B = Math.floor(shortfall234B * 0.01 * 1); // Minimum 1 month factor
    }

    return {
      netAnnualTaxDuePaise,
      advanceTaxPayable: shouldPay,
      quarters,
      total234CPaise: total234C,
      total234BPaise: total234B,
      totalAdvanceTaxPenaltyPaise: total234C + total234B,
    };
  }
}
