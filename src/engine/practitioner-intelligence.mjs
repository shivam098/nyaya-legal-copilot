/**
 * Practitioner Intelligence Engine (Improvements #1–#5 from Lawyer Consultation)
 *
 * Implements how an experienced Indian trial/chamber advocate structurally thinks:
 * 1. Conversational "WhatsApp-Style" Fact-Probing & BNSS First Schedule / s.173(3) Cognizability Check
 * 2. Layman-to-Legal Statutory Ingredient Translator (Theft vs Misappropriation/CBT, Assault vs Hurt, Art. 12 State)
 * 3. Downstream Risk Foresight, Burden-of-Proof Framing & Plaint "Prayer Clause" Auditor
 * 4. Instant <1s Empathetic First-Response Triage (before deep LLM research completes)
 * 5. Structured "How a Local Lawyer Thinks" End-to-End Case-Trajectory Repository
 */

import {
  searchStatutoryProvisionsSemantic,
  searchPractitionerLessonsSemantic
} from './semantic-statutory-index.mjs';
import {
  detectIndianState,
  evaluateMaintainabilityAndOusters,
  evaluatePaperTrailAndSelfGoals,
  evaluateForumElectionAndEconomics,
  evaluateFlankRisks,
  buildCrossExaminationInstruction
} from './maintainability-auditor.mjs';

/**
 * 1. LAYMAN-TO-LEGAL INGREDIENT TRANSLATOR (#2)
 * Translates everyday words ("chori", "fraud", "assault", "dowry harassment", "fundamental right")
 * into exact statutory ingredients under BNS/BNSS 2023 & Civil Law.
 */
export const LAYMAN_TO_LEGAL_INGREDIENT_RULES = [
  {
    id: 'chori-vs-entrustment-cbt',
    triggerRegex: /\b(chori|चोरी|stole|stolen|theft)\b/i,
    entrustmentRegex: /\b(gave\s+him|gave\s+her|handed\s+over|for\s+safekeeping|lent|borrowed|kept\s+with|entrusted|rakhne\s+ke\s+liye|diya\s+tha|रखने\s+के\s+लिए|दिया\s+था|refusing\s+to\s+return|not\s+returning)\b/i,
    laymanTerm: 'Theft / Chori (चोरी)',
    actualLegalConcept: 'Criminal Misappropriation (Section 314 BNS / s.403 IPC) or Criminal Breach of Trust (Section 316 BNS / s.406 IPC)',
    explanation:
      'In everyday speech people call any unreturned item "Theft (चोरी)". In law, Theft (Section 303 BNS / s.378 IPC) ONLY applies when someone takes property out of your possession WITHOUT your consent. If you voluntarily handed over or entrusted the property/money/jewellery/vehicle to someone and they dishonestly kept or misused it, it is NOT Theft—it is Criminal Misappropriation (Section 314 BNS) or Criminal Breach of Trust (Section 316(2) BNS). Quoting the wrong section at the police station is a top reason police turn complainants away.'
  },
  {
    id: 'theft-below-5000-non-cognizable',
    triggerRegex: /\b(chori|चोरी|stole|stolen|theft|pickpocket|shoplift)\b/i,
    laymanTerm: 'Petty Theft (< ₹5,000 Value)',
    actualLegalConcept: 'BNS Section 303(2) Proviso & BNSS First Schedule — Non-Cognizable if property value is less than ₹5,000 (first conviction)',
    explanation:
      'Under the Bharatiya Nyaya Sanhita (BNS), 2023 Section 303(2) Proviso read with the BNSS First Schedule, where the value of stolen property is LESS than ₹5,000 (first offence), the offence has been made NON-COGNIZABLE and bailable (punishable with community service upon return/restoration of property). For non-cognizable offences, police record an NCR (Non-Cognizable Report) under Section 174 BNSS and cannot register a regular FIR without a Magistrate\'s order unless snatching (Section 304 BNS), house-trespass/burglary (Section 305 BNS), or force/robbery (Section 309 BNS) was involved.'
  },
  {
    id: 'assault-vs-criminal-force-hurt',
    triggerRegex: /\b(assault|assaulted|gesture|raised\s+hand|tried\s+to\s+hit|marne\s+ka\s+ishara|मारने\s+का|हाथ\s+उठाया|slapped|beaten|mara|पीट\s+दिया)\b/i,
    laymanTerm: 'Assault / Maar-Peet',
    actualLegalConcept: 'Assault (Section 130 BNS / s.351 IPC) vs. Criminal Force (Section 129 BNS) vs. Voluntarily Causing Hurt (Section 115(2) BNS / s.323 IPC)',
    explanation:
      'In common parlance "assault" means physical beating. Under Indian criminal law, a threatening gesture or preparation that makes you apprehend immediate force WITHOUT physical contact is "Assault" (Section 130 BNS / s.351 IPC); actual unwanted contact is "Criminal Force" (Section 129 BNS); and causing bodily pain/injury is "Hurt" (Section 115(2) BNS — non-cognizable for simple hurt unless coupled with grievous hurt s.117, wrongful restraint s.126(2), weapon s.118, or house trespass).'
  },
  {
    id: 'dowry-label-vs-marital-discord',
    triggerRegex: /\b(dowry\s+harassment|dahej\s+utpidan|दहेज\s+उत्पीड़न|498\s*-?\s*a|husband\s+not\s+calling|pati\s+bula\s+nahi\s+rahe|argument\s+with\s+husband|nok\s*-?\s*jhok|नोकझोंक)\b/i,
    laymanTerm: 'Dowry Harassment / Matrimonial Dispute',
    actualLegalConcept: 'Section 85 BNS (498A IPC) Cruelty vs. Section 12 PWDVA Civil Residence/Maintenance vs. Section 9 HMA Restitution / Mediation',
    explanation:
      'Not every marital quarrel or separation is a criminal Section 85 BNS (498A IPC) FIR case. Section 85/86 BNS requires grave conduct likely to drive the woman to suicide/grave injury OR harassment to coerce unlawful property/dowry demand. If the dispute is an ordinary marital tiff where a spouse left after an argument and wants cohabitation restored, filing an FIR destroys reconciliation—the legal remedy is Family Counselling / Mediation or Restitution of Conjugal Rights (Section 9 HMA), or a civil Magistrate application under Section 12 PWDVA if shelter/maintenance/streedhan is withheld.'
  },
  {
    id: 'cheating-vs-civil-breach',
    triggerRegex: /\b(fraud|cheated|cheating|dhokha|धोखाधड़ी|420|did\s+not\s+pay\s+back|payment\s+stuck|refused\s+to\s+refund)\b/i,
    laymanTerm: 'Fraud / Cheating (420)',
    actualLegalConcept: 'Cheating (Section 318(4) BNS / s.420 IPC) vs. Civil Breach of Contract (Section 73 Contract Act / Consumer / MSME)',
    explanation:
      'Police frequently refuse FIRs when someone says "I was cheated" in a business or purchase deal because mere failure to keep a promise is a Civil Breach of Contract, NOT criminal Cheating. To make out criminal Cheating under Section 318 BNS (old s.420 IPC), you must show fraudulent or dishonest intention AT THE VERY INCEPTION (from Day 1 when the money was taken, e.g., fake title, forged document, non-existent goods, or immediate diversion of funds).'
  },
  {
    id: 'article-12-state-vs-private',
    triggerRegex: /\b(fundamental\s+right|article\s+12|article\s+14|article\s+19|article\s+21|article\s+32|article\s+226|writ\s+petition|bcci|mौलिक\s+अधिकार)\b/i,
    laymanTerm: 'Fundamental Rights / Writ Petition Against Any Organization',
    actualLegalConcept: 'Article 12 "State" Instrumentality Test (Article 32 SC vs. Article 226 HC Public Function Writ)',
    explanation:
      'Most Fundamental Rights (like Articles 14, 19, 21) are enforceable against the "State" under Article 12 of the Constitution (Government, statutory authorities, or bodies financially, functionally, and administratively dominated by the Government per Ajay Hasia / Pradeep Kumar Biswas). For bodies like BCCI or private institutions discharging a public duty/monopoly, the Supreme Court held in Zee Telefilms v. Union of India that while not "State" for an Article 32 writ before the Supreme Court, they are amenable to High Court Writ Jurisdiction under Article 226 for public-function violations.'
  }
];

