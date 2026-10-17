import test from 'node:test';
import assert from 'node:assert';
import { TaxEngineService, type TaxComputationInput } from '../TaxEngineService.ts';

test('TaxEngineService — FY 2025-26 New Regime Zero Tax up to ₹12.75L Gross', () => {
  const input: TaxComputationInput = {
    salary: {
      basicPaise: 600000_00,
      hraPaise: 300000_00,
      specialAllowancePaise: 375000_00,
      otherEarningsPaise: 0,
      employerPfPaise: 0,
      professionTaxPaise: 0,
    }, // Total Gross: ₹12,75,000
    deductions: {
      section80C_paise: 0,
      section80D_paise: 0,
      section80CCD1B_paise: 0,
      section24b_paise: 0,
      section80TTA_paise: 0,
      otherDeductionsPaise: 0,
    },
  };

  const result = TaxEngineService.computeNewRegime(input);

  // Taxable income = 12,75,000 - 75,000 std ded = 12,00,000
  assert.strictEqual(result.taxableIncomePaise, 1200000_00);
  // Full 87A rebate wipes out slab tax
  assert.strictEqual(result.totalTaxPaise, 0);
  assert.strictEqual(result.effectiveTaxRatePct, 0);
});

test('TaxEngineService — Section 87A Marginal Relief for Income just above ₹12 Lakhs', () => {
  // Gross ₹12,85,000 -> Taxable ₹12,10,000 (Excess over 12L is ₹10,000)
  const input: TaxComputationInput = {
    salary: {
      basicPaise: 600000_00,
      hraPaise: 300000_00,
      specialAllowancePaise: 385000_00,
      otherEarningsPaise: 0,
      employerPfPaise: 0,
      professionTaxPaise: 0,
    },
    deductions: {
      section80C_paise: 0,
      section80D_paise: 0,
      section80CCD1B_paise: 0,
      section24b_paise: 0,
      section80TTA_paise: 0,
      otherDeductionsPaise: 0,
    },
  };

  const result = TaxEngineService.computeNewRegime(input);
  assert.strictEqual(result.taxableIncomePaise, 1210000_00);

  // Raw slab tax on 12.1L:
  // 0-4L: 0
  // 4-8L: 20k
  // 8-12L: 40k
  // 12-12.1L (10k @ 15%): 1,500
  // Total raw tax = 61,500
  // Excess income over 12L = 10,000
  // Marginal relief = 61,500 - 10,000 = 51,500
  assert.strictEqual(result.marginalReliefPaise, 51500_00);
  assert.strictEqual(result.taxAfterRebatePaise, 10000_00);
  // Total tax = 10,000 + 4% cess (400) = 10,400
  assert.strictEqual(result.totalTaxPaise, 10400_00);
});

test('TaxEngineService — HRA Exemption Statutory Calculation', () => {
  const salary = {
    basicPaise: 1000000_00, // 10L
    hraPaise: 400000_00,   // 4L
    specialAllowancePaise: 0,
    otherEarningsPaise: 0,
    employerPfPaise: 0,
    professionTaxPaise: 0,
  };

  // Rent paid 3.6L in Metro (50% basic = 5L, Rent - 10% basic = 3.6L - 1L = 2.6L, actual = 4L)
  const exemption = TaxEngineService.calculateHraExemption(salary, {
    rentPaidAnnualPaise: 360000_00,
    cityTier: 'metro',
  });

  // Minimum is Rent - 10% Basic = 2.6L
  assert.strictEqual(exemption, 260000_00);
});

test('TaxEngineService — Advance Tax 234C Statutory Safe Harbors and Penalties', () => {
  const netAnnualTaxPaise = 100000_00; // ₹1,00,000 net tax
  // User paid ₹0 in Q1 and Q2, ₹50,000 in Q3, ₹50,000 in Q4
  const assessment = TaxEngineService.calculateAdvanceTaxAssessment(
    netAnnualTaxPaise,
    [0, 0, 50000_00, 50000_00]
  );

  assert.strictEqual(assessment.advanceTaxPayable, true);
  // Q1 due is 15k, safe harbor 12k. Paid 0. Shortfall = 15k. Penalty = 15k * 1% * 3 = 450
  assert.strictEqual(assessment.quarters[0].penalty234CPaise, 450_00);
  // Q2 cumulative due 45k, safe harbor 36k. Paid 0. Shortfall = 45k. Penalty = 45k * 1% * 3 = 1350
  assert.strictEqual(assessment.quarters[1].penalty234CPaise, 1350_00);
});
