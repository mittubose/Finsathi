/**
 * Currency utilities — all amounts stored as paise (integer).
 * No floating point math for money.
 * Hardened against NaN, undefined, null, and non-numeric input.
 */

/** Convert rupees (number or numeric string) to paise (integer). */
export function toPaise(rupees: number | string | null | undefined): number {
  if (rupees === null || rupees === undefined || rupees === '') return 0;
  const num = typeof rupees === 'string' ? parseFloat(rupees.replace(/,/g, '')) : rupees;
  if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100);
}

/** Convert paise (integer) to rupees for display. */
export function toRupees(paise: number | null | undefined): number {
  if (paise === null || paise === undefined || isNaN(paise) || !isFinite(paise)) return 0;
  return paise / 100;
}

/** Format paise as ₹ string with Indian number system grouping. Safe against NaN/null. */
export function formatINR(paise: number | null | undefined, opts?: { sign?: boolean }): string {
  if (paise === null || paise === undefined || isNaN(paise) || !isFinite(paise)) {
    return '₹0.00';
  }

  const rupees = toRupees(paise);
  const abs = Math.abs(rupees);
  const isNeg = rupees < 0;

  // Indian number system: 1,23,456.78
  const parts = abs.toFixed(2).split('.');
  let intPart = parts[0] || '0';
  const decPart = parts[1] || '00';

  // First group of 3, then groups of 2
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const groups: string[] = [];
    for (let i = rest.length; i > 0; i -= 2) {
      groups.unshift(rest.slice(Math.max(0, i - 2), i));
    }
    intPart = groups.join(',') + ',' + last3;
  }

  const formatted = `₹${intPart}.${decPart}`;

  if (opts?.sign) {
    return isNeg ? `-${formatted}` : `+${formatted}`;
  }
  return isNeg ? `-${formatted}` : formatted;
}

/** Format paise as compact string (₹1.2L, ₹50K). Safe against NaN. */
export function formatINRCompact(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || isNaN(paise) || !isFinite(paise)) {
    return '₹0';
  }

  const rupees = Math.abs(toRupees(paise));
  const isNeg = paise < 0;
  const prefix = isNeg ? '-₹' : '₹';

  if (rupees >= 10_000_000) {
    return `${prefix}${(rupees / 10_000_000).toFixed(1)}Cr`;
  }
  if (rupees >= 100_000) {
    return `${prefix}${(rupees / 100_000).toFixed(1)}L`;
  }
  if (rupees >= 1_000) {
    return `${prefix}${(rupees / 1_000).toFixed(1)}K`;
  }
  return `${prefix}${rupees.toFixed(0)}`;
}

/** Format paise as INR, but mask it if privacy mode is enabled. */
export function formatINRMasked(paise: number | null | undefined, privacyMode: boolean, opts?: { sign?: boolean }): string {
  if (privacyMode) return '₹ •••••';
  return formatINR(paise, opts);
}