export function translateLaymanToLegalIngredients(rawInput = '', paidAmountInr = null) {
  const text = String(rawInput || '');
  const translations = [];

  for (const rule of LAYMAN_TO_LEGAL_INGREDIENT_RULES) {
    if (!rule.triggerRegex.test(text)) continue;
    if (rule.id === 'chori-vs-entrustment-cbt') {
      translations.push({
        id: rule.id,
        laymanTerm: rule.laymanTerm,
        actualLegalConcept: rule.entrustmentRegex.test(text)
          ? 'Criminal Breach of Trust / Misappropriation (Section 316 / 314 BNS) — NOT Theft'
          : rule.actualLegalConcept,
        explanation: rule.explanation,
        confirmedByFacts: rule.entrustmentRegex.test(text)
      });
    } else if (rule.id === 'theft-below-5000-non-cognizable') {
      if (paidAmountInr !== null && paidAmountInr >= 5000 && !/\b(5000|5,000|five\s+thousand|पांच\s+हजार)\b/i.test(text)) {
        continue;
      }
      translations.push({
        id: rule.id,
        laymanTerm: rule.laymanTerm,
        actualLegalConcept: rule.actualLegalConcept,
        explanation: rule.explanation,
        confirmedByFacts: Boolean(paidAmountInr !== null && paidAmountInr < 5000)
      });
    } else {
      translations.push({
        id: rule.id,
        laymanTerm: rule.laymanTerm,
        actualLegalConcept: rule.actualLegalConcept,
        explanation: rule.explanation,
        confirmedByFacts: true
      });
    }
  }

  return translations;
}

/**
 * 2. CONVERSATIONAL FACT-PROBING & BNSS FIRST SCHEDULE / s.173(3) COGNIZABILITY ENGINE (#1)
 * Determines what a real advocate would ask first before prescribing bookish procedure,
 * and checks BNSS First Schedule cognizability + BNSS s.173(3) preliminary inquiry rules.
 */
