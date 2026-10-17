/**
 * Date utilities for Indian Financial Year logic.
 * FY runs April 1 → March 31.
 */

/** Get FY string for a date. e.g. "2025-26" for dates Apr 2025 – Mar 2026. */
export function getFY(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  const startYear = month >= 3 ? year : year - 1; // Apr(3)–Mar(2)
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/** Get FY start date (April 1). */
export function getFYStart(fy: string): Date {
  const startYear = parseInt(fy.split('-')[0]);
  return new Date(startYear, 3, 1); // April 1
}

/** Get FY end date (March 31). */
export function getFYEnd(fy: string): Date {
  const startYear = parseInt(fy.split('-')[0]);
  return new Date(startYear + 1, 2, 31); // March 31
}

/** Get current FY. */
export function getCurrentFY(): string {
  return getFY(new Date());
}

/** Check if date falls within a FY. */
export function isInFY(date: Date, fy: string): boolean {
  const start = getFYStart(fy);
  const end = getFYEnd(fy);
  return date >= start && date <= end;
}

/** Calculate holding period in days. */
export function holdingDays(buyDate: Date, sellDate: Date): number {
  const diff = sellDate.getTime() - buyDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Check if a trade is long-term (≥ 12 months for equity). */
export function isLongTerm(buyDate: Date, sellDate: Date): boolean {
  const months =
    (sellDate.getFullYear() - buyDate.getFullYear()) * 12 +
    (sellDate.getMonth() - buyDate.getMonth());
  return months >= 12;
}

/** Format date as relative time for activity feed. */
export function relativeTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (diffDays === 0) return `TODAY ${time}`;
  if (diffDays === 1) return `YESTERDAY ${time}`;
  if (diffDays < 7) return `${diffDays}D AGO ${time}`;

  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }).toUpperCase() + ` ${time}`;
}

/** Advance tax quarterly due dates for a FY. */
export function advanceTaxDates(fy: string): { quarter: string; date: Date; pct: number }[] {
  const startYear = parseInt(fy.split('-')[0]);
  return [
    { quarter: 'Q1', date: new Date(startYear, 5, 15), pct: 15 },     // Jun 15
    { quarter: 'Q2', date: new Date(startYear, 8, 15), pct: 45 },     // Sep 15
    { quarter: 'Q3', date: new Date(startYear, 11, 15), pct: 75 },    // Dec 15
    { quarter: 'Q4', date: new Date(startYear + 1, 2, 15), pct: 100 }, // Mar 15
  ];
}

/** Get a range of calendar years (e.g. for dropdowns) */
export function getYearRange(startYear = 2000, endYear = new Date().getFullYear() + 5): number[] {
  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }
  return years;
}

/** Get a range of Financial Years (e.g. for dropdowns) */
export function getFYRange(startYear = 2000, endYear = new Date().getFullYear() + 5): string[] {
  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(`${y}-${String(y + 1).slice(2)}`);
  }
  return years;
}
