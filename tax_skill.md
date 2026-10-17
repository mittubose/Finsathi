# tax-skill.md

## Purpose
This document teaches the app, and the person using it, how Indian salary taxation, trading taxation, deductions, exemptions, and tax-saving behavior should be understood and modeled. It is designed as a product and implementation skill guide for a finance app, not as legal advice.

## What this skill must do
- Explain Indian salary taxation in plain language.
- Explain old regime vs new regime clearly.
- Classify salary components, deductions, exemptions, and taxable parts.
- Track trading income, capital gains, capital losses, and loss harvesting opportunities.
- Support salary + trading + manual expense records together.
- Identify tax-saving actions without encouraging illegal claims.
- Teach the app to show assumptions, exceptions, and confidence.

## Core tax concepts
### Financial year and assessment year
- Financial year is the period from 1 April to 31 March.
- Assessment year is the year after the financial year, when return filing happens.
- Every calculation in the app must use financial-year logic, not calendar-year logic.

### Taxable income
Taxable income is the amount left after allowed exemptions and deductions are applied to gross income. Salary, trading profits, interest, rent, and other taxable income can all contribute to taxable income depending on the source and regime.

### Exemption
An exemption is an amount that is excluded from tax if conditions are satisfied. Example: HRA exemption under the old regime when the user pays rent and meets the rule conditions.

### Deduction
A deduction reduces income after it is earned, subject to section rules and limits. Example: PF, 80C, 80D, standard deduction, and some employer contributions depending on the regime.

### Allowance
An allowance is a component paid by employer as part of salary. Some allowances are fully taxable, some are partly exempt, and some are exempt only under specific conditions.

## Salary components
### Common earnings list
- Basic salary
- HRA
- Conveyance allowance
- Special allowance
- Communication allowance
- Gratuity
- Leave travel allowance
- Personal allowance
- Employer PF contribution
- Employer EDLI contribution
- Joola gratuity, arrears, or similar company-specific components

### General treatment guide
| Component | Typical tax treatment | Notes |
|---|---|---|
| Basic salary | Fully taxable | Forms the base for several calculations |
| HRA | Partly exempt in old regime | Depends on rent paid, city type, and salary structure |
| Conveyance allowance | Usually taxable unless a specific exemption applies | Many payrolls include it as taxable salary |
| Special allowance | Usually fully taxable | Often used to balance CTC |
| Communication allowance | Usually taxable if not reimbursement-based with proof | Policy-specific treatment matters |
| Gratuity | Tax treatment depends on source and limits | Employer gratuity has special exemptions in many cases |
| LTA | Exempt only when conditions are met | Travel must satisfy documentation and eligible route rules |
| Personal allowance | Usually taxable | No automatic exemption unless specifically allowed |
| Employer PF contribution | May be exempt up to applicable limit | Treatment depends on law and contribution structure |
| Employer EDLI contribution | Usually not part of employee taxable salary as such | Payroll-specific handling should be verified |
| PF deduction | Employee contribution may qualify under deductions depending on regime | Old regime usually benefits more from deduction use |
| Profession tax | Usually deductible where allowed | State-specific |
| Labour welfare fund | Payroll/state-specific deduction | Usually not a tax-saving instrument |

## New regime
### Understanding
The new regime generally offers lower slab rates but removes most common deductions and exemptions. It is simpler, often better for users with limited deductions, and is usually the default planning baseline for many salaried users.

### What to expect
- Standard deduction is commonly available to salaried users.
- Most deductions like 80C, 80D, HRA, and LTA are generally not available.
- Some employer-side contributions and limited specific items may still remain relevant.
- The app should always compute the current law version rather than hardcoding assumptions.

### When new regime tends to win
- Salary structure has high taxable allowances and few deductions.
- User does not pay rent.
- User does not maximize 80C and 80D.
- User wants simpler compliance.

## Old regime
### Understanding
The old regime allows many exemptions and deductions, which can make it better for users with rent, insurance, investments, home loan interest, and other eligible tax-saving items. It is more complex but can be tax-efficient when the user has a strong deductible structure.

### When old regime tends to win
- User pays significant rent and can claim HRA.
- User invests meaningfully in 80C instruments.
- User claims 80D health insurance.
- User has eligible home loan interest or other valid deductions.
- User’s salary breakup contains multiple allowances that can be optimized legally.

## Rules and exceptions
### Rules
- Never assume a component is tax-free just because it appears in payroll.
- Never assume a deduction is available in both regimes.
- Never claim an exemption without checking conditions and documentation.
- Every tax computation should show the assumption set used.
- Every output should show whether the answer is estimated or confirmed.

### Exceptions
- Company payroll naming may not reflect tax treatment.
- Some allowances are reimbursement-based and need proofs.
- Some deductions are limited by annual caps.
- Employer contributions may have different treatment from employee deductions.
- Regime choices and limits can change across financial years.

## Salary term definitions
### Basic
The fixed core of salary, usually taxable, and used as a reference for several benefits and calculations.

### HRA
House Rent Allowance. Under the old regime, part of it can be exempt if rent, salary structure, and city conditions are satisfied.

### Conveyance allowance
An allowance meant for travel or commute costs. Tax treatment depends on policy and applicable law; do not assume exemption without rule support.