export function evaluateConversationalFactProbing({
  rawInput = '',
  domainInfo = {},
  paidAmountInr = null,
  caseState = {}
} = {}) {
  const text = String(rawInput || '');
  const lower = text.toLowerCase();
  const clarifyingQuestions = [];
  let firCognizabilityAnalysis = null;

  const mentionsFirRefusalOrPolice = /\b(fir\b|police\s+refus|not\s+registering\s+fir|thana|थाना|पुलिस|एफआईआर| दर्ज\s+नहीं|173\s+bnss|154\s+crpc|156\(3\)|175\(3\))\b/i.test(text);
  const mentionsTheft = /\b(chori|चोरी|theft|stole|stolen)\b/i.test(text);
  const mentionsSnatchingOrRobbery = /\b(snatch|snatched|robbery|loot|gunpoint|knife|house\s+break|burglary|ताला\s+तोड़)\b/i.test(text);
  const mentionsMatrimonial = domainInfo.domain === 'matrimonial-family' || /\b(dowry|dahej|दहेज|498\s*-?\s*a|husband|wife|in-laws|caw\s+cell|mahila\s+thana|पति|पत्नी)\b/i.test(text);

  if (mentionsFirRefusalOrPolice || domainInfo.domain === 'criminal-bns-bnss') {
    // Determine BNSS First Schedule status & BNSS s.173(3) preliminary inquiry applicability
    if (mentionsTheft && !mentionsSnatchingOrRobbery && paidAmountInr !== null && paidAmountInr < 5000) {
      firCognizabilityAnalysis = {
        scheduleStatus: 'NON-COGNIZABLE under BNSS First Schedule (BNS s.303(2) Proviso — Theft below ₹5,000)',
        preliminaryInquiryApplies: false,
        whyPoliceRefused: `Because the stolen amount/value (₹${paidAmountInr.toLocaleString('en-IN')}) is below ₹5,000 and no force/snatching or house-breaking was used, BNS Section 303(2) Proviso classifies this first offence as Non-Cognizable. Police cannot register a regular FIR under Section 173(1) BNSS without a Magistrate's order.`,
        whatToTellPoliceOrDo:
          'Ask the Duty Officer to record a Non-Cognizable Report (NCR) in the station diary under Section 174(1) BNSS and give you a free copy, OR if snatching (Section 304 BNS) / house-trespass (Section 305 BNS) occurred, state those exact facts in writing so it becomes Cognizable.'
      };
    } else if (mentionsMatrimonial || /\b(commercial|business\s+dispute|breach\s+of\s+trust|cheating|420|318\s+bns)\b/i.test(text)) {
      firCognizabilityAnalysis = {
        scheduleStatus: 'COGNIZABLE (Subject to BNSS Section 173(3) & Lalita Kumari Preliminary Inquiry Rules)',
        preliminaryInquiryApplies: true,
        whyPoliceRefused:
          'Under the Supreme Court Constitution Bench ruling in Lalita Kumari v. Govt. of UP ((2014) 2 SCC 1) AND newly codified Section 173(3) of the BNSS, 2023, for offences punishable with 3 to 7 years (and matrimonial/family or commercial disputes), the SHO—with prior permission from an officer not below the rank of DSP/ACP—may conduct a Preliminary Inquiry within 14 days to check if a prima facie cognizable offence exists before registering the FIR.',
        whatToTellPoliceOrDo:
          'Do not just accept an oral refusal. Hand over a written complaint stamped with a Receiving/DD Entry number and ask: (1) If the facts disclose a clear cognizable offence, register the FIR under Section 173(1) BNSS; or (2) If conducting a Section 173(3) BNSS Preliminary Inquiry with DSP permission, record the entry and complete it within the statutory 14-day cap.'
      };
    } else {
      firCognizabilityAnalysis = {
        scheduleStatus: 'Check BNSS First Schedule Ingredients (Cognizable vs. Non-Cognizable)',
        preliminaryInquiryApplies: false,
        whyPoliceRefused:
          'Police often turn complainants away when the oral complaint sounds like a civil money recovery, a minor non-cognizable scuffle (Section 115(2) BNS simple hurt), or petty theft (< ₹5,000 under BNS s.303(2)).',
        whatToTellPoliceOrDo:
          'Before escalating to the SP (Section 173(4) BNSS) or Magistrate (Section 175(3) BNSS), ensure your written complaint clearly sets out the statutory ingredients of a Cognizable offence (e.g., snatching s.304 BNS, cheating from inception s.318(4) BNS, extortion s.308 BNS, or grievous hurt/wrongful restraint) and obtain a stamped receiving or e-FIR number.'
      };
    }

    // False Section 69 BNS / False Promise to Marry / Marital Context Defence Probing
    if (/\b(section\s+69|s\.?\s*69\b|bns\s*69|false\s+promise\s+to\s+marry|deceitful\s+means|marital\s+rape|376|breakup\s+case|false\s+rape)\b/i.test(text)) {
      clarifyingQuestions.push({
        id: 'probe-bns69-marital-or-relationship-status',
        slot: 'statutoryIngredientsAndValue',
        question: '1. Are the parties already legally married (or was it a consensual relationship/engagement that later broke off)?',
        whyLawyerAsks: 'CRITICAL DISTINCTION: If already legally married (wife >= 18 yrs), Section 69 BNS ("false promise to marry") cannot legally apply at all, and Exception 2 to Section 63 BNS excludes marital intercourse from s.63/64 BNS! If it was a consensual relationship breakup, Pramod Suryabhan Pawar ((2019) 9 SCC 608) holds that subsequent inability to marry is NOT an offence under s.69 BNS unless the promise was fake from Day 1.',
        quickReplies: [
          'We are already legally married — wife is threatening/filing a false case during marital dispute',
          'Long consensual relationship — marriage could not happen later due to family/mutual differences',
          'She is threatening to file a Section 69 BNS / rape FIR unless I pay money or marry immediately'
        ]
      });
      clarifyingQuestions.push({
        id: 'probe-bns69-fir-and-bail-status',
        slot: 'authorityAndForumStatus',
        question: '2. Has an FIR already been registered at the Thana, or is it currently at the threat / police-call stage?',
        whyLawyerAsks: 'Because Section 69 BNS carries up to 10 years (> 7 years), automatic Section 35(3) BNSS (Arnesh Kumar) notice protection does NOT apply—if an FIR is registered or imminent, moving for Section 482 BNSS Anticipatory Bail is the #1 priority.',
        quickReplies: [
          'Only threats / police station call so far — no FIR registered yet',
          'FIR is already registered under Section 69 / 64 BNS — I need immediate Anticipatory Bail (s.482 BNSS)',
          'I am the complainant/woman and he deceived me from Day 1 (e.g., hid his existing marriage)'
        ]
      });
      clarifyingQuestions.push({
        id: 'probe-bns69-digital-evidence',
        slot: 'paperTrailAndAdmissions',
        question: '3. Do you have WhatsApp chats, call recordings, family-introduction messages, or proof of any monetary/blackmail threat?',
        whyLawyerAsks: 'WhatsApp chats showing mutual consent, genuine marriage efforts/family talks, or extortion demands (certified under Section 63 BSA) are the exact evidence High Courts use to grant Anticipatory Bail (s.482 BNSS) and quash the FIR (s.528 BNSS).',
        quickReplies: [
          'Yes — I have WhatsApp chats showing mutual consent / family talks / monetary threats',
          'Some chats were deleted or on my old phone — need to know what to preserve today',
          'We have marriage certificate / Roka / ceremony photos'
        ]
      });
    }

    // Chain snatching / mobile snatching specific probing (s.304 Snatching [3 yrs] vs s.309(4)/(6) Robbery [10 yrs / Life] + Jimmanama)
    if (/(\bsnatch(?:ed|ing)?\b|\bchain\s+snatch(?:ed|ing)?\b|\bmobile\s+snatch(?:ed|ing)?\b|झपटमारी|चेन\s+स्नैचिंग)/i.test(text)) {
      clarifyingQuestions.push({
        id: 'probe-snatching-stage-and-hurt',
        slot: 'authorityAndForumStatus',
        question: '1. When & where did the snatching happen, and has the Thana registered an FIR yet (or asked you to give a "Sanha / गुमशुदगी lost report")?',
        whyLawyerAsks: 'Police sometimes downgrade snatching to a "lost item (Sanha)" to avoid an unsolved crime entry. Under Section 304 BNS, Snatching is strictly Cognizable regardless of value.',
        quickReplies: [
          'It just happened recently — I am going to the Thana now to file the FIR',
          'Thana took an application / asked for a Sanha (missing report) instead of FIR',
          'FIR is already registered — police have not recovered the chain / caught the accused yet'
        ]
      });
      clarifyingQuestions.push({
        id: 'probe-snatching-injury-304-vs-309',
        slot: 'statutoryIngredientsAndValue',
        question: '2. Did the snatcher cause ANY neck scratch/bruise, push/drag the victim, or show any weapon/threat?',
        whyLawyerAsks: 'CRITICAL: Section 304 BNS (Snatching) carries only 3 years (allowing easy Section 35(3) BNSS notice). If there was ANY scratch, push, fall, or threat of hurt, a Government Hospital MLC upgrades the charge to Robbery under Section 309(4) BNS (10 yrs) or Section 309(6) BNS (up to Life / 10 yrs RI)!',
        quickReplies: [
          'Yes — there was a neck scratch / bruise / push or threat (we can get/have medical report)',
          'No physical injury — the chain was yanked suddenly and they sped away on a bike',
          'Chain is recovered by police — I need to get it released from court (Jimmanama / Supurdari)'
        ]
      });
      clarifyingQuestions.push({
        id: 'probe-snatching-evidence-available',
        slot: 'paperTrailAndAdmissions',
        question: '3. What proof or details do you currently have available with you?',
        whyLawyerAsks: 'Helps lock CCTV before it overwrites (3–7 days) and prepares ownership proof for Section 497/503 BNSS Jimmanama release.',
        quickReplies: [
          'We spotted nearby CCTV cameras / bike details and have the jewellery bill or photos',
          'No bill available right now, only family photos wearing the chain and spot details',
          'I am actually asking on behalf of someone accused/arrested in a snatching case'
        ]
      });
    }

    // Probing questions a real lawyer asks when FIR refusal is mentioned without full facts
    if (!paidAmountInr && /\b(chori|theft|fraud|cheating|money|पैसा|चोरी|धोखाधड़ी)\b/i.test(text)) {
      clarifyingQuestions.push({
        id: 'probe-amount-and-handover',
        slot: 'statutoryIngredientsAndValue',
        question: 'What is the approximate rupee value/amount involved, and was the money/item taken without your knowledge or handed over by you on trust?',
        whyLawyerAsks: 'Under BNS s.303(2), theft below ₹5,000 is non-cognizable; and if you handed it over yourself, the offence is Criminal Breach of Trust (s.316 BNS) or Cheating (s.318 BNS), not Theft.',
        quickReplies: [
          'Amount is above ₹5,000 and it was taken without my consent',
          'I transferred/handed over the money on a false promise (Cheating from Day 1)',
          'Amount is under ₹5,000, or it was a business/loan repayment dispute'
        ]
      });
    }

    if (mentionsFirRefusalOrPolice && !/\b(written\s+complaint|dd\s+entry|receiving|sp\s+office|registered\s+post)\b/i.test(lower)) {
      clarifyingQuestions.push({
        id: 'probe-police-visit-details',
        slot: 'authorityAndForumStatus',
        question: 'What exact incident did you report at the police station, and did you give a written application (with receiving) or only speak orally?',
        whyLawyerAsks: 'A lawyer first checks whether your facts disclose a cognizable offence under the BNSS First Schedule and whether police invoked a 14-day Preliminary Inquiry under Section 173(3) BNSS.',
        quickReplies: [
          'Police refused orally without taking my written complaint',
          'I gave a written complaint at the Thana but got no FIR number',
          'Police said it is a civil / family matter and asked us to settle'
        ]
      });
    }
  }

  // Matrimonial Probing: Distinguish genuine cruelty/DV/streedhan deprivation vs minor marital argument ("Restitution vs FIR" from cr3 14:22-15:10)
  if (mentionsMatrimonial && caseState.role !== 'defender') {
    const hasSpecificCrueltyOrLockout = /\b(locked\s+me\s+out|beaten|hit\s+me|threw\s+me\s+out|kept\s+my\s+jewellery|streedhan|stridhan|demanded\s+rs|demanded\s+car|demanded\s+cash)\b/i.test(lower);
    if (!hasSpecificCrueltyOrLockout) {
      clarifyingQuestions.push({
        id: 'probe-matrimonial-goal',
        slot: 'statutoryIngredientsAndValue',
        question: 'To guide you like a personal advocate: was there physical violence, lockout from the house, or retention of your streedhan/jewellery, OR was it a marital disagreement where you want to reconcile and resume living together?',
        whyLawyerAsks: 'If you want reconciliation after a minor disagreement, rushing into a criminal FIR (Section 85 BNS / 498A) can permanently break the marriage—Family Counselling or Section 9 HMA (Restitution) is better. If you face violence, lockout, or streedhan retention, Section 12 PWDVA before the Magistrate gives immediate protection, residence, and maintenance.',
        quickReplies: [
          'It was a disagreement / he is not calling me back — I want peaceful resolution or counselling',
          'I was pushed out / locked out and need shelter, maintenance & my streedhan back (PWDVA s.12)',
          'There is severe dowry demand / physical cruelty and I want strict criminal action (BNS s.85)'
        ]
      });
    }
  }

    if (
      clarifyingQuestions.length === 0 &&
      (domainInfo.domain === 'property-rera' || /\b(loan|emi|bank|hdfc|sbi|icici|subvention|tripartite)\b/i.test(lower))
    ) {
      clarifyingQuestions.push({
        id: 'probe-property-bank-loan',
        slot: 'statutoryIngredientsAndValue',
        question: 'Is there an active Bank Home Loan / EMI or Tripartite Subvention Agreement on this property, and do you want to stay in the project (possession + delay interest) or exit with a full refund?',
        whyLawyerAsks: 'In builder/land disputes where a bank loan is running, the bank will still pursue EMI recovery (SARFAESI / ECS bounce) unless your petition specifically prays for relief covering the lender/tripartite liability.',
        quickReplies: [
          'Yes, I have an active bank home loan / EMI running on this property',
          'No bank loan — I paid from my own savings and want possession + delay interest',
          'I want a 100% refund with interest because the project/title is stuck'
        ]
      });
    }

    // Ensure EVERY case has domain-appropriate fact & document confirmation questions if fewer than 2 were generated
    if (clarifyingQuestions.length === 0) {
      if (domainInfo.domain === 'cheque-bounce-138') {
        clarifyingQuestions.push({
          id: 'probe-138-dates-and-docs',
          slot: 'incidentTimelineAndState',
          question: 'To confirm your exact statutory clock: (1) What is the exact date on the Bank Return Memo, (2) Have you sent the 30-day demand notice yet, and (3) What documents do you have (original cheque, return memo, invoice/chat)?',
          whyLawyerAsks: 'Section 138 NI Act has an unforgiving 30-day notice window from the Return Memo and jurisdiction lies at the PAYEE\'S bank branch (Section 142(2)(a)).',
          quickReplies: [
            'Cheque bounced within the last 30 days — I have the original cheque & bank return memo',
            'More than 30 days passed since return memo, but the cheque is still within 3-month validity',
            'I already sent the 15-day notice and the drawer still has not paid'
          ]
        });
      } else if (domainInfo.domain === 'inheritance-partition') {
        clarifyingQuestions.push({
          id: 'probe-partition-facts',
          slot: 'statutoryIngredientsAndValue',
          question: 'Before we draft your strategy: (1) Did the owner pass away without a Will (intestate), (2) Who currently holds possession/papers, and (3) Is any co-heir trying to sell or transfer the property right now?',
          whyLawyerAsks: 'Determines whether we need an immediate written bank/Sub-Registrar objection + Civil Partition Suit with an Order 39 Rules 1 & 2 CPC Temporary Injunction.',
          quickReplies: [
            'Died without a Will — another family member is trying to sell/transfer without giving my share',
            'We want a peaceful family partition / mutation and want to know each heir\'s exact share',
            'The other side claims there is a Will or gift deed that looks suspicious'
          ]
        });
      } else if (domainInfo.isConsumerForum) {
        clarifyingQuestions.push({
          id: 'probe-consumer-facts-and-proof',
          slot: 'paperTrailAndAdmissions',
          question: 'Before prescribing your next move: (1) How much did you pay and when, (2) Did the company/service centre give a written refusal or job sheet, and (3) What proof do you have (invoice, warranty card, WhatsApp/email, photos)?',
          whyLawyerAsks: 'A seasoned practitioner checks if we can resolve this fast via a written job-sheet demand + Brand Grievance Officer + NCH 1915 / RBI / Insurance Ombudsman before spending time in Consumer Court.',
          quickReplies: [
            'I have the invoice & chats — company refused orally without giving a written job sheet',
            'I already complained to customer care / NCH 1915 and they rejected my claim in writing',
            'I am the business/service provider and a customer is demanding an unfair refund'
          ]
        });
      } else {
        clarifyingQuestions.push({
          id: 'probe-general-facts-and-docs',
          slot: 'authorityAndForumStatus',
          question: 'Before I give you a final legal roadmap, please confirm: (1) When did this happen and what stage is it at today, (2) What documents or proof do you have in hand, and (3) What exact outcome do you want?',
          whyLawyerAsks: 'A seasoned lawyer never guesses facts—confirming your stage and available proof first ensures we pick the right section and forum.',
          quickReplies: [
            'This is a new issue — no police complaint, notice, or court case has been filed yet',
            'I have already given a complaint / received a notice and need the exact next move',
            'A case is already running in court and I need strategy for the next hearing'
          ]
        });
      }
    }

  return {
    firCognizabilityAnalysis,
    clarifyingQuestions: clarifyingQuestions.slice(0, 3)
  };
}

