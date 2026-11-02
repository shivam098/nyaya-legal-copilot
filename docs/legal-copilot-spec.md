# Legal Co-Pilot for India — Product Spec (v0.6)

## 1. Vision
A senior practitioner in every Indian's pocket: an AI that thinks and advises like the best lawyer for the user's type of case, **joining the user at whichever stage they are in** (from a raw pre-filing grievance to a mid-case evidence stall, final arguments, or post-order execution) and guiding them to the final outcome — helping the user **win on the available facts, in the least possible time**.

It works in two modes:
- **Dispute mode** — litigation and complaints: win on the available facts, in the least time.
- **Advisory & compliance mode** — non-dispute legal work such as company formation and corporate compliance: get it done correctly, in the least time, with the lowest penalty and cost, and before small hiccups become disputes or prosecutions.

## 2. Problem
Ordinary people face legal problems constantly — consumer and money disputes, harassment and intimidation, domestic disputes, and false accusations under misused protective laws. Whatever side they are on, the same barriers stop them:

1. **Don't know where to start** — they know their story, not the law, forum, rights or deadlines.
2. **Can't afford or trust a lawyer** — especially against corporations or family.
3. **Lack practitioner judgement mid-case** — after filing, the case drags through replies, evidence, hearings and adjournments. What moves a case is practical, often unwritten courtroom know-how that only experienced lawyers have.
4. **Fear and pressure** — stigma, dependence, family pressure or threat of arrest push people to give up or settle badly.

Generic AI chats help with one-off drafting but forget the case, ignore its stage, and give textbook answers rather than what actually works in Indian courts.

The same gap exists outside court. Founders, small-business owners and directors hit company-law hiccups: a rejected name, an MCA form sent back for resubmission, a missed filing, late fees piling up, a disqualified director, a struck-off company, or a co-founder dispute. They don't know which form, deadline, professional or remedy applies. Professionals (CS, CA, lawyers) are costly for small firms, and generic answers miss the procedural details that decide whether a filing goes through.

## 3. Users
- Complainants: consumers, employees, tenants, investors, victims of harassment, cyber fraud, domestic violence.
- Respondents / accused: including people facing false or exaggerated complaints, and their families.
- Users who already have a lawyer and want to understand, brief and check them.
- Founders, small-business owners, directors and shareholders of private companies, LLPs and startups.
- (Later) A separate practitioner edition for advocates.

## 4. Core principle
**Win on the available facts, in the least time, by every lawful means.**
- Serve whichever side the user is on, without judging them.
- Be honest about case strength; never bluff.
- Hard lines (only refusals): fabricating/tampering evidence, coaching false testimony, threatening/bribing anyone, knowingly false complaints.
- Safety routing exists to protect the user (danger → emergency help), not to restrict them.
- **"Winning" means the best outcome for the client, not necessarily a court victory.** If a case isn't worth pursuing, or a settlement beats litigation, the agent says so plainly — like a good senior lawyer would — after hearing everything.
- In advisory mode the same principle applies as: **comply correctly, in the least time, at the lowest penalty and cost, by every lawful means.** No backdating documents, fake addresses, sham directors or false declarations to the Registrar.

## 5. Scope
All case types, built as one shared engine plus per-forum packs:
Civil (CPC), Criminal (BNSS/BNS/BSA), Consumer (CPA 2019), Family/DV, Property/RERA/rent, Debt/cheque bounce (NI Act, DRT, SARFAESI), Labour/service, Company/insolvency (NCLT/IBC), Constitutional (writs), Motor accident (MACT), Arbitration, Tax.

Plus non-dispute **advisory & compliance** work: company and LLP formation, post-incorporation and annual compliance, corporate technicalities and corporate remedies (see FR-15).

Rollout order (depth-first anti-cold-start rule): Consumer → Cheque bounce (NI 138) → RERA → MACT → simple civil suits → Company formation & compliance (advisory) → Family/DV → Labour → Criminal (victim and accused) → NCLT / writs.

**Depth-first gate (FR-18):** A forum pack only opens to users as "practitioner-grade" once it has a verified procedure pack, ≥15 practitioner-reviewed tactics in the Tactics Library (FR-9.2), bench/order pattern data, and a 20-case lawyer-graded evaluation benchmark. Until then, the forum runs in explicit "assisted research & drafting" beta so the product never degrades into generic chatbot advice.

## 6. Functional requirements

### FR-0 Day-zero evidence preservation & pre-litigation escalation ladder  ← NEW
The fastest win often happens **before a court filing**, and the strongest cases are won or lost in the **first 48 hours** based on whether perishable evidence was preserved.

**0.1 Day-zero evidence preservation (first 48 hours)**
Triggered immediately at intake when facts involve perishable digital, physical, or medical evidence (intimidation, public harassment, domestic violence, false accusation, cyber fraud, defective goods):
- **Perishable evidence checklist:** immediate alerts to preserve CCTV footage before 7–30 day auto-overwrite (drafting a formal preservation notice to the building/shop/police), call recordings, raw WhatsApp/email exports with headers, bank SMS/UPI reference numbers, location history, and contemporaneous witness notes.
- **Admissibility packaging:** guides the user to capture metadata and auto-generates a **Bharatiya Sakshya Adhiniyam (BSA) 2023 Section 63 certificate** (formerly IEA s.65B) for electronic records so opposing counsel cannot get chats, emails, or recordings thrown out at the evidence stage.
- **Medical & police documentation (when applicable):** when and how to get a Medico-Legal Case (MLC) examination, General Diary (GD) / Daily Diary entry, or preventive intimation on record.

