---
type: concept
tags: [company-law]
summary: "Formation, hiccups, annual compliance, fixing defaults, corporate disputes."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-11-02
---
# Company law and corporate compliance

Spec: FR-15 in [[legal-copilot-spec-v0.5]]. User: [[persona-founder-sme]].

## 1. Conversational situation discovery & entity choice ("LLP or Pvt Ltd?")
When founders don't know what structure to form, [[corporate-counsel]] first explains the decision: who owns the business, personal responsibility for debts and claims, bringing in investors, and ongoing administration. It asks only one to three missing questions that change the next step and gives a conditional recommendation without inventing fundraising, hiring or foreign-ownership plans.

For a solo founder, realistic options can include operating in their own name (sole proprietorship), a one-person company (OPC), or a private limited company when their plans justify it. Explain required partners/owners and limits of protection rather than categorically excluding options or encouraging sham participants. A compact comparison is optional, not a mandatory table of costs and forms. Recognition, tax benefits, audits and eligibility need separate current-rule verification; the web assistant must not promise them.

Once facts and structure are clear, explain the relevant registration steps and official form names alongside their purpose. Later compliance stays separate from immediate actions. Requested detailed checklists and drafts remain available. This follows the shared context-first answer policy in [[any-stage-onboarding]] and canonical spec FR-1.4/FR-15.1.

## 2. Formation hiccups
Name rejected; a form returned for correction; signature/identity/address-proof issues; foreign-director documents; portal and payment errors. Explain the notice first, request the actual objection/form and preserve any stated deadline, then prepare a point-by-point correction. Introduce Registrar of Companies (RoC, the registration authority) only where it matters; do not replace a filing fix with a generic incorporation checklist.

## 3. Post-incorporation and annual compliance
Compliance calendar: INC-20A, ADT-1, board meetings, AGM, AOC-4, MGT-7/7A, DIR-3 KYC, DPT-3, MSME-1, registers, allotments/transfers, changes. Computed by [[rule-engines]].

## 4. Fixing past defaults
Exposure calculation; cheapest lawful fix — catch-up filing, condonation, compounding (s.441), adjudication (s.454), any active relief scheme; director disqualification (s.164(2)); restoration (s.252, NCLT); voluntary closure (STK-2). See [[companies-act-2013]].

## 5. Technicalities and transactions
Cap table, allotments, transfers, ESOPs, vesting, SHA/term-sheet basics, FEMA reporting, GST, DPIIT, Udyam, trademarks.

## 6. Corporate disputes
Oppression and mismanagement (ss.241–242), unpaid dues (legal notice, [[msmed-act-2006]] council, [[cheque-bounce]], [[ibc-2016]]) → [[dispute-mode]], [[nclt-and-ibc]].

Release requirement: forms, statutory deadlines and amounts must be versioned and professionally verified before being offered as deterministic compliance calculations. The current web company advisor does not have a company-compliance calculator or independent current-law verification; its response must identify what needs checking rather than claiming those capabilities.