/**
 * PHASE 1: CUMULATIVE `CaseFactSheet` STATE MACHINE & ADAPTIVE `0..N` QUESTION GATE
 * Aggregates facts across ALL turns in the session (`priorTurns` + `rawInput`) into the 6 Senior-Counsel slots,
 * determines which slots are `confirmed` vs `missing`, and decides dynamically whether 0, 1, 2, or 3 questions are needed.
 *
 * The 6 slots: (1) who vs whom, (2) when & which State, (3) statutory ingredients / value / severity,
 * (4) current stage before any authority or forum, (5) paper trail & admissions, (6) desired relief & parallel exposures.
 */
const STATE_SENSITIVE_DOMAINS = new Set(['land-revenue', 'tenancy-civil', 'inheritance-partition', 'property-rera']);

export function buildCumulativeCaseFactSheet({
  priorTurns = [],
  rawInput = '',
  hasAttachments = false,
  caseState = {},
  domainInfo = {}
} = {}) {
  const priorUserText = Array.isArray(priorTurns)
    ? priorTurns.map(t => String(t.userInput || '').split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0]).join('\n')
    : '';
  const currentUserText = String(rawInput || '').split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0].trim();
  const cumulativeUserText = `${priorUserText}\n${currentUserText}`.trim();
  const wordCount = cumulativeUserText.split(/\s+/).filter(Boolean).length;
  const detectedState = detectIndianState(`${cumulativeUserText}\n${rawInput}`, caseState);

  const hasRoleAndParties = Boolean(
    caseState.role ||
    /\b(i\s+am|my\s+mother|my\s+father|my\s+wife|my\s+husband|complainant|respondent|accused|victim|buyer|tenant|landlord|builder|bank|police|thana|company|employer|employee|client)\b/i.test(cumulativeUserText)
  );

  const hasDateOrTimeline = /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|today|yesterday|recently|just\s+happened|last\s+week|last\s+month|\d+\s+days?\s+ago|\d+\s+months?\s+ago|202\d|आज|कल|महीने|दिन\s+पहले)\b/i.test(cumulativeUserText)
    || Boolean(caseState.serviceDate || caseState.dishonourDate || caseState.nextHearingDate || caseState.keyDate || caseState.incidentDate);
  const stateNeeded = STATE_SENSITIVE_DOMAINS.has(domainInfo.domain);
  const timelineAndStateConfirmed = hasDateOrTimeline && (Boolean(detectedState) || !stateNeeded);

  const hasIngredientDetail = /\b(rs\.?|inr|₹|\d+\s*(?:lakh|crore|thousand|hazar|हजार|लाख)|hurt|injured|scratch(?:ed)?|bruise|no\s+physical\s+injury|yanked\s+suddenly|bleeding|fracture|weapon|pushed|dragged|entrusted|handed\s+over|without\s+my\s+consent|disagreement|reconcil|locked\s+out|already\s+(?:legally\s+)?married|consensual\s+relationship|active\s+bank\s+home\s+loan|no\s+bank\s+loan|चोट|खरोंच)\b/i.test(cumulativeUserText);

  const hasStageOrAuthorityStatus = /\b(fir\s+no|fir\s+is\s+already|going\s+to\s+the\s+thana\s+now|sanha|missing\s+report|registered|refused|rejected|notice\s+served|return\s+memo|written\s+version|adjournment|hearing|order\s+sheet|caw\s+cell|thana\s+took|police\s+said|no\s+police\s+complaint|no\s+fir|already\s+complained|only\s+threats|new\s+issue|थाना|मना\s+कर\s+दिया)\b/i.test(cumulativeUserText);

  const hasPaperTrail = hasAttachments || /\b(invoice|bill|no\s+bill\s+available|receipt|whatsapp|email|cctv|photo|family\s+photos|video|medical|mlc|agreement|allotment|cheque|memo|letter|screenshot|recording|marriage\s+certificate|बिल|रसीद|चैट|सीसीटीवी)\b/i.test(cumulativeUserText);

  const hasExplicitRelief = /\b(i\s+want|we\s+want|seeking|refund|possession|compensation|maintenance|bail|quash|recover|get\s+(?:it\s+)?back|return\s+(?:of\s+)?my|reconcil|divorce|stop\s+(?:the|them|him|her)|unfreeze|protection|relief|register\s+(?:an?\s+)?fir|peaceful\s+resolution|counselling)\b/i.test(cumulativeUserText);
  const reliefImpliedForVictim = domainInfo.domain === 'criminal-bns-bnss' && /\b(victim|snatch(?:ed|ing)?|stolen|robbed|beaten|attacked|assaulted)\b/i.test(cumulativeUserText);
  const hasDesiredRelief = hasExplicitRelief || reliefImpliedForVictim;

  const slots = [
    {
      id: 'roleAndParties',
      label: 'Who vs Whom',
      confirmed: hasRoleAndParties,
      summary: hasRoleAndParties ? `Role: ${caseState.role || 'identified in facts'}` : 'Whose side you are on, and who the other party is (person, company or government body)'
    },
    {
      id: 'incidentTimelineAndState',
      label: 'When & Which State',
      confirmed: timelineAndStateConfirmed,
      summary: timelineAndStateConfirmed
        ? `Timeline noted${detectedState ? ` · ${detectedState.state}` : ''}`
        : stateNeeded && hasDateOrTimeline
        ? 'Which State/city the property or dispute is in (local laws differ)'
        : 'When it happened (decides deadlines and old IPC vs new BNS)'
    },
    {
      id: 'statutoryIngredientsAndValue',
      label: 'Key Facts, Amount & Severity',
      confirmed: hasIngredientDetail,
      summary: hasIngredientDetail ? 'Key ingredient / injury / amount noted' : 'The facts that decide the exact section (force or hurt, amount, entrustment, marital status)'
    },
    {
      id: 'authorityAndForumStatus',
      label: 'Current Stage',
      confirmed: hasStageOrAuthorityStatus,
      summary: hasStageOrAuthorityStatus ? 'Current procedural stage confirmed' : 'Whether a complaint, FIR, notice or case already exists, and what the authority did'
    },
    {
      id: 'paperTrailAndAdmissions',
      label: 'Paper Trail & Admissions',
      confirmed: hasPaperTrail,
      summary: hasPaperTrail ? 'Documents / proof noted' : 'What is in writing (bills, chats, MLC, CCTV) and whether anything was signed or admitted'
    },
    {
      id: 'desiredReliefAndFlanks',
      label: 'Goal & Parallel Risks',
      confirmed: hasDesiredRelief,
      summary: hasDesiredRelief ? 'Desired outcome noted' : 'What outcome you want, and any parallel exposure (loan, job, family)'
    }
  ];

  const confirmedSlotIds = new Set(slots.filter(s => s.confirmed).map(s => s.id));
  return {
    wordCount,
    slots,
    detectedState,
    confirmedSlotIds,
    confirmedCount: confirmedSlotIds.size,
    missingSlots: slots.filter(s => !s.confirmed)
  };
}