**0.2 Pre-litigation fast-track escalation ladder**
Before spending months in court, the agent evaluates and executes faster statutory and regulatory levers (often resolving disputes in 7–45 days):
- **Financial & payments:** credit-card/UPI chargebacks, NPCI dispute mechanisms, and the **RBI Integrated Ombudsman** (for banks/NBFCs/payment apps).
- **Sectoral regulators & ombudsmen:** Insurance Ombudsman (Bima Bharosa), Telecom appellate/TCCMS, Aviation (AirSewa / DGCA), SEBI SCORES, RERA conciliation forums, Electricity Consumer Grievance Redressal Forums (CGRF).
- **Corporate escalation:** statutory Grievance Officer under IT Rules / Consumer Protection (E-Commerce) Rules, Nodal/Principal Nodal Officer escalation, National Consumer Helpline (NCH / INGRAM) docket, and targeted legal notice to directors/company secretary with a strict deadline.
- Every pre-litigation step is executed in a way that **builds the paper trail** (admissions, delivery proofs, regulatory dockets) for court if the opponent still refuses to settle.

### FR-1 Any-stage intake & mid-stream case onboarding  ← UPDATED
Users do **not** only arrive on Day 1. A user may join at **any stage** of a dispute or compliance matter, and the agent must onboard them directly into that exact procedural state:

