import test from 'node:test';
import assert from 'node:assert';
import { CapitalLedgerService, type RawTrade } from '../CapitalLedgerService.ts';

test('CapitalLedgerService — FIFO Matching with partial lot consumption and LTCG exemption', () => {
  const trades: RawTrade[] = [
    // Buy 100 shares of RELIANCE on 2024-01-10 @ ₹2,000
    { id: 't1', symbol: 'RELIANCE', side: 'BUY', date: '2024-01-10', qty: 100, pricePaise: 2000_00, chargesPaise: 0 },
    // Buy 50 shares of RELIANCE on 2024-06-15 @ ₹2,200
    { id: 't2', symbol: 'RELIANCE', side: 'BUY', date: '2024-06-15', qty: 50, pricePaise: 2200_00, chargesPaise: 0 },
    // Sell 120 shares of RELIANCE on 2025-02-20 @ ₹2,500 (100 LTCG from t1, 20 STCG from t2)
    { id: 't3', symbol: 'RELIANCE', side: 'SELL', date: '2025-02-20', qty: 120, pricePaise: 2500_00, chargesPaise: 0 },
  ];

  const summary = CapitalLedgerService.computeCapitalGainsSummary(trades);

  // Matched lots count should be 2 (100 from t1, 20 from t2)
  assert.strictEqual(summary.matchedLots.length, 2);

  // Lot 1: 100 shares, held Jan 2024 to Feb 2025 (>365 days) -> LTCG
  // Profit = 100 * (2500 - 2000) = ₹50,000
  const lot1 = summary.matchedLots[0];
  assert.strictEqual(lot1.qty, 100);
  assert.strictEqual(lot1.gainCategory, 'LTCG');
  assert.strictEqual(lot1.realizedPnlPaise, 50000_00);

  // Lot 2: 20 shares, held Jun 2024 to Feb 2025 (<=365 days) -> STCG
  // Profit = 20 * (2500 - 2200) = ₹6,000
  const lot2 = summary.matchedLots[1];
  assert.strictEqual(lot2.qty, 20);
  assert.strictEqual(lot2.gainCategory, 'STCG');
  assert.strictEqual(lot2.realizedPnlPaise, 6000_00);

  // Total Realized LTCG = ₹50,000. Under ₹1,25,000 exemption, LTCG tax is 0!
  assert.strictEqual(summary.ltcgExemptionUsedPaise, 50000_00);
  assert.strictEqual(summary.ltcgExemptionRemainingPaise, 75000_00); // 1.25L - 50k = 75k
  assert.strictEqual(summary.ltcgTaxPaise, 0);

  // STCG tax @ 20% on ₹6,000 = ₹1,200
  assert.strictEqual(summary.stcgTaxPaise, 1200_00);
  assert.strictEqual(summary.totalCapitalGainsTaxPaise, 1200_00);
});

test('CapitalLedgerService — Loss Set-Off: STCL offsets STCG and spills to LTCG', () => {
  const trades: RawTrade[] = [
    // Profitable LTCG trade: +₹2,00,000
    { id: 'b1', symbol: 'TCS', side: 'BUY', date: '2023-01-01', qty: 100, pricePaise: 1000_00, chargesPaise: 0 },
    { id: 's1', symbol: 'TCS', side: 'SELL', date: '2024-06-01', qty: 100, pricePaise: 3000_00, chargesPaise: 0 }, // +2L LTCG
    // Loss STCG trade: -₹50,000
    { id: 'b2', symbol: 'INFY', side: 'BUY', date: '2024-05-01', qty: 100, pricePaise: 1500_00, chargesPaise: 0 },
    { id: 's2', symbol: 'INFY', side: 'SELL', date: '2024-06-01', qty: 100, pricePaise: 1000_00, chargesPaise: 0 }, // -50k STCL
  ];

  const summary = CapitalLedgerService.computeCapitalGainsSummary(trades);

  // STCL of 50k offsets LTCG of 200k -> Net LTCG = 150k
  // LTCG after 1.25L exemption = 150k - 125k = 25k taxable LTCG
  assert.strictEqual(summary.taxableLtcgPaise, 25000_00);
  // LTCG tax @ 12.5% on 25k = ₹3,125
  assert.strictEqual(summary.ltcgTaxPaise, 3125_00);
});