export function evaluateCaseFactReadiness({
  rawInput = '',
  priorTurns = [],
  isFollowUpTurn = false,
  hasAttachments = false,
  forceFullRoadmap = false,
  mode = '',
  domainInfo = {},
  caseState = {}
} = {}) {
  const sheet = buildCumulativeCaseFactSheet({
    priorTurns,
    rawInput,
    hasAttachments,
    caseState,
    domainInfo
  });

  const isAdvocateLookup = mode === 'lawyer-research-bench';
  const userExplicitlyAskedForDraftOrFullPlan = /\b(draft|write\s+a\s+letter|write\s+complaint|full\s+roadmap|skip\s+questions|bilingual|cross-?examination|हिंदी\s+में\s+ड्राफ्ट)\b/i.test(rawInput);

  // Adaptive multi-turn gate over the 6 slots:
  // - 'full-roadmap' when >= 5/6 slots are confirmed on Turn 1, or >= 4/6 cumulatively on a follow-up,
  //   or when records are attached, or the user explicitly asks for a draft / full plan.
  // - Otherwise 'clarify-first' asks only for the still-missing slots.
  const requiredSlots = isFollowUpTurn ? 4 : 5;
  const shouldClarifyFirst = Boolean(
    !hasAttachments &&
    !forceFullRoadmap &&
    !isAdvocateLookup &&
    !userExplicitlyAskedForDraftOrFullPlan &&
    (sheet.confirmedCount < requiredSlots || (!isFollowUpTurn && sheet.wordCount < 35 && sheet.confirmedCount < 5))
  );

  return {
    intakeStage: shouldClarifyFirst ? 'clarify-first' : 'full-roadmap',
    shouldClarifyFirst,
    wordCount: sheet.wordCount,
    factDimensionsConfirmed: sheet.confirmedCount,
    totalSlots: sheet.slots.length,
    slots: sheet.slots,
    detectedState: sheet.detectedState,
    confirmedSlotIds: Array.from(sheet.confirmedSlotIds),
    missingDimensions: sheet.missingSlots.map(s => s.summary)
  };
}

/**
 * PHASE 2: LLM-DRIVEN DYNAMIC QUESTION & OPTION EXTRACTOR (`<nyaya_intake_meta>`)
 * Strips the hidden `<nyaya_intake_meta>{...}</nyaya_intake_meta>` JSON block from visible markdown
 * and returns dynamically generated questions & options for ANY novel long-tail legal scenario!
 */
export function parseAndStripDynamicIntakeMeta(markdown = '') {
  const raw = String(markdown || '');
  const metaRegex = /<nyaya_intake_meta>\s*([\s\S]*?)\s*<\/nyaya_intake_meta>/i;
  const match = raw.match(metaRegex);
  if (!match) {
    return {
      cleanMarkdown: raw,
      dynamicMeta: null
    };
  }

  const cleanMarkdown = raw.replace(metaRegex, '').trim();
  let dynamicMeta = null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && typeof parsed === 'object') {
      dynamicMeta = {
        readyForRoadmap: Boolean(parsed.readyForRoadmap),
        confirmedFacts: Array.isArray(parsed.confirmedFacts) ? parsed.confirmedFacts : [],
        questions: Array.isArray(parsed.questions)
          ? parsed.questions
              .filter(q => q && typeof q.question === 'string' && q.question.trim())
              .map((q, idx) => ({
                id: q.id || `llm-dyn-q-${idx + 1}`,
                slot: q.slot || 'dynamic',
                question: q.question.trim(),
                whyLawyerAsks: q.whyLawyerAsks || q.whyItMatters || 'Helps tailor the exact legal section and forum.',
                quickReplies: Array.isArray(q.quickReplies || q.options)
                  ? (q.quickReplies || q.options).map(o => String(o).trim()).filter(Boolean).slice(0, 4)
                  : []
              }))
          : []
      };
    }
  } catch {
    // Ignore malformed JSON inside tag while still stripping tag from user-facing prose
  }

  return {
    cleanMarkdown,
    dynamicMeta
  };
}

/**
 * 3. DOWNSTREAM TRAP FORESIGHT, BURDEN-OF-PROOF FRAMING & PLAINT "PRAYER CLAUSE" AUDITOR (#3)
 */