**1.1 Supported entry points (examples)**
- **Pre-filing / weak-claim entry:** User wants to file a consumer complaint for a refund immediately, but hasn't built the legal ground or evidence yet → agent runs a **Pre-Filing Claim-Readiness & Viability Gate** (see FR-1.3 and FR-17), tells them what is missing, and either helps cure the deficiency gap first or advises against premature filing.
- **Mid-case stall (e.g., Founder's active case):** Complaint, Opposite Party (OP) Written Version, Rejoinder, and Complainant's Evidence Affidavit are already filed; the case is at the **OP Evidence stage**, and OP has repeatedly failed to file its Evidence Affidavit → agent reconstructs the history from past filings/order sheets, drops straight into the `op-evidence` node of the state machine, and prepares the move to **close OP's right to lead evidence** and compress the next hearing date.
- **Late-stage / post-order entry:** User joins right before final arguments, after an adverse interim order, or after winning a final order that the respondent is ignoring.

**1.2 Zero-effort "Messy Evidence Dump" & conversational onboarding**
Users rarely have neatly labelled files or formal hearing summaries. They have raw WhatsApp chat exports, unlabeled screenshots, voice notes, invoices, bank SMSes, or PDFs with random filenames (`IMG_4021.jpg`, `WhatsApp_Chat.txt`):
- **Drop-anything ingestion:** User simply drags in unlabelled files/chats and talks or types their story casually. They never have to label, sort, or date documents manually.
- **Auto-classification & timeline synthesis:** The agent reads every file/chat, identifies who is who, extracts dates, promises, payments, deliverables, and admissions, links each message/screenshot to the legal timeline, and asks only 2–3 short conversational questions to fill genuine gaps.
- **State reconstruction (mid-case):** If court papers or partial order screenshots exist, locates the case on the forum's state machine, audits past proceedings for **missed procedural leverage** (e.g., an expired 45-day reply window, unrecorded adjournments, or an overdue OP evidence affidavit), and immediately outputs the **next-hearing game plan**.

**Web MVP voice input (implemented scope)**
- New-dispute stories, ongoing-case notes, company notes and follow-up questions support opt-in browser speech-to-text, alongside unchanged typing and file uploads. Choose **English, Hindi, or Hinglish (Hindi + English)**, consent to browser speech processing, then explicitly start/stop the microphone. English uses `en-IN`; Hindi and best-effort Hinglish use `hi-IN`, not a fictitious Hinglish speech-service locale.
- **Uncluttered voice controls:** The idle panel shows only the language and Start control, not explanatory paragraphs or a consent checkbox. The first Start action prompts for browser speech-processing consent once per page load; cancelling does not activate the microphone. Live status, transcript previews, errors and unconfirmed-word warnings appear only when relevant.
- Text appears live as the browser delivers recognition events, including interim words. Hindi speech is **transliterated into English/Roman letters, not translated**; English words and identifiers are preserved. Romanization runs synchronously on-device using the pinned Sanscript library plus modern-Hindi character and word-ending handling, without LLM/API calls. Phonetic spellings vary and mixed-language word recognition remains browser-dependent; users can correct the text.
- Recognized text is appended without replacing typed text. Interim words are previewed in English letters; any remaining unconfirmed words are retained on stop/error and explicitly marked for review. Users must stop and read/edit names, dates, amounts and facts before manually submitting through the existing analysis/session flow. Recognition never auto-submits, and only one input can listen at a time. If romanization fails, capture stops with an explicit error and retains original words for manual correction rather than dropping them.
- HTTPS (or localhost), microphone permission and a working browser speech service are required. API availability alone does not guarantee service or language support. Chrome and Safari variants may support it; unsupported/blocked browsers get actionable feedback and typing/keyboard-dictation alternatives. Network, permission, missing microphone, unsupported language, silence and timeout failures are surfaced. No automatic microphone restart; page hiding or case/navigation changes stop capture.
- This is **live dictation, not an audio recorder or voice-note upload/transcription service**. Nyaya does not capture/store audio files or send audio to its LLM provider. The browser may send audio to its own speech provider, whose processing, retention and residency Nyaya does not control; consent is required before starting and on-device-only processing is not promised. Only the reviewed text follows the existing case storage and selected-model processing when submitted. No new paid speech service or server credential is required.
- Automated coverage uses mocked speech events and real deterministic Romanization (not real microphone recognition). Release/device verification: on the HTTPS link, choose a door, agree and allow the mic, speak English, Hindi and Hinglish, verify live English-letter text, stop, edit and submit; check denial, silence, interruption, a second dictation, and switching cases. Repeat on the intended mobile browser. Uploaded audio, playback, guaranteed mixed-language recognition and a configured Indic transcription provider remain future work.

**1.3 Pre-filing claim-readiness & Respondent Refund-Defence Gate (both sides)**
- **When the user is the Complainant wanting a refund:** Under CPA 2019, merely "wanting a refund" or changing one's mind is not enough—the complainant must prove a statutory **"defect"** (s.2(10)), **"deficiency in service"** (s.2(11)), **"unfair trade practice"** (s.2(47)), or breach of express warranty/return policy. If missing, the agent stops the user from walking into a dismissal and helps cure the gap or settle.
- **When the user is a Business / Service Provider responding to a refund demand:** The user can supply raw WhatsApp chats, the agreed scope and delivery records. The agent extracts **client approvals, delivery timestamps, causes of delay, alleged service failures and contractual refund/cancellation terms**, distinguishes evidence from disputed claims, and can draft a proportionate reply or formal defence. Approval or a no-refund clause alone does not establish a complete defence; the agent must not promise dismissal or label the demand unjustified before assessing the facts.

**1.4 Context-first answers & low-headache escalation across every door and follow-up (Web MVP)**
- Start with a brief explanation of what the situation means and what decision or next step matters, in the user's language and level of familiarity. Immediate danger takes priority. Explain necessary legal terms at first use, including why they matter; expanding an acronym alone is not enough.
- **Lowest-headache step first:** Even when a store, service centre, insurer, bank, or platform says "no", do not make the user feel defeated or push them straight into a court case or formal legal notice when a fast, free escalation route exists. Direct them first to practical levers: written job sheet + brand Customer Relations + **National Consumer Helpline (NCH / INGRAM, 1915)** for consumer/warranty refusals; bank dispute + Nodal Officer + **RBI Integrated Ombudsman** (or **1930 / cybercrime.gov.in** for cyber fraud); **IRDAI Bima Bharosa / Insurance Ombudsman** for insurance claims; **AirSewa / TCCMS / CGRF** for flights/telecom/utilities; and **SAMADHAN / MSME Samadhaan** for unpaid dues. Never suggest an RTI request against a private company or service centre.
- Separate user-supplied facts, document evidence and unknowns. Recommendations must depend on actual facts, not assumed investment, hiring or litigation goals. If facts are insufficient, give useful conditional guidance and ask only one to three questions that change the next step. Do not treat either side's allegations or a form selection as proof.
- Usually give one to three immediate actions and distinguish later obligations. Do not front-load every form, fee, registration, tax scheme or risk; do not hide urgent deadlines. Keep material legal qualifications, evidence needs and fallback options. Preserve requested drafts, scripts, checklists and expert detail rather than forcing every answer into a short summary or a long fixed template.
- Simple orientation answers aim for roughly 150-250 words without repeated action lists or unsolicited full notices; this is not a cap on requested artifacts, full hearing plans or safety-critical detail. Unsupported numerical legal thresholds, fees, compensation ranges, settlement-rate percentages or eligibility rules must not be supplied from memory and then qualified with "verify"; omit nonessential specifics or identify the exact unresolved check, while preserving user-supplied values and applicable deterministic results.
- Short follow-ups answer the current question without repeating intake. Full hearing plans retain their existing five Markdown sections, but the body must make clear when orders have not been supplied and a draft still contains placeholders or needs review; headings are not certification.
- State a relevant India/location/forum assumption when necessary. Use applicable deterministic outputs for legal date/fee math; otherwise identify what must be verified. Do not invent current-law checks, citations, eligibility or exact costs. A targeted professional-verification note is preferable to repeated generic disclaimers.
- The shared policy is implemented in `src/engine/response-guidance.mjs`, used by both JSON and streaming analysis endpoints and all saved-session follow-ups. Extraction has a factual, plain-language digest prompt that preserves source identifiers. Primary UI labels explain the task; technical diagnostics remain available but collapsed.
- Generation allows up to 3,200 output tokens, without requiring long answers. Provider completion reasons are retained: length-limited, filtered or unconfirmed output is visibly marked incomplete in the response and saved history, and is not response-cached. An incomplete document digest is not saved as a complete record. An interrupted browser stream is an error, not silent success; there is no automatic continuation or hidden extra model call.
- `evals/response-cases.json` covers solo-founder choice, filing corrections, both sides of refund disputes, hearings with missing orders, short follow-ups, requested expert drafts, Hinglish and immediate safety. Automated checks verify prompt wiring, endpoint/session contracts and completion handling; these are **not** a model-output quality or legal-accuracy score. Each case includes a rubric for reviewing real outputs.

### FR-2 Issue spotting and case assessment
Identify every legal angle (including ones the user didn't mention), forum, jurisdiction, limitation, remedies, and an honest strength assessment.

### FR-3 Case strategy
Case plan scored on: probability of winning, time to outcome, value recovered, cost/effort. Default = fastest high-probability route; user can re-weight.

### FR-4 Persistent case memory
Structured case graph (parties, claims, facts↔evidence, documents, orders, hearings, deadlines), event-sourced so every past recommendation is explainable.

### FR-5 Strategy loop (re-plan on every event)
On each new order, opposing filing, hearing or approaching deadline: ingest → update state → re-assess → generate options → red-team → recommend next move (reasons, citations, confidence, fallback) → user decides → act → track.

### FR-6 Opposition analysis
Read the other side's filings for contradictions, gaps, missed deadlines; predict their next moves; prepare counters.

### FR-7 Drafting, registry mechanics, and service of notice/summons  ← UPDATED
**7.1 Drafting and portal filing**
Notices, complaints, replies, rejoinders, affidavits, applications, written arguments; file via portals (e-Daakhil / e-Jagriti, e-Filing 3.0, MCA21, RERA) where possible with user approval on every submission.

**7.2 Surviving registry scrutiny & curing defects ("ground logistics")**
Many self-represented cases stall before the first hearing because of registry objections. The agent provides step-by-step ground logistics:
- **Filing packet checklist:** forum-specific pagination, index format, synopsis/list of dates, memo of parties, verification clauses, number of physical sets required alongside online filing, court-fee payment (e-Gras / Bharatkosh / postal order), and e-stamping / notarization / oath commissioner requirements for affidavits.
- **Registry defect curing:** reads the registry's scrutiny defect sheet (via OCR or portal status), explains each objection in plain language, prepares the cured document or compliance statement, and tracks the statutory window to re-file so the case is not dismissed for non-prosecution.
- **Courtroom day-of logistics:** how to check the daily cause list, find the court room / item number / VC link, how "pass-over" vs "adjournment" works on the first call, and how to get your presence (appearance) recorded in the daily order sheet.

**7.3 Summons & notice service tracker (beating evasion)**
A major cause of 6–12 month delays in Indian courts is the opposite party evading service of notice/summons:
- Tracks service across RPAD / Speed Post (India Post tracking integration), courier, court bailiff, and email/WhatsApp where permitted by the forum.
- Tells the user when and how to file an **Affidavit of Service (Proof of Service)** with postal receipts and tracking reports.
- **Anti-evasion tactics:** when envelopes return as *"refused"*, *"door locked"*, *"left without address"*, or *"unclaimed"*, prepares the exact submission/application to treat *"refused/unclaimed"* as **deemed service**, or moves immediately for **dasti service** (hand-delivery through party), service via email/WhatsApp, or **substituted service** (Order V Rule 20 CPC) so the case does not waste 4 hearings on fresh notice.
- For corporate opponents, pulls the official registered office and signatory email directly from **MCA21 Master Data** so the opponent cannot claim wrong address.

### FR-8 Hearing coach
Before each date: one-page brief (what to say, 3 strongest points, likely questions from the bench, documents to carry, how to resist adjournment). After: capture what happened and update the plan.

### FR-9 Practical courtroom tactics (practitioner know-how)  ← NEW
The agent must suggest the **practical, often unwritten moves experienced practitioners use**, not just what the statute says, and tell the user exactly how to execute them.

**Origin example (founder's own consumer case):** hearings were being listed about a month apart. A practising lawyer explained that if a party gives a solid, logical reason why the next date should not be so far, the bench will often grant a nearer date. A self-represented litigant would never know to ask.

**9.1 Hearing-date compression (first tactic to ship)**
At every hearing, the agent checks whether a shorter next date can be sought and, if so, prepares the request:
- **Grounds it evaluates** (forum-specific, from the procedure pack):
  - Statutory disposal targets, e.g. CPA 2019 s.38(7) (endeavour to decide within 3 months of notice, 5 months if testing needed); NI Act s.143(3) (endeavour to conclude trial within 6 months); DV Act s.12(5) (endeavour to dispose within 60 days of first hearing).
  - Adjournment limits and costs, e.g. CPC Order XVII Rule 1 (not more than three adjournments to a party).
  - Case age versus the statutory target.
  - Little work remaining (e.g. only arguments left, one short witness).
  - Hardship: senior citizen, medical, continuing financial loss, travel distance.
  - User's readiness (e.g. offer to file written arguments in advance).
- **Output to user:**
  - A short, respectful script to say in court in the user's language, e.g.: *"Sir/Ma'am, notice was served on <date>; the Act contemplates disposal within 3 months and we are already at <N> months. Only arguments remain. I humbly request a date within 7–10 days; I will file written arguments in advance."*
  - A specific date window to ask for, and willingness to accept a short or end-of-board slot.
  - If refused: request that the request be recorded in the order sheet; next steps (early-hearing application; later, an application to the higher forum for a direction for expeditious disposal) with when each is worthwhile.
  - Etiquette guidance: never argue with the bench; ask once, clearly, with reasons.
- **Post-hearing:** user reports whether a nearer date was granted; outcome feeds the learning loop.

**9.2 Tactics library (extensible)**
Every tactic is stored as a structured record:

| Field | Description |
|---|---|
| Trigger | Case stage / event that makes the tactic relevant |
| Forums | Where it applies (and state/bench variations) |
| Move | What to do |
| Script | What to say or file, in plain language |
| Legal basis | Statute/rule/judgment, if any |
| Success signals | How to tell it worked |
| Risks | When it backfires; when not to use it |
| Source & review | Practitioner who contributed; reviewing lawyer; last verified date |
| Observed effectiveness | Success rate from user-reported outcomes |

Initial tactics to collect (examples): nearer-date request; objecting to repeated adjournments and seeking costs; closing the right to reply after the statutory deadline; serving copies on the other side in advance so "not received" can't be used to adjourn; checking the cause list the day before and staying until the matter is called; getting certified/order copies the same day; filing written arguments early; mentioning urgent matters; settlement timing at peak leverage.

**9.3 Sourcing practitioner know-how**
Structured interviews with experienced lawyers per forum; patterns mined from daily orders (adjournment rates, gap between dates, timelines per court/bench); user-reported outcomes; lawyer review before any tactic goes live.

### FR-10 Arguments and research
Arguments built from precedents that are good law and binding/persuasive in that forum; citation verification mandatory.

### FR-11 Settlement advisor
Realistic case value, leverage points, what to accept or refuse and when.

### FR-12 Safety and discreet mode
Danger detection → 112 / 181 / Protection Officer / One Stop Centre; quick-exit, disguised app, hidden evidence vault.

### FR-13 Human handoff & "Lawyer Co-Pilot / Audit Mode"  ← UPDATED
When the user wants a lawyer, needs free legal aid, or is in a forum where advocate representation is practically necessary, the product does not step aside—it switches into **Lawyer Co-Pilot & Audit Mode**:

**13.1 Smart handoff**
- Routes to NALSA/DLSA free legal aid or vetted partner advocates with a clean, structured **One-Page Counsel Brief** (chronology, legal theories, evidence index, orders to date, and proposed next move) that saves hours of paid consultation time.

**13.2 Lawyer accountability & audit ("checking your lawyer's work")**
In India, litigants frequently suffer because their lawyer seeks adjournments without telling them, misses filing windows, or gives vague updates (*"date badh gayi"*):
- **Order-sheet truth check:** after every hearing date, the agent automatically pulls the actual **eCourts / e-Jagriti daily order and next date** and compares it against what the user's lawyer told them. It flags if the lawyer was absent, sought an adjournment, failed to file a reply/evidence on time, or let an adverse order pass.
- **Draft & strategy review:** before the user signs a petition, reply, or vakalatnama prepared by their lawyer, the agent reviews it for missing claims, weak prayers, missing interest/compensation heads, or unaddressed opposing arguments.
- **3 sharp questions for your lawyer:** before every meeting or call with their advocate, the agent gives the user 3 specific, respectful practitioner-level questions to ask (e.g., *"Their 45-day reply window expired on <date>; are we moving an application to close their right to file Written Version today?"*) and tracks the fee/milestone schedule.

### FR-14 Enforcement, decree execution, and appeal  ← UPDATED
A favourable judgment on paper is worthless until the money is in the user's bank account or the order is complied with. Respondents routinely ignore final orders hoping the litigant will tire out.

**14.1 Post-order compliance & execution playbook**
- Tracks the compliance period granted in the final order (e.g., 30 or 45 days) and sends a formal **Compliance Demand Notice** the day it expires.
- **Consumer execution (CPA 2019 ss.71–72):** drafts and guides two parallel enforcement weapons:
  1. **Section 71 (Enforcement as Civil Decree / Recovery Certificate):** application for attachment of bank accounts/assets or issuance of a Recovery Certificate to the District Collector to recover the amount as **arrears of land revenue**.
  2. **Section 72 (Penalty for Non-Compliance):** application invoking criminal/penal consequences (imprisonment up to 3 years and/or fine) against the defaulting company's directors/officers—which triggers bailable/non-bailable warrants and typically forces immediate payment.
- **Civil, RERA & award execution:** Order XXI CPC execution petitions (attachment of movable/immovable property, garnishee orders against bank accounts, arrest/detention in civil prison where applicable), RERA recovery certificates, and NI Act s.143A / s.148 interim compensation & deposit enforcement.
- **Asset & identifier discovery:** helps the user identify the opponent's bank branch (from prior cheques/UPI/invoices), GSTIN, registered assets, and active directors (via MCA21) to put into the attachment schedule.

**14.2 Appeals & stays**
- If the user loses (or wins partially): calculates exact appeal limitation, evaluates grounds for appeal/revision, and drafts the memo of appeal.
- If the user wins and the opponent appeals: tracks caveat filings, statutory pre-deposit requirements (e.g. 50% pre-deposit under CPA 2019 s.41 to entertain an appeal), and opposes stay applications or seeks release of deposited funds.

### FR-15 Company law and corporate compliance (advisory mode)  ← NEW
The agent acts like an experienced company secretary and corporate lawyer for founders and small businesses. The user describes their situation or problem in plain words ("my company name got rejected", "I forgot annual filings for two years", "my co-founder left with the shares"), and the agent diagnoses it, tells them the exact fix and walks them through it.

**15.1 Conversational situation discovery & entity choice ("We want to start a company, what should we do?")**
Founders often do not know whether they need a **Private Limited Company, LLP, OPC, Partnership, or Sole Proprietorship**, or what the compliance/tax/equity trade-offs are:
- **Conversational founder interview:** Explain the choice as ownership, personal responsibility for debts/claims, investor flexibility and ongoing administration. Ask only the one to three missing questions that change the next step; do not assume outside investors, large clients, employees or foreign ownership merely because the business uses AI.
- **Conditional comparison and recommendation:** Compare realistic options, including operating in one's own name for a solo founder, a one-person company, or a private limited company when the ownership/investment plans justify it. Explain partner/owner requirements and limits of liability protection. Use a short comparison when useful, not a mandatory dense matrix. Eligibility, audits, recognition and tax benefits are distinct current-rule checks; do not promise benefits or categorically dismiss an option without verified grounds.
- **Incorporation detail when needed:** Once the structure and facts are clear, explain relevant name/registration steps, documents, filings and professional certification in order. Introduce official form names and abbreviations alongside their purpose. Do not present every incorporation and annual-compliance form as an immediate task for someone still choosing a structure. Exact statutory dates and fee calculations require supported deterministic rules, not model estimates.

**15.2 Formation hiccups (troubleshooting)**
- Name rejected: explain the likely reason from the RoC remarks and suggest compliant alternatives.
- Form marked for resubmission or rejected: read the RoC remarks, prepare a point-by-point response and corrected attachments, and track the resubmission deadline.
- DSC, DIN, address-proof or foreign-director document problems; MCA portal errors and payment failures.
- Know when to escalate to a professional (CS/CA/advocate), including filings that need professional certification.

**15.3 Post-incorporation and annual compliance**
- A compliance calendar generated from the company's facts: commencement of business (INC-20A), first auditor (ADT-1), board meetings, AGM, financial statements (AOC-4), annual return (MGT-7/7A), director KYC (DIR-3 KYC), DPT-3, MSME-1, statutory registers, share allotments and transfers, changes of directors, address or capital.
- Reminders before each due date; plain explanation of what each filing is and why it matters.

**15.4 Fixing past defaults (cost-minimising)**
- Diagnose missed filings and calculate exposure (additional fees, penalties, director disqualification risk).
- Recommend the cheapest lawful fix: catch-up filings, condonation of delay, compounding (s.441), adjudication (s.454), any active government amnesty or relief scheme.
- Remedies for serious defaults: removing director disqualification (s.164(2)), restoring a struck-off company (s.252 before NCLT), voluntary closure (STK-2) when that is the better option.

**15.5 Corporate technicalities and transactions**
- Share allotment, transfer and cap-table hygiene; ESOPs; founder vesting; shareholders' and investor agreements (term sheet basics); share-capital changes.
- Foreign investment basics (FEMA reporting) with escalation to a professional.
- Allied registrations: GST, Startup India (DPIIT), MSME/Udyam, trademark.

**15.6 Corporate disputes and remedies (switch to dispute mode)**
- Co-founder and shareholder disputes, oppression and mismanagement (ss.241–242, NCLT).
- Recovering unpaid dues: legal notice, MSME Facilitation Council (MSMED Act), cheque bounce, insolvency petition under the IBC where thresholds are met.
- These hand over to the dispute-mode strategy loop and the NCLT/IBC procedure packs.

**15.7 Practical tactics for corporate work**
Stored in the same tactics library (FR-9.2), e.g. how to word a resubmission reply so the RoC accepts it first time; filing in the right order to avoid cascading rejections; filing catch-up returns before seeking condonation; timing compounding applications; keeping board minutes and registers ready before any due diligence.

All forms, deadlines, fees and penalty amounts live in the rule engines as versioned data, checked against the current Companies Act, rules and MCA circulars, and verified by a CS/CA reviewer before release.

### FR-16 Senior-practitioner competencies  ← NEW
**Origin:** asked what separates an expensive, established lawyer from an ordinary one, a practising lawyer said: the good lawyer *understands the client's problem*, *frames it and converts it into law* far better, *applies the law effortlessly*, and is *strong at research* — all from years of practice. The agent must deliberately model these skills rather than just answer questions.

| Competency | What the top lawyer does | What the agent must do |
|---|---|---|
| 16.1 Understand the problem | Listens past the surface story; finds what the client really wants (money, apology, stopping harassment, speed, reputation) and what they fear | Structured client-counselling interview: probe facts, motives, constraints, risk appetite, budget and timeline; restate the problem back and confirm before advising |
| 16.2 Frame facts into law | Turns a messy story into the strongest legal theory: right causes of action, right forum, right relief, right parties | Generate several competing **theories of the case**, test each against the facts and evidence, pick the strongest; map every element of each claim to a fact and a piece of evidence; flag missing elements |
| 16.3 Research | Finds the controlling and latest authority, distinguishes bad precedents, knows what this forum accepts | Citator-checked research; binding before persuasive; recent forum-specific orders; anticipate and distinguish the other side's authorities |
| 16.4 Apply effortlessly | Connects law to facts crisply in drafting and in court | Element-by-element application in every draft and hearing brief; short, plain arguments the user can actually say |
| 16.5 Procedural and forum mastery | Knows the stage, the bench's habits and the practical moves | Procedure packs, court patterns and the tactics library (FR-9) |
| 16.6 Judgement | Knows when to fight, when to settle and when to walk away | Case viability assessment (FR-17) |

Quality bar: before any major recommendation, the agent asks itself "what would the best practitioner in this forum do?" and the red-team critic checks the answer against these competencies. Evaluation sets are built from how experienced lawyers framed and resolved real cases.

### FR-17 Case viability and out-of-court resolution  ← NEW
After hearing everything, the agent gives an honest **go / no-go / settle** recommendation — before filing and again at key points in the case.

**17.1 Viability assessment** weighs:
- Strength on the facts and evidence (from FR-16.2), and gaps that can or can't be filled.
- Value realistically recoverable vs what is claimed; whether the other side can actually pay (enforceability).
- Time to outcome, cost, effort and emotional toll.
- Risks: counter-claims, cost orders, defamation exposure, damage to relationships, privacy.
- Limitation and other bars.

**17.2 Recommendations it may make**
- **Pursue** — with the fastest strong route.
- **Don't pursue** — explained plainly, with reasons, and what (if anything) would change that view (e.g. a missing document).
- **Settle / resolve out of court** — direct negotiation, legal notice as a negotiation lever, mediation (Mediation Act 2023; consumer mediation under CPA 2019; pre-institution mediation for commercial disputes under Commercial Courts Act s.12A), Lok Adalat, conciliation, arbitration where a clause exists, or regulator/ombudsman routes.
- **Hybrid** — file to create leverage, then settle at peak leverage.

**17.3 Settlement support**
- Realistic settlement range and walk-away point (BATNA); opening offer; concession plan.
- Negotiation scripts and drafts (offer letters, settlement agreements, mediation briefs), ensuring the settlement is recorded and enforceable.

The user always decides. The recommendation is honest even when it isn't what the user wants to hear.

### FR-18 Cold-start & depth-first forum readiness  ← NEW
Because practitioner tactics (FR-9) and local registry mechanics (FR-7.2) cannot be scraped from textbooks, spreading thin across 12 forums at launch would degrade the agent into a generic chatbot.
- **Forum readiness tiers:**
  - **Tier 1 — Full Practitioner Co-Pilot:** complete state-machine procedure pack + ≥15 lawyer-verified tactics + local registry/service playbooks + citator + ≥85% score on a 20-case practitioner eval set. (First target: **District & State Consumer Commissions**, piloted on the founder's active case).
  - **Tier 2 — Guided Procedure & Drafting:** verified limitation/deadlines, drafting templates, and research, with explicit disclosure where local bench tactics are still being collected.
  - **Tier 3 — Intake, Triage & Pre-Litigation / Lawyer Handoff:** issue spotting, day-zero evidence preservation (FR-0), pre-litigation escalation, and Lawyer Co-Pilot & Audit Mode (FR-13).
- **Practitioner data flywheel:** every user-reported hearing outcome, uploaded daily order sheet, registry defect list, and partner-lawyer review is anonymized and converted into candidate tactics and court-pattern statistics.

### FR-19 Minimal, intuitive 3-Door UX & Case Workspace  ← NEW
The user interface must never feel like a blank chatbot or a 40-field legal form:
- **Progressive web entry & interactive guide (MVP):** The landing page presents one **Get started** CTA and a quick **See sample inputs & outputs** pill; the three door choices are revealed after clicking Get started. The header includes **My cases**, **Settings**, and a **☰ Menu** (Hamburger Menu) opening a visual, low-text **How Nyaya works & Demos** drawer with interactive sample input + sample output previews and 1-click loading for all three doors, plus multi-model deep review (`Claude Opus 5.5`, `Gemini 4 Argon`, `Claude Sonnet 5.5`, `Claude Opus 4.6`, `GPT-4.1`).
- **Mobile-first controls:** Compact header, stacked role/company choices, full-width primary actions on small screens, at least 44px-high touch controls, 16px form text to avoid input zoom, wrapping attachments, and horizontally scrollable output tables. Optional folder-import controls are collapsed by default; typing, uploads, voice consent/transcription, case history and model selection remain available. The door picker receives keyboard focus after opening.
- **3-Door Entry Router:**
  - **Door A — "Something happened / New dispute or threat"** (Complainant or Respondent: talk or drop messy WhatsApp chats/screenshots → auto-organizes evidence, runs the Viability / Refund-Defence Gate, and gives the fastest move).
  - **Door B — "My case is already going on"** (Mid-case entry at any stage: drop whatever complaint/order/reply you have or just state your current stage → locates the exact procedural node, checks statutory clocks, and builds the **Next-Hearing Battle Card**).
  - **Door C — "Start or run a company / Startup advisory"** (Conversational advisor for *"Two of us want to start a company—LLP or Pvt Ltd?"* as well as RoC hiccups, resubmissions, and missed annual filings).
- **3-Pane Case Workspace:** (1) **Stage & Statutory Clock Bar** at the top/left, (2) **Actionable Next-Move / Battle Card** in the centre (exact spoken script, ready-to-file drafts, fallback if refused), and (3) **Auto-Organized Evidence Vault + Conversational Co-Pilot** on the right.

## 7. Architecture

```
1. Channels: WhatsApp · App/Web · Voice (Indic) · Discreet mode
2. User-safety gate: danger → emergency route; hard lines only (no fraud)
3. Case Brain (orchestrator + strategy loop)
   Agents: Fact-finder & Day-zero evidence preserver · Issue spotter · Case evaluator ·
           Pre-litigation escalator · Strategist · Opposition analyst ·
           Procedure & Registry clerk (defects + summons service) · Researcher · Drafter ·
           Hearing coach · Courtroom tactician · Settlement & ADR advisor ·
           Execution & recovery agent · Lawyer auditor (co-pilot mode) ·
           Corporate counsel / company secretary (advisory mode)
4. Case/entity   | 5. Knowledge layer          | 6. Rule engines
   memory        |    statutes (versioned,     |    limitation, jurisdiction,
   facts, parties|    IPC→BNS mapping), case   |    court fees, deadline
   evidence,     |    law + citator, procedure |    calendar (with court
   orders,       |    packs, practitioner      |    holidays), statutory
   timeline;     |    playbooks, TACTICS       |    disposal targets,
   company       |    LIBRARY, court patterns, |    COMPLIANCE CALENDAR,
   profile &     |    Companies Act/LLP Act +  |    late-fee & penalty
   filing history|    rules, MCA circulars,    |    calculator
                 |    FEMA, form guides        |
7. Verification: citation check · procedure check · red-team critic · confidence/abstain
8. Tools: eCourts (CNR) · e-Daakhil/e-Jagriti · NCH · cybercrime portal · RTI · CPGRAMS ·
          MCA21 (company master data, form/SRN status) · GST · Startup India · IP India ·
          OCR for orders (incl. handwritten/Hindi) · reminders · DigiLocker
9. Human layer + learning loop: lawyer review · outcome tracking → playbook/tactic updates
```

- **Courtroom tactician** agent: on every upcoming hearing and every new order, queries the tactics library for applicable moves (incl. date compression), computes grounds from the rule engines (e.g. case age vs statutory target, adjournment count), and hands scripts to the Hearing coach.
- **Pre-litigation escalator & Day-zero evidence** agent: triggers within the first 48 hours to lock down perishable evidence (CCTV, BSA s.63 certificates) and fires fast regulatory/ombudsman/chargeback levers before court filing (FR-0).
- **Procedure & Registry clerk** agent: handles registry scrutiny defects, filing checklists, and summons/notice tracking (India Post + MCA21 address lookup + deemed/dasti/substituted service applications) so cases don't stall on ground logistics (FR-7.2, FR-7.3).
- **Execution & recovery** agent: takes over after a favourable order to turn paper decrees into actual money via CPA ss.71–72 warrants/recovery certificates, Order XXI attachment, and statutory pre-deposit enforcement (FR-14).
- **Lawyer auditor** agent: powers Lawyer Co-Pilot Mode—compares eCourts daily order sheets against what the user's lawyer reported, audits drafts before signing, and generates 3 sharp questions before every lawyer call (FR-13.2).
- **Case evaluator** agent: runs the go / no-go / settle assessment (FR-17) at intake and at key stages.
- **Settlement & ADR advisor** agent: settlement range, walk-away point, negotiation and mediation support (FR-17.3).
- **Corporate counsel / company secretary** agent: runs advisory mode. It keeps the company profile and filing history, generates the compliance calendar, diagnoses formation and filing hiccups, drafts corporate documents and resubmission replies, and hands disputes to the Strategist.
- **Rule engines** are deterministic code; the LLM never computes deadlines, limitation, fees, late fees or penalties.
- **Models:** frontier reasoning model for Strategist/critic/tactician; smaller models for extraction; Bhashini/Sarvam for Indic speech.
- **Stack:** Python/FastAPI, LangGraph, Postgres + pgvector, object store, Temporal (deadlines/long-running workflows), Playwright (portals).

## 8. Privacy and compliance
DPDP Act 2023 consent and deletion; India data residency; per-case encrypted vault; PII redaction before LLM calls; positioned as legal information and empowerment (Advocates Act / BCI rules), with partner advocates for representation.

## 9. Success metrics
- % of grievances resolved at the pre-litigation stage (ombudsman/chargeback/notice) without court filing, and median days to resolution.
- % of cases passing registry scrutiny on first filing without defect objections; median days from filing to successful service of notice.
- Time from filing to disposal vs forum baseline.
- Average gap between hearings vs forum baseline; % of nearer-date requests granted.
- Win / favourable-settlement rate; value recovered vs claimed.
- **Decree realization rate:** % of favourable orders where money/relief is actually recovered, and median days from final order to realization.
- % of users who reach the next stage without abandoning.
- Lawyer Co-Pilot Mode: % of silent adjournments or missed deadlines caught via eCourts order-sheet audit.
- Recommendation accuracy vs lawyer review.
- Framing quality: agent's chosen theory of the case vs experienced-lawyer framing on an evaluation set.
- Viability calibration: share of "don't pursue" / "settle" advice that lawyers agree with; outcomes of settled vs litigated matters.
- Advisory mode: incorporation approved on first submission (%); filings made on time (%); penalties and late fees avoided or reduced.

## 10. Open questions
- Which practitioners to partner with for the first playbooks and tactics library?
- Pricing: free core + paid lawyer review? B2B2C via legal aid / NGOs?
- Liability model and disclaimers per forum.
- Pilot: founder's own consumer case as the first end-to-end test.
- Advisory mode: which filings can the product prepare directly, and which need a practising CS/CA/advocate to certify or file? Partner network for those.
