export interface GlossaryTerm {
  term: string;
  definition: string;
  relevance: string;
}

export const TAX_GLOSSARY: GlossaryTerm[] = [
  {
    term: 'TDS (Tax Deducted at Source)',
    definition: 'A system where the person responsible for making specified payments (like salary, interest, commission) deducts tax at the source and remits it to the government.',
    relevance: 'TDS ensures the government collects tax regularly throughout the year rather than at the end of the year.',
  },
  {
    term: 'Form 16',
    definition: 'A certificate issued by an employer to its employees, stating the amount of tax deducted (TDS) and the salary components for the financial year.',
    relevance: 'Essential for filing income tax returns; it contains Part A (TDS details) and Part B (salary breakup).',
  },
  {
    term: 'Section 80C',
    definition: 'A popular section of the Income Tax Act that allows deductions up to ₹1.5 lakh for investments in PPF, ELSS, LIC, EPF, etc.',
    relevance: 'Reduces your taxable income, effectively lowering your total tax liability.',
  },
  {
    term: 'STCG (Short Term Capital Gains)',
    definition: 'Profit from the sale of assets held for a short duration. For listed equities, it is less than 12 months.',
    relevance: 'STCG on listed equities is typically taxed at a flat rate (currently 20%).',
  },
  {
    term: 'LTCG (Long Term Capital Gains)',
    definition: 'Profit from the sale of assets held for a longer duration. For listed equities, it is more than 12 months.',
    relevance: 'LTCG on listed equities is taxed at 12.5% for gains exceeding ₹1.25 lakh in a financial year.',
  },
  {
    term: 'Surcharge',
    definition: 'An additional tax levied on the tax amount itself, applicable to high-income earners (usually above ₹50 lakh).',
    relevance: 'It is a "tax on tax" meant to increase the progressive nature of the tax system.',
  },
  {
    term: 'Cess (Health & Education Cess)',
    definition: 'A 4% levy on the sum of income tax and surcharge, collected to fund health and education initiatives.',
    relevance: 'Applicable to all taxpayers, regardless of their income level.',
  },
  {
    term: 'Rebate (Section 87A)',
    definition: 'A tax relief provided to individuals whose taxable income does not exceed a specified limit (₹7 lakh in the new regime).',
    relevance: 'It effectively makes your tax zero if your income is below the threshold.',
  },
  {
    term: 'Standard Deduction',
    definition: 'A flat deduction of ₹75,000 (FY 2024-25) available to salaried individuals from their gross salary.',
    relevance: 'Reduces taxable salary without requiring any proof of investment or expense.',
  },
  {
    term: 'HRA (House Rent Allowance)',
    definition: 'A component of salary provided by employers to help employees meet the cost of rented accommodation.',
    relevance: 'Can be partially or fully exempt from tax if the employee lives in a rented house.',
  },
];