export function evaluateDownstreamTrapsAndAuditPrayer({
  rawInput = '',
  domainInfo = {}
} = {}) {
  const text = String(rawInput || '');
  const lower = text.toLowerCase();
  const downstreamWarnings = [];

  // Trap 1: Builder/Land Fraud + Active Bank Loan (BHU Legal Aid / Jamtara Case from cr2 3:15-6:45)
  if (domainInfo.domain === 'property-rera' || /\b(builder|flat|plot|land\s+fraud|zameen|जमीन|bhu\s+legal|bank\s+loan|home\s+loan|emi)\b/i.test(lower)) {
    if (/\b(loan|emi|bank|subvention|tripartite|finance|housing\s+finance)\b/i.test(lower)) {
      downstreamWarnings.push({
        id: 'trap-builder-bank-loan-recovery',
        title: '⚠️ Downstream Trap Alert: Parallel Bank Loan / EMI Recovery While Property is Stuck',
        detail:
          'Even if the builder or land seller defrauded you, the lending bank treats the loan agreement as an independent debt and may trigger ECS bounce notices (Section 138 NI Act), CIBIL damage, or SARFAESI recovery. Do NOT simply stop EMIs silently without legal protection: check the Tripartite Agreement / RBI Housing Finance rules (which forbid banks from disbursing loan tranches upfront without matching construction stages), put the bank\'s Nodal Officer on written notice of the builder fraud, and explicitly include a relief/prayer regarding the loan/tripartite liability in your RERA/Consumer/Civil petition.'
      });
    }
  }

  // Trap 2: Out-of-Court Settlement / Post-Dated Cheque Trap during Ongoing Dispute (cr2 4:40-6:00)
  if (/\b(settle|settlement|compromise|out\s+of\s+court|withdraw\s+the\s+case|samjhauta|समझौता)\b/i.test(lower) || domainInfo.domain !== 'corporate-roc') {
    downstreamWarnings.push({
      id: 'trap-unconditional-withdrawal-settlement',
      title: '🛡️ Settlement Foresight: Never Withdraw a Case on Oral Promises or Uncleared Post-Dated Cheques',
      detail:
        'A common tactic by opposite parties once they feel pressure is to offer an informal "out-of-court settlement" or post-dated cheques in exchange for immediate withdrawal of your complaint. Never withdraw unconditionally: insist on either (a) upfront RTGS/NEFT/Demand Draft clearance before withdrawal, or (b) a formal written Compromise Memo / Lok Adalat Award recorded by the court with an explicit clause that if any installment defaults, the original claim revives automatically with penalty.'
    });
  }

  // Burden & Standard of Proof Framing (cr3 19:30-21:30)
  let burdenOfProofGuide = {
    category: 'Civil / Consumer Preponderance of Probabilities ("Weighing of Evidence")',
    principle:
      'In Civil Courts, Consumer Commissions, and RERA, the standard is "preponderance of probabilities" (weighing of evidence)—not proof beyond reasonable doubt. The party with the clearer chronological paper trail (invoices, written job sheets, bank transfers, dated notices, and admissions) wins the balance.'
  };

  if (domainInfo.domain === 'criminal-bns-bnss') {
    burdenOfProofGuide = {
      category: 'Criminal Law ("Proof Beyond Reasonable Doubt" + Statutory Safeguards)',
      principle:
        'In criminal proceedings, the prosecution must prove guilt "beyond reasonable doubt", and at the FIR/bail stage the court looks at whether the statutory ingredients of a cognizable offence are made out on the face of the record and whether custodial interrogation is necessary (bail is the rule, jail is the exception).'
    };
  } else if (domainInfo.domain === 'cheque-bounce-138') {
    burdenOfProofGuide = {
      category: 'Quasi-Criminal Reverse Burden (Sections 138 & 139 NI Act)',
      principle:
        'Once the signature on the dishonoured cheque and timely 30-day statutory demand notice are established, Section 139 of the NI Act raises a mandatory statutory presumption that the cheque was issued for a legally enforceable debt—shifting the burden onto the drawer to rebut it by preponderance of probabilities.'
    };
  } else if (domainInfo.domain === 'matrimonial-family') {
    burdenOfProofGuide = {
      category: 'Quasi-Criminal / Family Welfare Standard (Section 144 BNSS & Section 12 PWDVA)',
      principle:
        'Maintenance (Section 144 BNSS / old s.125 CrPC) and Domestic Violence (Section 12 PWDVA) proceedings are quasi-criminal/welfare remedies: once the applicant establishes a prima facie domestic/marital relationship and inability to maintain herself, the onus shifts to the respondent to prove his defence or income via mandatory Rajnesh v. Neha Assets & Liabilities Affidavits.'
    };
  }

  // Plaint / Petition "Prayer Clause" Auditor (cr2 4:10-6:00)
  // Runs when the user pastes or attaches a draft plaint, complaint, petition, or prayer clause
  let prayerClauseAudit = null;
  const looksLikeDraftOrPlaint = /\b(prayer|wherefore|most\s+respectfully\s+prayed|relief\s+sought|reliefs?\s+claimed|in\s+the\s+court\s+of|before\s+the\s+district\s+consumer|plaint\s+under|complaint\s+under\s+section)\b/i.test(text);

  if (looksLikeDraftOrPlaint) {
    const missingPrayers = [];
    const presentPrayers = [];

    if (/\b(interest|%\s*p\.?a\.?|per\s+annum)\b/i.test(text)) {
      presentPrayers.push('Pendente lite and future interest claimed');
    } else {
      missingPrayers.push('Explicit prayer for pendente lite and future interest (% per annum from date of payment/default until actual realization)');
    }

    if (/\b(cost\s+of\s+litigation|litigation\s+costs?|costs?\s+of\s+the\s+suit|costs?\s+of\s+this\s+complaint)\b/i.test(text)) {
      presentPrayers.push('Costs of litigation claimed');
    } else {
      missingPrayers.push('Prayer for costs of litigation / legal expenses');
    }

    if (/\b(interim\s+relief|temporary\s+injunction|order\s+39|section\s+36|stay\s+on\s+cancellation|restrain)\b/i.test(text)) {
      presentPrayers.push('Interim protection / injunction prayer included');
    } else if (['property-rera', 'inheritance-partition', 'matrimonial-family'].includes(domainInfo.domain)) {
      missingPrayers.push('Interim / Ad-interim relief prayer (e.g., restraining third-party sale/cancellation under Order 39 CPC / RERA s.36 / PWDVA s.23)');
    }

    if (/\b(loan|emi|bank|tripartite|subvention)\b/i.test(text) && !/\b(prayer|direct)[\s\S]{0,250}\b(bank|lender|emi|tripartite)\b/i.test(text)) {
      missingPrayers.push('Specific prayer addressing the Bank / Tripartite Loan liability (critical so the buyer is not left paying EMIs on a defrauded/delayed property)');
    }

    if (/\b(any\s+other\s+order|any\s+other\s+relief|pass\s+such\s+other)\b/i.test(text)) {
      presentPrayers.push('Omnibus residual relief clause ("any other relief deemed fit") included');
    } else {
      missingPrayers.push('Omnibus residual prayer ("Pass any other or further order(s) as this Hon\'ble Court/Commission may deem fit in the interest of justice")');
    }

    prayerClauseAudit = {
      audited: true,
      status: missingPrayers.length === 0 ? 'COMPLETE' : 'NEEDS_ADDITIONS',
      presentPrayers,
      missingPrayers,
      practitionerRule:
        'Advocate Rule: A court cannot grant a final relief that you forgot to ask for in the Prayer clause. Verify every item above before filing.'
    };
  }

  return {
    downstreamWarnings,
    burdenOfProofGuide,
    prayerClauseAudit
  };
}

/**
 * 5. STRUCTURED "HOW A LOCAL LAWYER THINKS" CASE-TRAJECTORY MEMORY (#5)
 * Real end-to-end practitioner "turn of events" trajectories so Nyaya applies courtroom & thana experience.
 */
