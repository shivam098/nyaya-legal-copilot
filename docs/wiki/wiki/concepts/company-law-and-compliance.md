---
type: concept
tags: [company-law]
summary: "Formation, hiccups, annual compliance, fixing defaults, corporate disputes."
sources: ["[[legal-copilot-spec-v0.5]]"]
updated: 2026-10-24
---
# Company law and corporate compliance

Spec: FR-15 in [[legal-copilot-spec-v0.5]]. User: [[persona-founder-sme]].

## 1. Conversational situation discovery & entity choice ("LLP or Pvt Ltd?")
When founders don't know what structure to form (e.g., *"Two of us are starting out, should we register an LLP or Private Limited?"*), [[corporate-counsel]] runs a 4–5 question plain-English diagnostic (fundraising/VC plans, ESOPs, year-1 compliance budget, foreign founders, product vs service business) and outputs a clear side-by-side matrix comparing **Private Limited vs LLP vs OPC** (setup cost, annual audit/RoC cost, investor readiness, tax, closure friction) with one decisive recommendation. Incorporation then runs end-to-end via DSC, DIN, name approval, MoA/AoA or LLP Agreement, SPICe+ (INC-32) or FiLLiP, and linked PAN/TAN/GST/EPFO/ESIC.

## 2. Formation hiccups
Name rejected; form marked for resubmission; DSC/DIN/address-proof issues; foreign-director documents; portal and payment errors. The agent reads the RoC remarks and drafts a point-by-point reply.

## 3. Post-incorporation and annual compliance
Compliance calendar: INC-20A, ADT-1, board meetings, AGM, AOC-4, MGT-7/7A, DIR-3 KYC, DPT-3, MSME-1, registers, allotments/transfers, changes. Computed by [[rule-engines]].

## 4. Fixing past defaults
Exposure calculation; cheapest lawful fix — catch-up filing, condonation, compounding (s.441), adjudication (s.454), any active relief scheme; director disqualification (s.164(2)); restoration (s.252, NCLT); voluntary closure (STK-2). See [[companies-act-2013]].

## 5. Technicalities and transactions
Cap table, allotments, transfers, ESOPs, vesting, SHA/term-sheet basics, FEMA reporting, GST, DPIIT, Udyam, trademarks.

## 6. Corporate disputes
Oppression and mismanagement (ss.241–242), unpaid dues (legal notice, [[msmed-act-2006]] council, [[cheque-bounce]], [[ibc-2016]]) → [[dispute-mode]], [[nclt-and-ibc]].

All forms, deadlines and amounts are versioned data verified by a CS/CA reviewer before release.