### Special allowance
A flexible salary head often used to balance gross salary. It is usually fully taxable.

### Communication allowance
Allowance for phone, internet, or related work expenses. It may be taxable unless treated as reimbursement with proof and policy support.

### Gratuity
A retirement-linked benefit. Employee-facing tax treatment depends on whether it is actual gratuity, reimbursement, or a company-specific pay item.

### Leave travel allowance
LTA is linked to travel within the allowed framework and can be exempt only when the rules are satisfied.

### Personal allowance
Usually a taxable salary component with no special exemption by default.

### Employer PF contribution
Employer contribution to provident fund. Treatment depends on statutory and tax rules and should be modeled carefully.

### Employer EDLI contribution
Employer contribution to Employee Deposit Linked Insurance. Usually handled as payroll cost rather than a regular employee taxable receipt.

### PF
Employee provident fund contribution. Often important for retirement planning and, in the old regime, for deduction planning.

### Profession tax
State-level tax on employment income. Often deductible where permitted and should be tracked separately from income tax.

### Labour welfare fund
A payroll deduction mandated by some states or employers. Usually not a major tax optimization lever, but should be recorded accurately.

## Trading and loss harvesting
### Trading categories to support
- Intraday equity
- Swing trades
- Short-term delivery equity
- Long-term delivery equity
- Mutual funds if user imports them
- Other instruments only if explicitly modeled

### Core logic
- Short holding periods generally create short-term treatment.
- Longer holding periods generally create long-term treatment.
- Losses should be tracked separately by type because set-off rules differ.
- User should see realized and unrealized gains clearly.

### Loss harvesting idea
Loss harvesting means realizing a loss intentionally in a legal way so it can offset eligible gains and reduce tax liability. This should only be suggested when the app sees a real opportunity and should never be framed as guaranteed savings.

### Set-off awareness
- Short-term losses may be usable against short-term and long-term gains where rules permit.
- Long-term losses are more restricted and should be tracked separately.
- Carry-forward support should be shown if the app later stores full-year tax history.

## Do and don’t
### Do
- Do compare old and new regimes before deciding.
- Do preserve source documents and notes for every claimed deduction.
- Do keep payroll components and tax deductions separate in the data model.
- Do flag ambiguous items for manual review.
- Do show the legal basis or rule label for each tax-saving suggestion.
- Do support loss-harvesting alerts with explicit trade dates and gain/loss estimates.
- Do calculate with financial-year boundaries.

### Don’t
- Don’t assume every allowance is exempt.
- Don’t auto-claim deductions that need proof.
- Don’t mix employer cost items with employee deductions without labeling.
- Don’t hide rule changes inside a generic “savings” number.
- Don’t recommend tax actions without showing conditions and exceptions.
- Don’t use a single number when the answer depends on regime choice.
- Don’t treat trading data as salary data.

## Must-have product features
- Salary breakup analyzer.
- Old vs new regime comparison.
- Deduction checklist with progress and limits.
- Trading gain/loss dashboard.
- Loss harvesting suggestions.
- Tax estimate with assumptions and confidence.
- Yearly and monthly breakdown views.
- Document storage for proof and notes.
- Recurring tax reminders.
- Manual override for edge cases.

## Calculation model
### Salary tax flow
1. Start with gross earnings.
2. Separate taxable salary heads from exempt or conditionally exempt heads.
3. Apply regime-specific allowed deductions and exemptions.
4. Add trading gains according to correct classification.
5. Compute taxable income.
6. Apply slab rates.
7. Add cess, surcharge, and other applicable adjustments where relevant.
8. Compare with TDS and estimate payable or refundable amount.

### Suggested UI output fields
- Gross salary
- Taxable salary
- Allowed deductions
- Regime comparison
- Trading gains by type
- Total taxable income
- Estimated tax
- TDS already deducted
- Balance tax payable or refund
- Suggested actions

## Data model hints for the app
- `income_items` should store head, amount, source, financial year, tax flag, and notes.
- `deductions` should store section, amount, proof status, regime eligibility, and limits.
- `trades` should store instrument, entry date, exit date, quantity, cost, proceeds, classification, and realized P&L.
- `tax_rules` should be versioned by financial year.
- `documents` should store proof images or files.

## Common app warnings
- “This item is taxable unless your payroll policy says otherwise.”
- “This deduction may require proof.”
- “This suggestion is based on the old regime.”
- “This trade loss may help offset future gains.”
- “This value is an estimate and should be verified before filing.”

## Edge cases to handle
- Salary component changes mid-year.
- Multiple employers in one year.
- Missing HRA or rent receipts.
- Partial salary arrears or bonus.
- Employer contribution items appearing in CTC but not take-home.
- Mixed trading styles in the same account.
- Imported rows with duplicate dates or amounts.
- Fiscal-year boundary around March 31.
- Tax rule changes in a later release.

## Suggested reading order for users and agents
1. Financial year basics.
2. Salary component classification.
3. Old regime vs new regime.
4. Deductions and exemptions.
5. Trading and capital gains.
6. Loss harvesting.
7. Proof and documentation.
8. Edge cases and manual review.

## Final note
This skill should always help the user understand how to reduce unnecessary tax leakage legally, how to distinguish taxable salary from non-taxable components, and how to use trading losses and deductions intelligently without oversimplifying the rules.