export const PRACTITIONER_CASE_TRAJECTORIES = [
  {
    id: 'trajectory-police-fir-refusal',
    title: 'Thana Refuses FIR → Ingredient Framing & BNSS s.173(1)/(3)/(4) Unlock',
    matchRegex: /\b(fir\b|police\s+refus|not\s+registering|thana|थाना|पुलिस|173\s+bnss|154\s+crpc)\b/i,
    initialGrievance: 'Client visits police station; duty officer orally refuses to take complaint saying "Yeh civil matter hai" or "Pehle जांच करेंगे".',
    wherePeopleGetStuck: 'Generic AI tells them to immediately mail the SP and file a Magistrate petition, wasting weeks when the complaint itself lacked cognizable ingredients or ignored BNSS s.173(3).',
    practitionerTurnOfEvents: [
      'Step 1 (Ingredient Check): Verify BNSS First Schedule—ensure the written complaint states clear cognizable ingredients (e.g., dishonest inducement from Day 1 under BNS s.318(4), entrustment breach under s.316(2), or theft >= ₹5,000 / snatching s.304).',
      'Step 2 (Counter Announcement at Thana): Hand over a written complaint in duplicate, demand a DD/GD receiving number (or file via state e-FIR portal), and if the offence carries 3–7 years, ask whether the SHO has sought DSP permission for a 14-day Preliminary Inquiry under Section 173(3) BNSS.',
      'Step 3 (Escalation with Proof): Only after attaching the stamped receiving / speed-post receipt, escalate to the SP/DCP under Section 173(4) BNSS, followed by a Section 175(3) BNSS Magistrate application supported by a mandatory Priyanka Srivastava affidavit.'
    ]
  },
  {
    id: 'trajectory-matrimonial-argument-vs-cruelty',
    title: 'Matrimonial Quarrel vs. 498A/BNS 85 & PWDVA s.12 Triage',
    matchRegex: /\b(dowry|dahej|दहेज|498\s*-?\s*a|bns\s*85|husband|wife|in-laws|caw\s+cell|mahila\s+thana|streedhan)\b/i,
    initialGrievance: 'Spouse reports "dowry harassment" or receives a CAW Cell call after a marital dispute.',
    wherePeopleGetStuck: 'Filing a mechanical criminal FIR over a minor marital tiff permanently destroys reconciliation; conversely, filing Section 9 HMA (Restitution) when locked out fails to recover streedhan or emergency shelter.',
    practitionerTurnOfEvents: [
      'Step 1 (Goal Discovery): Separate (a) minor domestic argument where the client wants reconciliation (use Family Mediation / Section 9 HMA) from (b) lockout/violence/streedhan deprivation.',
      'Step 2 (Single-Window Civil Shield): For shelter, streedhan/passport return, and child maintenance, file a Section 12 PWDVA application before the Judicial Magistrate (combining ss.18, 19, 19(8), 20, 21) + Section 144 BNSS maintenance.',
      'Step 3 (CAW Cell Defence): If summoned to CAW Cell on BNS s.85 (498A IPC — Cognizable & NON-BAILABLE, max 3 yrs), rely on Arnesh Kumar & Section 35(3) BNSS Notice of Appearance, attend counselling calmly with a written chronology, and preserve chat/audio proof of any extortionate demand.'
    ]
  },
  {
    id: 'trajectory-land-builder-loan-fraud',
    title: 'Builder / Land Fraud with Active Bank Home Loan (BHU Legal Aid / Jamtara Trajectory)',
    matchRegex: /\b(builder|rera|maharera|flat\s+delay|land\s+fraud|plot\s+fraud|tripartite|subvention|home\s+loan)\b/i,
    initialGrievance: 'Buyer paid money + took a bank loan for a flat/plot; builder/seller defaulted or had defective title, and now the bank is harassing the buyer for EMIs.',
    wherePeopleGetStuck: 'Plaint/complaint only sues the builder with a defective Prayer clause, leaving the bank free to ruin the buyer\'s CIBIL and initiate SARFAESI/ECS bounce proceedings.',
    practitionerTurnOfEvents: [
      'Step 1 (Concurrent Forum Choice): Under Imperia Structures & Newtech Promoters, choose RERA Regulatory Authority (Sections 18(1) & 31 + Section 36 stay) for possession + monthly delay interest, or Consumer Commission (District up to ₹50L paid; State ₹50L–₹2Cr) for refund + compensation.',
      'Step 2 (Bank / Tripartite Shield): Put the bank on written notice of any Tripartite Agreement / RBI construction-linked disbursal violation so the builder\'s liability for subvention/interest is documented.',
      'Step 3 (Prayer Clause Audit): Explicitly pray for principal/possession, quantified interest, interim stay on cancellation/coercive recovery, tripartite bank directions, litigation costs, and omnibus relief.'
    ]
  },
  {
    id: 'trajectory-service-contract-refund-demand',
    title: 'Client / Customer Demanding Unfair Refund After Partial Delivery (Website / Service Dispute)',
    matchRegex: /\b(website|freelanc|agency|client\s+demanding\s+refund|22,?000|35,?000|scope\s+of\s+work|partial\s+work|milestone)\b/i,
    initialGrievance: 'Service provider / developer built substantial work (e.g., ₹22,000 advance on ₹35,000 project), client stops cooperating or demands 100% refund with legal threats.',
    wherePeopleGetStuck: 'Panicking at a legal notice or failing to document delivery milestones and client approval bottlenecks.',
    practitionerTurnOfEvents: [
      'Step 1 (Evidence Lock): Export timestamped staging links, Git commits, WhatsApp/email approvals, and requests where the client delayed inputs.',
      'Step 2 (Measured Reply to Notice): Send a calm, point-by-point reply placing on record the completed percentage of work, readiness to perform the balance upon receipt of pending inputs/milestone payment, and quantum meruit (Section 70 Contract Act) entitlement for work already delivered.',
      'Step 3 (Settlement / Cure Offer): Offer a clear 7-day window for a joint handover call or structured sign-off so any Consumer/Civil forum sees you acted in good faith.'
    ]
  },
  {
    id: 'trajectory-urgent-assault-intimidation',
    title: 'Sudden Physical Assault / Public Intimidation (Goa Assault Fast-Triage Trajectory)',
    matchRegex: /\b(beaten|beat\s+me|attacked|mob|goons|hospital|injury|bleeding|threatened\s+to\s+kill|मारपीट|पीट\s+दिया)\b/i,
    initialGrievance: 'Victim was physically attacked or intimidated and is in shock/anger needing immediate action within minutes, not 2 days later.',
    wherePeopleGetStuck: 'Delaying medical examination (MLC) or CCTV preservation while waiting for long legal research.',
    practitionerTurnOfEvents: [
      'Step 1 (First 60 Minutes — MLC & 112): Dial 112 (creates an automatic PCR log) and go to the nearest Government Hospital for a Medico-Legal Case (MLC) injury report—this is the single strongest piece of evidence.',
      'Step 2 (CCTV & Witness Lock): Immediately note nearby shop/traffic CCTV cameras (most overwrite in 3–7 days) and request the IO in writing to seize the DVR.',
      'Step 3 (Zero FIR / Section 173(1) BNSS): File a written complaint or Zero FIR at the nearest police station citing exact hurt/wrongful-restraint/intimidation sections (BNS ss.115(2), 126(2), 351(2)/(3)).'
    ]
  }
];

export function matchPractitionerCaseTrajectories(rawInput = '', domainInfo = {}) {
  const text = `${rawInput} ${domainInfo.domain || ''} ${domainInfo.label || ''}`;
  return PRACTITIONER_CASE_TRAJECTORIES.filter(t => t.matchRegex.test(text)).slice(0, 2);
}

/**
 * 4. INSTANT <1s TRIAGE CARD BUILDER (#4)
 * Sent immediately in the first SSE event so an anxious or urgent user gets
 * calm, empathetic, actionable orientation in <100ms while Senior Counsel streams.
 */
export function buildInstantTriageCard({
  rawInput = '',
  domainInfo = {},
  autoDetectedCategoryLabel = '',
  paidAmountInr = null,
  niAct138 = null,
  criminalRules = null,
  practitionerAnalysis = {}
} = {}) {
  const firstProbing = practitionerAnalysis.factProbing?.clarifyingQuestions?.[0] || null;
  const firstTranslation = practitionerAnalysis.ingredientTranslations?.[0] || null;
  const firCheck = practitionerAnalysis.factProbing?.firCognizabilityAnalysis || null;

  let headline = `Detected: ${autoDetectedCategoryLabel || domainInfo.label || 'Indian Legal Matter'}`;
  let immediateReassurance = 'Nyaya has locked in your facts and statutory rules. Here is your immediate 10-second orientation while your full roadmap and drafts stream below:';
  let firstMoveNow = 'Preserve your chronological proof (invoices, bank/UPI refs, WhatsApp chats, and dated notices) in one folder.';

  if (niAct138) {
    headline = `🏦 Urgent NI Act Section 138 Cheque Bounce Clock`;
    firstMoveNow = niAct138.noticeWindowExpired
      ? `Your 30-day statutory notice window from ${niAct138.dishonourDate} expired on ${niAct138.noticeDeadlineDate}. Check if cheque validity allows re-presentation or pursue Civil Order 37 Summary Recovery.`
      : `You have ${niAct138.daysRemainingForNotice} day(s) left (until ${niAct138.noticeDeadlineDate}) to dispatch a mandatory written 15-day statutory demand notice via Speed Post + WhatsApp/Email. Jurisdiction lies at the PAYEE'S bank branch (Section 142(2)(a)).`;
  } else if (firCheck) {
    headline = `🛡️ Police / FIR Triage: ${firCheck.scheduleStatus}`;
    firstMoveNow = firCheck.whatToTellPoliceOrDo;
  } else if (criminalRules?.matchedOffences?.length) {
    const off = criminalRules.matchedOffences[0];
    headline = `🛡️ ${off.bnsSection} (${off.ipcSection}) — ${off.bailable ? 'Bailable' : 'NON-BAILABLE'}`;
    firstMoveNow = off.arneshKumarNoticeApplies
      ? `Automatic arrest is barred (punishment <= 7 yrs) under Arnesh Kumar & Section 35(3) BNSS Notice of Appearance. Prepare a calm written chronology before appearing.`
      : `Because punishment exceeds 7 years, Section 35(3) BNSS notice protection does not automatically apply—consult counsel immediately for Section 482 BNSS Anticipatory Bail.`;
  } else if (domainInfo.domain === 'property-rera') {
    headline = `🏠 Property / Builder Dispute — Concurrent RERA & Consumer Remedies`;
    firstMoveNow = `Under Imperia Structures & Newtech Promoters, RERA (s.18/s.31) and Consumer Commission remedies are concurrent. If a bank home loan is running, put the bank on written notice alongside the builder.`;
  } else if (domainInfo.domain === 'matrimonial-family') {
    headline = `👨‍👩‍👧 Matrimonial & Family Protection Triage`;
    firstMoveNow = `If seeking shelter, streedhan return, or maintenance, a single-window Magistrate application under Section 12 PWDVA + Section 144 BNSS applies. If it is a minor disagreement and you want reconciliation, start with Family Counselling / Mediation rather than an FIR.`;
  } else if (domainInfo.domain === 'inheritance-partition') {
    headline = `📜 Family Property & Succession (HSA 1956 + Order 39 CPC)`;
    firstMoveNow = `Class I heirs (including married daughters under Section 6 HSA) hold equal shares. Serve a written objection with Death Certificate to the Bank/Sub-Registrar and file a Partition Suit + Order 39 Rules 1 & 2 CPC Temporary Injunction.`;
  } else if (domainInfo.isConsumerForum) {
    headline = `⚡ Consumer Escalation Triage${paidAmountInr ? ` (Amount: ₹${paidAmountInr.toLocaleString('en-IN')})` : ''}`;
    firstMoveNow = `Start with the lowest-headache move before court: demand a written job-sheet/refusal reason, escalate to the brand's Grievance/Nodal Officer, and file a free complaint on National Consumer Helpline (NCH 1915 / consumerhelpline.gov.in) or RBI/Insurance Ombudsman.`;
  }

  return {
    generatedAtMs: Date.now(),
    headline,
    immediateReassurance,
    firstMoveNow,
    keyIngredientTranslation: firstTranslation
      ? `${firstTranslation.laymanTerm} → ${firstTranslation.actualLegalConcept}`
      : null,
    topClarifyingQuestion: firstProbing ? firstProbing.question : null,
    quickReplies: firstProbing ? firstProbing.quickReplies : []
  };
}

