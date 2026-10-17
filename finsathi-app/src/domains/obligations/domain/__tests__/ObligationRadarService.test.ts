import test from 'node:test';
import assert from 'node:assert';
import { ObligationRadarService, type ObligationItem } from '../ObligationRadarService.ts';

test('ObligationRadarService — Free Cash After Commitments calculation', () => {
  const netSalaryPaise = 150000_00; // ₹1,50,000 / month

  const obligations: ObligationItem[] = [
    { id: '1', name: 'Nifty 50 SIP', category: 'sip', amountPaise: 30000_00, dueDate: '2026-11-05', isPaid: false },
    { id: '2', name: 'Midcap Index SIP', category: 'sip', amountPaise: 20000_00, dueDate: '2026-11-10', isPaid: false },
    { id: '3', name: 'HDFC Infinia Statement', category: 'credit_card', amountPaise: 45000_00, dueDate: '2026-11-20', isPaid: false },
    { id: '4', name: 'Apartment Rent', category: 'rent', amountPaise: 28000_00, dueDate: '2026-11-01', isPaid: false },
    { id: '5', name: 'Already Paid Electricity', category: 'utility', amountPaise: 3000_00, dueDate: '2026-10-25', isPaid: true }, // Should be ignored
  ];

  const analysis = ObligationRadarService.computeFreeCashAfterCommitments(netSalaryPaise, obligations);

  // Total SIPs: 30k + 20k = 50k
  assert.strictEqual(analysis.totalScheduledSipsPaise, 50000_00);
  // Total Credit Cards: 45k
  assert.strictEqual(analysis.totalCreditCardsDuePaise, 45000_00);
  // Total Fixed: 28k (Rent)
  assert.strictEqual(analysis.totalFixedBillsPaise, 28000_00);

  // Total Committed = 50k + 45k + 28k = 123k
  // Free Cash = 150k - 123k = 27k (₹27,000)
  assert.strictEqual(analysis.freeCashAfterCommitmentsPaise, 27000_00);
  // Burn rate: (123 / 150) * 100 = 82.0%
  assert.strictEqual(analysis.burnRatePercentage, 82.0);
  // Free cash (27k) is 18% of 150k (< 20%), so isSafeForTradingDeploy should be false
  assert.strictEqual(analysis.isSafeForTradingDeploy, false);
});

test('ObligationRadarService — Monthly Bucket Snapshot aggregation', () => {
  const snapshot = ObligationRadarService.createMonthlySnapshot(
    '2026-10',
    42000_00,  // Credit Card Statement
    18000_00,  // UPI Outflows
    35000_00,  // Fixed Obligations
    28000_00   // Tax Relevant Receipts (HRA rent)
  );

  assert.strictEqual(snapshot.totalOutflowPaise, 95000_00);
  assert.strictEqual(snapshot.taxRelevantReceiptsPaise, 28000_00);
});