export function buildBilingualDraftInstruction(domainInfo = {}) {
  if (domainInfo.domain === 'criminal-bns-bnss') {
    return 'Prepare a complete, ready-to-print Bilingual Police Complaint / Application (both in formal Hindi देवनागरी: "सेवा में, थाना प्रभारी महोदय / वरीय पुलिस अधीक्षक" AND in formal English) citing the exact BNS/BNSS 2023 sections, chronological facts, and a request for a stamped DD/FIR receiving copy under Section 173(2) BNSS (or Jimmanama release under Section 497/503 BNSS if for property release), with clear [PLACEHOLDERS] for any missing details.';
  }
  if (domainInfo.domain === 'matrimonial-family') {
    return 'Prepare a complete, ready-to-print Bilingual Application / Representation (both in formal Hindi देवनागरी AND in English) tailored to the confirmed facts (either for Family Counselling / Mediation or under Section 12 PWDVA, 2005 / Section 144 BNSS), including a complete Prayer clause with clear [PLACEHOLDERS].';
  }
  return 'Prepare a complete, ready-to-print Bilingual Formal Notice / Complaint / Application (both in formal Hindi देवनागरी AND in English) for this matter, including a complete Prayer / Relief Sought section with clear [PLACEHOLDERS] for dates, amounts, and party details.';
}

/**
 * Master entry point called by computeCaseEngine in ui/server.mjs
 */
export function runPractitionerIntelligence({
  rawInput = '',
  priorTurns = [],
  domainInfo = {},
  paidAmountInr = null,
  caseState = {},
  autoDetectedCategoryLabel = '',
  niAct138 = null,
  criminalRules = null,
  isFollowUpTurn = false,
  hasAttachments = false,
  forceFullRoadmap = false,
  mode = ''
} = {}) {
  const priorUserText = Array.isArray(priorTurns)
    ? priorTurns.map(t => String(t.userInput || '').split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0]).join('\n')
    : '';
  const cumulativeInput = priorUserText ? `${priorUserText}\n${rawInput}` : rawInput;

  const factReadiness = evaluateCaseFactReadiness({
    rawInput,
    priorTurns,
    isFollowUpTurn,
    hasAttachments,
    forceFullRoadmap: Boolean(forceFullRoadmap || caseState.forceFullRoadmap),
    mode,
    domainInfo,
    caseState
  });
  const ingredientTranslations = translateLaymanToLegalIngredients(cumulativeInput, paidAmountInr);
  const rawFactProbing = evaluateConversationalFactProbing({
    rawInput: cumulativeInput,
    domainInfo,
    paidAmountInr,
    caseState
  });

  // Adaptive 0..N Question Filtering:
  // Remove questions whose slot is already confirmed across the cumulative CaseFactSheet!
  const confirmedSet = new Set(factReadiness.confirmedSlotIds || []);
  let adaptiveQuestions = (rawFactProbing.clarifyingQuestions || []).filter(
    q => !q.slot || !confirmedSet.has(q.slot)
  );
  // If we are still in clarify-first mode and all template slots happened to match regexes, keep at least 1 high-value question
  if (factReadiness.shouldClarifyFirst && adaptiveQuestions.length === 0 && rawFactProbing.clarifyingQuestions?.length > 0) {
    adaptiveQuestions = rawFactProbing.clarifyingQuestions.slice(0, 1);
  }
  // If >= 4 slots are confirmed (full-roadmap ready), 0 clarifying questions are needed unless 1 slot remains open
  if (!factReadiness.shouldClarifyFirst && factReadiness.factDimensionsConfirmed >= 5) {
    adaptiveQuestions = [];
  }

  const factProbing = {
    ...rawFactProbing,
    clarifyingQuestions: adaptiveQuestions
  };
  const foresightAndPrayer = evaluateDownstreamTrapsAndAuditPrayer({
    rawInput,
    domainInfo
  });
  const matchedTrajectories = matchPractitionerCaseTrajectories(rawInput, domainInfo);

  // Senior-Counsel threshold checks (Stage 2), paper trail (Stage 1b), forum election (Stage 3), flanks (Stage 4)
  const maintainabilityAudit = evaluateMaintainabilityAndOusters({
    rawInput: cumulativeInput,
    domainInfo,
    caseState
  });
  const paperTrailAudit = evaluatePaperTrailAndSelfGoals({ rawInput: cumulativeInput, hasAttachments });
  const forumElection = evaluateForumElectionAndEconomics({ domainInfo });
  const flankRisks = evaluateFlankRisks({ rawInput: cumulativeInput, domainInfo });
  const jurisdictionState = factReadiness.detectedState || detectIndianState(cumulativeInput, caseState);

  // SQLite 384-Dim Semantic Vector Search + Adjacent Chapter-Cluster Expansion + Admin Practitioner Lessons
  const semanticStatutoryCluster = searchStatutoryProvisionsSemantic(
    `${cumulativeInput} ${domainInfo.domain || ''} ${domainInfo.label || ''}`,
    { topK: 3, expandCluster: true }
  );
  const semanticPractitionerLessons = searchPractitionerLessonsSemantic(
    cumulativeInput,
    domainInfo.domain || '',
    3
  );
  const bilingualDraftInstruction = buildBilingualDraftInstruction(domainInfo);
  const crossExaminationInstruction = buildCrossExaminationInstruction(domainInfo);

  const partial = {
    factReadiness,
    ingredientTranslations,
    factProbing,
    foresightAndPrayer,
    matchedTrajectories,
    maintainabilityAudit,
    paperTrailAudit,
    forumElection,
    flankRisks,
    jurisdictionState,
    semanticStatutoryCluster,
    semanticPractitionerLessons,
    bilingualDraftInstruction,
    crossExaminationInstruction
  };

  const instantTriage = buildInstantTriageCard({
    rawInput,
    domainInfo,
    autoDetectedCategoryLabel,
    paidAmountInr,
    niAct138,
    criminalRules,
    practitionerAnalysis: partial
  });

  return {
    ...partial,
    instantTriage
  };
}
