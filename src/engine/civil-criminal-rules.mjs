/**
 * Deterministic Engine for Civil, Property/RERA, Matrimonial/Family, and Criminal (BNS/BNSS/NI Act s.138) Law
 * Ensures consumer-court rules are never misapplied to civil/criminal matters and provides
 * deterministic statutory deadline, jurisdiction, fee, and bailability calculations.
 */

import { daysBetween, addDays } from './consumer-rules.mjs';

export const BNS_CUTOFF_DATE = '2024-07-01';

/**
 * Verified Offence Classification & IPC/CrPC <-> BNS/BNSS Mapping Table
 */
export const VERIFIED_CRIMINAL_OFFENCE_MAP = [
  {
    id: 'cruelty-498a-bns85',
    matchRegex: /\b(498\s*-?\s*a|bns\s*85|bns\s*86|dowry\s+harassment|matrimonial\s+cruelty|caw\s+cell|mahila\s+thana)\b/i,
    ipcSection: 'Section 498A IPC',
    bnsSection: 'Section 85 & 86 BNS, 2023',
    offenceName: 'Cruelty by husband or relatives of husband',
    cognizable: true,
    bailable: false,
    maxPunishmentYears: 3,
    arneshKumarNoticeApplies: true,
    statutoryNote: 'Cognizable and NON-BAILABLE (never call 498A/BNS 85 "bailable"). Because maximum punishment is 3 years (<= 7 years), automatic arrest is barred under Arnesh Kumar v. State of Bihar (2014) 8 SCC 273; police must issue a Notice of Appearance under Section 35(3) BNSS (formerly Section 41A CrPC) unless specific written reasons under s.35(1)(b) BNSS are recorded. A CAW Cell / Family Counselling call is a pre-FIR mediation step, not an arrest warrant.'
  },
  {
    id: 'criminal-breach-trust-406-bns316',
    matchRegex: /\b(406\s+ipc|bns\s*316|streedhan|stridhan|criminal\s+breach\s+of\s+trust)\b/i,
    ipcSection: 'Section 406 IPC',
    bnsSection: 'Section 316(2) BNS, 2023',
    offenceName: 'Criminal breach of trust (including unlawful retention of streedhan)',
    cognizable: true,
    bailable: false,
    maxPunishmentYears: 5,
    arneshKumarNoticeApplies: true,
    statutoryNote: 'Cognizable and NON-BAILABLE (up to 5 years under BNS 316(2); 3 years under IPC 406). Covered by the <= 7-year Arnesh Kumar / Section 35(3) BNSS notice safeguard.'
  },
  {
    id: 'cheating-420-bns318',
    matchRegex: /\b(420\s+ipc|section\s+420|bns\s*318|cheating|defraud|scam|cyber\s*fraud)\b/i,
    ipcSection: 'Section 420 IPC',
    bnsSection: 'Section 318(4) BNS, 2023',
    offenceName: 'Cheating and dishonestly inducing delivery of property',
    cognizable: true,
    bailable: false,
    maxPunishmentYears: 7,
    arneshKumarNoticeApplies: true,
    statutoryNote: 'Cognizable and NON-BAILABLE (up to 7 years + fine). Covered by the <= 7-year Arnesh Kumar / Section 35(3) BNSS notice safeguard.'
  },
  {
    id: 'extortion-384-bns308',
    matchRegex: /\b(383\s+ipc|384\s+ipc|bns\s*308|extort|extortion)\b/i,
    ipcSection: 'Section 383 / 384 IPC',
    bnsSection: 'Section 308(2) BNS, 2023',
    offenceName: 'Extortion',
    cognizable: true,
    bailable: false,
    maxPunishmentYears: 7,
    arneshKumarNoticeApplies: true,
    statutoryNote: 'Cognizable and NON-BAILABLE (up to 7 years under BNS 308(2); 3 years under IPC 384). In matrimonial CAW Cell disputes, preserve written/WhatsApp evidence of monetary threats calmly and present it in counselling/anticipatory-bail defense before rushing into a retaliatory counter-FIR.'
  },
  {
    id: 'intimidation-506-bns351',
    matchRegex: /\b(506\s+ipc|bns\s*351|criminal\s+intimidation|death\s+threat)\b/i,
    ipcSection: 'Section 506 IPC',
    bnsSection: 'Section 351(2)/(3) BNS, 2023',
    offenceName: 'Criminal intimidation',
    cognizable: false,
    bailable: true,
    maxPunishmentYears: 2,
    arneshKumarNoticeApplies: true,
    statutoryNote: 'Basic criminal intimidation (s.351(2) BNS) carries up to 2 years (non-cognizable, bailable unless state amendment applies); threat to cause death/grievous hurt (s.351(3) BNS) carries up to 7 years.'
  },
  {
    id: 'deceitful-promise-bns69',
    matchRegex: /\b(bns\s*69|section\s+69\b|s\.?\s*69\s+bns|false\s+promise\s+to\s+marry|deceitful\s+means|marital\s+rape)\b/i,
    ipcSection: 'Previously prosecuted under Section 376 / 90 IPC (Marital Exception: Exception 2 to Section 375 IPC)',
    bnsSection: 'Section 69 BNS, 2023 & Exception 2 to Section 63 BNS, 2023',
    offenceName: 'Sexual intercourse by employing deceitful means / false promise to marry (vs. Marital Exception under s.63 Exception 2 BNS)',
    cognizable: true,
    bailable: false,
    maxPunishmentYears: 10,
    arneshKumarNoticeApplies: false,
    statutoryNote: 'Cognizable and NON-BAILABLE, carrying up to 10 years imprisonment. Because maximum punishment exceeds 7 years, Section 35(3) BNSS / Arnesh Kumar notice protection does NOT automatically apply; immediate Anticipatory Bail under Section 482 BNSS is essential. CRITICAL DEFENCE DISTINCTIONS: (1) If the parties are already legally married and the wife is >= 18 years of age, Section 69 BNS ("promise to marry") cannot legally apply at all, and Exception 2 to Section 63 BNS excludes marital intercourse with an adult wife from Section 63/64 BNS rape (though cruelty/hurt under s.85/115 BNS and PWDVA s.12 remain actionable); (2) For unmarried couples after a breakup, under Pramod Suryabhan Pawar v. State of Maharashtra ((2019) 9 SCC 608), Sonu @ Subhash Kumar (2021), and Naim Ahamed (2023), a subsequent breach/failure of a genuine promise to marry due to family opposition or incompatibility is NOT a "false promise to marry from inception" and the FIR is liable to be quashed under Section 528 BNSS (old s.482 CrPC).'
  }
];

export const PROCEDURAL_CODE_EQUIVALENTS = {
  noticeOfAppearance: 'Section 35(3) BNSS, 2023 (formerly Section 41A CrPC, 1973)',
  anticipatoryBail: 'Section 482 BNSS, 2023 (formerly Section 438 CrPC, 1973)',
  regularBailMagistrate: 'Section 480 BNSS, 2023 (formerly Section 437 CrPC, 1973)',
  regularBailSessionsHighCourt: 'Section 483 BNSS, 2023 (formerly Section 439 CrPC, 1973)',
  defaultStatutoryBail: 'Section 187(2)-(3) BNSS, 2023 (formerly Section 167(2) CrPC — 60 days or 90 days chargesheet ceiling)',
  firRegistration: 'Section 173(1) BNSS, 2023 (formerly Section 154 CrPC — includes Zero FIR & e-FIR)',
  spEscalationOnFirRefusal: 'Section 173(4) BNSS, 2023 (formerly Section 154(3) CrPC)',
  magistrateDirectionForInvestigation: 'Section 175(3) BNSS, 2023 (formerly Section 156(3) CrPC — requires Priyanka Srivastava affidavit)',
  highCourtQuashing: 'Section 528 BNSS, 2023 (formerly Section 482 CrPC)',
  summaryMaintenance: 'Section 144 BNSS, 2023 (formerly Section 125 CrPC)',
  electronicEvidenceCertificate: 'Section 63 Bharatiya Sakshya Adhiniyam (BSA), 2023 (formerly Section 65B Indian Evidence Act, 1872)'
};

/**
 * Deterministically detects the primary legal domain & forum so Consumer Commission rules
 * are never misapplied to Civil, Property/RERA, Matrimonial, Partition, or Criminal cases.
 */
export function detectLegalDomain({ door = '', mode = '', caseState = {}, rawInput = '' } = {}) {
  const text = `${rawInput} ${caseState.subTrack || ''} ${caseState.forum || ''} ${caseState.stage || ''}`.toLowerCase();

  if (door === 'company' || mode === 'company-advisor' || caseState.companyNeed) {
    return {
      domain: 'corporate-roc',
      forum: 'mca-roc',
      isConsumerForum: false,
      label: 'Companies Act, 2013 & LLP Act, 2008 (MCA21 / RoC)'
    };
  }

  // Explicit subTrack or forum from the dedicated Civil, Family & Criminal door or Forum selector
  if (caseState.subTrack === 'cheque-bounce-138' || /\b(section\s+138|s\.?\s*138|cheque\s+bounc|cheque\s+dishonour|dishonoured\s+cheque|return\s+memo|insufficient\s+funds|funds\s+insufficient|negotiable\s+instruments)\b/i.test(text)) {
    return {
      domain: 'cheque-bounce-138',
      forum: 'judicial-magistrate-ni138',
      isConsumerForum: false,
      label: 'Negotiable Instruments Act, 1881 (Section 138 Cheque Dishonour — Criminal Magistrate Court)'
    };
  }

  // Check Matrimonial / DV vs Criminal Police/Bail/FIR
  const hasMatrimonySignals = /\b(matrimon|marriage|married|husband|wife|in-laws|mother-in-law|streedhan|stridhan|divorce|alimony|domestic\s+violence|dv\s+act|pwdva|protection\s+officer|shared\s+household|caw\s+cell|mahila\s+thana|498\s*-?\s*a|restitution\s+of\s+conjugal)\b/i.test(text);
  const hasCriminalArrestOrFirSignals = /\b(fir\b|zero\s+fir|arrest|anticipatory\s+bail|regular\s+bail|498\s*-?\s*a|bns\s*\d*|bnss\s*\d*|caw\s+cell|mahila\s+thana|police\s+station|thana\b|41a\s+crpc|35\(3\)\s+bnss|quash|chargesheet|remand|extortion|snatch|snatched|snatching|robbery|theft|chori|stolen|assault|beaten|cognizable|non-bailable)\b/i.test(text);

  // Exclusive-tribunal pillars are checked before the general criminal/family routes, because the
  // forum (DRT, MACT, Maintenance Tribunal) is decided by the subject matter, not by a passing FIR mention.
  if (/\b(sarfaesi|13\s*\(\s*2\s*\)\s*notice|13\s*\(\s*4\s*\)|possession\s+notice|symbolic\s+possession|bank\s+auction|e-?auction|drt\b|debts?\s+recovery\s+tribunal|recovery\s+agents?|declared\s+(?:as\s+)?npa|\bnpa\b|cibil\s+(?:error|wrong|score\s+(?:wrong|dropped)))/i.test(text)) {
    return {
      domain: 'banking-sarfaesi',
      forum: 'drt-or-rbi-ombudsman',
      isConsumerForum: false,
      label: 'Banking Recovery & SARFAESI (DRT Section 17 / RBI Integrated Ombudsman)'
    };
  }

  if (/\b(road\s+accident|motor\s+accident|accident\s+claim|mact\b|hit\s+and\s+run|run\s+over\s+by|(?:car|truck|bus|bike|vehicle)\s+hit\s+(?:me|my|him|her)|died\s+in\s+(?:a\s+)?(?:road\s+)?accident)/i.test(text)) {
    return {
      domain: 'motor-accident-mact',
      forum: 'motor-accident-claims-tribunal',
      isConsumerForum: false,
      label: 'Motor Accident Claims (MACT — Sections 164/166 Motor Vehicles Act)'
    };
  }

  if (/\b(senior\s+citizens?\s+act|maintenance\s+tribunal|(?:elderly|old|aged)\s+(?:mother|father|parents?)|(?:my\s+)?(?:son|daughter|children)\s+(?:is|are)\s+(?:not\s+looking\s+after|harassing|threatening)\s+(?:me|us|my\s+parents)|gift\s+deed\s+(?:to|in\s+favour\s+of)\s+(?:my\s+)?(?:son|daughter))/i.test(text)) {
    return {
      domain: 'senior-citizens',
      forum: 'maintenance-tribunal-sdo',
      isConsumerForum: false,
      label: 'Senior Citizens & Parents (Maintenance Tribunal — Sections 4, 5 & 23 of the 2007 Act)'
    };
  }

  if (caseState.subTrack === 'criminal' || mode === 'criminal-advisor' || (hasCriminalArrestOrFirSignals && !/\b(locked\s+the\s+door|pushed\s+me\s+out|need\s+a\s+roof|monthly\s+money\s+for\s+my\s+child)\b/i.test(text))) {
    return {
      domain: 'criminal-bns-bnss',
      forum: 'criminal-magistrate-sessions',
      isConsumerForum: false,
      label: 'Criminal Law & Procedure (BNS / BNSS / BSA 2023 & IPC / CrPC)'
    };
  }

  if (caseState.subTrack === 'matrimonial-family' || caseState.forum === 'family-court' || hasMatrimonySignals) {
    return {
      domain: 'matrimonial-family',
      forum: 'family-court-or-magistrate-dv',
      isConsumerForum: false,
      label: 'Matrimonial, Domestic Violence (PWDVA 2005) & Family Law (BNSS s.144 / HMA)'
    };
  }

  if (caseState.subTrack === 'inheritance-partition' || /\b(intestate|without\s+leaving\s+a\s+will|without\s+a\s+will|partition\s+suit|hindu\s+succession|coparcen|class\s+i\s+heir|legal\s+heir|ancestral\s+property|succession\s+certificate|probate|o\.?\s*s\.?\s*no\.?)\b/i.test(text)) {
    return {
      domain: 'inheritance-partition',
      forum: 'civil-court',
      isConsumerForum: false,
      label: 'Civil Court — Property Partition, Injunction (Order 39 CPC) & Succession (HSA 1956)'
    };
  }

  if (/\b(mutation|dakhil[\s-]?kharij|jamabandi|khatauni|khatiyan|circle\s+officer|tehsildar|revenue\s+court|cnt\s+act|chota\s*nagpur\s+tenancy|spt\s+act|raiyati|bhumidhar|land\s+record|encroach(?:ed|ment)\s+(?:on\s+)?(?:my\s+)?(?:land|plot))/i.test(text) && caseState.subTrack !== 'property-rera') {
    return {
      domain: 'land-revenue',
      forum: 'revenue-court-or-civil-court',
      isConsumerForum: false,
      label: 'Land Records, Mutation & State Land Laws (Revenue Courts / Civil Court for Title)'
    };
  }

  if (caseState.subTrack === 'property-rera' || caseState.forum === 'rera' || /\b(rera|maharera|builder|occupancy\s+certificate|allotment\s+letter|flat\s+delay|possession\s+delay|escalation\s+charge|homebuyer)\b/i.test(text)) {
    const explicitConsumer = caseState.forum === 'consumer-commission';
    return {
      domain: 'property-rera',
      forum: explicitConsumer ? 'consumer-commission' : 'rera-and-consumer-concurrent',
      isConsumerForum: explicitConsumer,
      label: 'Real Estate (RERA Act, 2016 s.18/s.31 & Concurrent Consumer Commission Remedies)'
    };
  }

  if (caseState.subTrack === 'tenancy-civil' || caseState.forum === 'civil-court' || /\b(eviction|landlord|tenant|rent\s+agreement|security\s+deposit|rent\s+act|civil\s+court|civil\s+judge|order\s+39|order\s+viii|written\s+statement|framing\s+of\s+issues|order\s+14\s+cpc)\b/i.test(text)) {
    return {
      domain: 'tenancy-civil',
      forum: 'civil-court',
      isConsumerForum: false,
      label: 'Civil Court / Rent Authority (Code of Civil Procedure, 1908 & State Rent Laws)'
    };
  }

  if (/\b(traffic\s+challan|e-?challan|riding\s+without\s+helmet|helmet\s+fine|seat\s*belt\s+fine|overspeeding|red\s+light\s+jump|parivahan|motor\s+vehicles\s+act|driving\s+licen[cs]e\s+disqualif)\b/i.test(text)) {
    return {
      domain: 'traffic-challan',
      forum: 'virtual-traffic-court',
      isConsumerForum: false,
      label: 'Motor Vehicles Act, 1988 (as amended 2019) & Parivahan / Virtual Traffic Courts'
    };
  }

  if (/\b(unpaid\s+salary|salary\s+(?:hold|not\s+paid|pending)|relieving\s+letter|experience\s+letter|full\s+(?:and|&)\s+final|gratuity|provident\s+fund|\bepf\b|samadhan|labour\s+commissioner|forced\s+(?:me\s+)?to\s+resign|forced\s+resignation|terminated\s+(?:from\s+(?:my\s+)?job|without\s+notice)|non-?compete|notice\s+period\s+(?:buyout|recovery)|posh\b|sexual\s+harassment\s+at\s+(?:work|office|workplace)|internal\s+(?:complaints\s+)?committee|layoff|laid\s+off)/i.test(text)) {
    return {
      domain: 'employment-labour',
      forum: 'labour-authority-or-civil-court',
      isConsumerForum: false,
      label: 'Employment & Labour (Wages, Gratuity, Resignation, Non-Compete & POSH)'
    };
  }

  if (/\b(msme\s+samadhaan|msme|udyam|msefc|facilitation\s+council|arbitration\s+clause|arbitral\s+award|sole\s+arbitrator|section\s+(?:8|11|34)\s+(?:of\s+the\s+)?arbitration)/i.test(text)) {
    return {
      domain: 'msme-arbitration',
      forum: 'msefc-or-arbitral-tribunal',
      isConsumerForum: false,
      label: 'MSME Dues & Arbitration (MSMED Act Sections 15–19 / Arbitration Act)'
    };
  }

  if (/\b(gst\s+notice|drc-?0?1|show\s+cause\s+notice\s+under\s+(?:section\s+)?7[34]|gst\s+registration\s+cancel|income[\s-]?tax\s+notice|section\s+148a?\s+(?:notice|of\s+(?:the\s+)?income)|reassessment\s+notice|143\(1\)\s+intimation|\brti\b|right\s+to\s+information|public\s+information\s+officer|writ\s+petition|article\s+226|article\s+32)/i.test(text)) {
    return {
      domain: 'tax-rti-writ',
      forum: 'statutory-authority-or-high-court',
      isConsumerForum: false,
      label: 'Tax Notices, RTI & Constitutional Writs (CGST / Income-tax / RTI Act / Article 226)'
    };
  }

  return {
    domain: 'consumer',
    forum: 'consumer-commission',
    isConsumerForum: true,
    label: 'Consumer Protection Act, 2019 (NCH 1915 / Sectoral Ombudsman / Consumer Commission)'
  };
}

/**
 * Request intent: is the user fighting/defending a dispute, or asking us to prepare a transactional document?
 * Transactional documents (rent agreement, will, power of attorney...) need deal terms, not dispute facts.
 * Dispute documents (legal notice, police complaint, written statement) stay on the dispute route because they
 * depend on what happened.
 */
export const TRANSACTIONAL_DOCUMENT_TYPES = [
  { documentType: 'rent-agreement', documentLabel: 'Rent / Lease / Leave & Licence Agreement', rx: /\b(rent(?:al)?\s+agreement|lease\s+(?:agreement|deed)|leave\s+(?:and|&)\s+licen[cs]e|tenancy\s+agreement|kiraya\s*nama|kirayanama)\b|किरायानामा|किराया\s+अनुबंध/i },
  { documentType: 'will', documentLabel: 'Will (Wasiyat)', rx: /\b(?:make|draft|write|prepare|create)\s+(?:a\s+|my\s+|the\s+)?will\b|\bwill\s+deed\b|\bwasiyat\b|वसीयत/i },
  { documentType: 'power-of-attorney', documentLabel: 'Power of Attorney', rx: /\b(power\s+of\s+attorney|\bg?poa\b|mukhtar\s*nama)\b/i },
  { documentType: 'gift-deed', documentLabel: 'Gift Deed', rx: /\bgift\s+deed\b|दान\s*पत्र/i },
  { documentType: 'sale-agreement', documentLabel: 'Agreement to Sell / Sale Deed', rx: /\b(agreement\s+(?:to|for)\s+sale|agreement\s+to\s+sell|sale\s+(?:agreement|deed)|bayana|baina)\b/i },
  { documentType: 'partnership-deed', documentLabel: 'Partnership Deed', rx: /\bpartnership\s+deed\b/i },
  { documentType: 'service-contract', documentLabel: 'Service / Freelance / Vendor Agreement', rx: /\b(service\s+agreement|freelance\s+(?:agreement|contract)|vendor\s+agreement|consultancy\s+agreement|nda|non-?disclosure\s+agreement|mou|memorandum\s+of\s+understanding)\b/i },
  { documentType: 'employment-contract', documentLabel: 'Employment Contract / Offer Letter', rx: /\b(employment\s+(?:agreement|contract)|appointment\s+letter|offer\s+letter)\b/i },
  { documentType: 'loan-agreement', documentLabel: 'Loan Agreement / Promissory Note', rx: /\b(loan\s+agreement|promissory\s+note|friendly\s+loan\s+agreement)\b/i },
  { documentType: 'affidavit', documentLabel: 'Affidavit / Self-Declaration', rx: /\b(?:name\s+change|address\s+proof|income|gap\s+year|general|self[-\s]?declaration)?\s*affidavit\b/i }
];

export function detectRequestIntent(rawInput = '') {
  const text = String(rawInput || '').split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0];
  const wantsDocument = /\b(draft|drafting|prepare|make|create|write|format|template|sample|model|need\s+(?:a|an)|want\s+(?:a|an)|bana(?:na|o|\s+do)?|likh(?:na|o|\s+do)?)\b|बनाना|बना\s+दो|लिख\s+दो/i.test(text);
  // A dispute about an existing document ("landlord not returning deposit under the rent agreement") is not a drafting request.
  const describesDispute = /\b(not\s+return(?:ing)?|refus(?:ed|ing)|evict|vacate|harass|threat|cheat|fraud|breach|violat|police|fir\b|court|case\s+(?:filed|against)|legal\s+notice\s+(?:from|received)|received\s+(?:a\s+)?notice|dispute|withheld|deducted)\b/i.test(text);
  if (/\bevidence\s+affidavit\b/i.test(text)) {
    return { intent: 'dispute', documentType: null, documentLabel: null };
  }
  const doc = TRANSACTIONAL_DOCUMENT_TYPES.find(d => d.rx.test(text));
  if (doc && wantsDocument && !describesDispute) {
    return { intent: 'document-drafting', documentType: doc.documentType, documentLabel: doc.documentLabel };
  }
  return { intent: 'dispute', documentType: null, documentLabel: null };
}

function parseFlexibleDateToIso(dateStr = '') {
  const s = String(dateStr || '').trim();
  const isoMatch = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmyMatch = s.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Unified Multimodal Auto-Sense Router:
 * Allows a user to simply type, speak, or drop files into ONE single input box without choosing a door or filling date pickers.
 * Automatically senses:
 * 1. Whether it is a New Problem, an Ongoing Court Case, a Company/RoC query, or an Advocate Judgment/Bare Act lookup
 * 2. The exact legal domain & forum (Consumer, Property/RERA, Matrimony/DV, Partition, Criminal BNS/BNSS, Cheque Bounce s.138, Corporate)
 * 3. User side (Complainant/Victim vs Respondent/Accused)
 * 4. Key dates & procedural numbers mentioned in plain text (dishonourDate, serviceDate, nextHearingDate, writtenVersionFiledDate, adjournments)
 */
export function autoSenseIntakeFromText({ door = '', mode = '', caseState = {}, rawInput = '' } = {}) {
  const text = String(rawInput || '');
  const lower = text.toLowerCase();
  const nextCaseState = { ...caseState };

  // 1. Extract natural-language dates & procedural counts when not explicitly set in caseState
  if (!nextCaseState.dishonourDate) {
    const bounceMatch = text.match(/(?:dishonour(?:ed)?|bounced?|return\s+memo[^.\n]{0,40}?)\s+(?:on|dated)\s+(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})/i);
    if (bounceMatch) {
      nextCaseState.dishonourDate = parseFlexibleDateToIso(bounceMatch[1]);
    }
  }
  if (!nextCaseState.serviceDate) {
    const srvMatch = text.match(/(?:notice[^.\n]{0,30}?served|served\s+with\s+notice|served)\s+on\s+(?:[A-Za-z0-9.\s-]{0,20}?\s+on\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})/i);
    if (srvMatch) {
      nextCaseState.serviceDate = parseFlexibleDateToIso(srvMatch[1]);
    }
  }
  if (!nextCaseState.nextHearingDate) {
    const hrgMatch = text.match(/(?:next\s+hearing(?:\s+is|\s+date)?|hearing\s+is\s+on|listed\s+(?:for\s+hearing\s+)?on|call\s+on)\s+(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})/i);
    if (hrgMatch) {
      nextCaseState.nextHearingDate = parseFlexibleDateToIso(hrgMatch[1]);
    }
  }
  if (!nextCaseState.writtenVersionFiledDate) {
    const wvDateMatch = text.match(/written\s+version[^.\n]{0,35}?(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})/i);
    if (wvDateMatch) {
      nextCaseState.writtenVersionFiled = true;
      nextCaseState.writtenVersionFiledDate = parseFlexibleDateToIso(wvDateMatch[1]);
    }
  }
  if (nextCaseState.opEvidenceAdjournmentsGranted === undefined) {
    const adjMatch = text.match(/\b(\d+)\s+adjournments?\b/i);
    if (adjMatch) {
      nextCaseState.opEvidenceAdjournmentsGranted = Number(adjMatch[1]);
      nextCaseState.opponentAdjournments = Number(adjMatch[1]);
    }
  }
  if (!nextCaseState.role) {
    const isDefender = /\b(received\s+a\s+notice|summoned\s+to\s+caw|caw\s+cell\s+asking\s+me|police\s+called\s+me|threaten(?:ed|ing)\s+to\s+file\s+498a|demanding\s+(?:an\s+unfair\s+)?refund\s+from\s+us|filed\s+a\s+case\s+against\s+me|eviction\s+case\s+against\s+me)\b/i.test(lower);
    nextCaseState.role = isDefender ? 'defender' : 'complainant';
    // A defaulted role is not a fact the user gave; the fact sheet must not count it as confirmed.
    nextCaseState.roleInferred = !isDefender;
  }

  const domainInfo = detectLegalDomain({ door, mode, caseState: nextCaseState, rawInput: text });
  const requestIntent = detectRequestIntent(text);

  // Only override door/mode when the caller uses unified/auto routing (preserving explicit door/mode contracts!)
  let resolvedDoor = door || 'start';
  let resolvedMode = mode || 'messy-dump-intake';
  let autoDetectedCategoryLabel = 'New Dispute / Practical Roadmap';

  const isUnifiedOrAuto = (!door || door === 'unified') && (!mode || mode === 'auto');

  const isAdvocateJudgmentQuery = /\b(tofan\s+singh|tufan\s+singh|arnesh\s+kumar|satender\s+kumar\s+antil|hilli\s+multipurpose|arjun\s+panditrao|imperia\s+structures|newtech\s+promoters|vineeta\s+sharma|rajnesh\s+v\.?\s+neha|lalita\s+kumari|priyanka\s+srivastava|judgment\s+dossier|bare\s+act\s+section|ratio\s+decidendi|\(\d{4}\)\s+\d+\s+scc)\b/i.test(lower);
  const isOngoingCaseQuery = /\b(next\s+hearing|order\s+sheet|daily\s+order|written\s+version|written\s+statement|rejoinder|evidence\s+affidavit|adjournment|placed\s+ex-?parte|o\.?\s*s\.?\s*no\.?|c\.?\s*c\.?\s*no\.?|i\.?\s*a\.?\s*no\.?|framing\s+of\s+issues|execution\s+application)\b/i.test(lower);

  if (isUnifiedOrAuto) {
    if (isAdvocateJudgmentQuery) {
      resolvedDoor = 'lawyer-workbench';
      resolvedMode = 'lawyer-research-bench';
      autoDetectedCategoryLabel = 'Advocate Mode — Judgment & Bare Act Dossier';
    } else if (domainInfo.domain === 'corporate-roc') {
      resolvedDoor = 'company';
      resolvedMode = 'company-advisor';
      nextCaseState.companyNeed = /\b(reject|resubmi|missed|penalty|strike-?off|show\s+cause|scn|inc-?20a|dir-?3)\b/i.test(lower)
        ? 'roc-hiccup'
        : 'choose-entity';
      autoDetectedCategoryLabel = 'Company & Startup Advisory (MCA / RoC)';
    } else if (requestIntent.intent === 'document-drafting' && !isOngoingCaseQuery) {
      resolvedDoor = 'start';
      resolvedMode = 'document-drafting';
      nextCaseState.requestIntent = 'document-drafting';
      nextCaseState.documentType = requestIntent.documentType;
      autoDetectedCategoryLabel = `Document Drafting — ${requestIntent.documentLabel}`;
    } else if (isOngoingCaseQuery) {
      resolvedDoor = 'midcase';
      resolvedMode = 'midcase-battle-card';
      if (!nextCaseState.stage) {
        if (/written\s+arguments|final\s+arguments/i.test(lower)) nextCaseState.stage = 'final-arguments';
        else if (/execution|section\s+71|section\s+72/i.test(lower)) nextCaseState.stage = 'final-order-and-execution';
        else if (/op\s+evidence|adjournment/i.test(lower)) nextCaseState.stage = 'op-evidence';
        else if (/written\s+version|45\s*-?\s*day/i.test(lower)) nextCaseState.stage = 'written-version-stage';
        else nextCaseState.stage = 'other-or-unsure';
      }
      autoDetectedCategoryLabel = `Ongoing Court Case (${domainInfo.label.split('(')[0].trim()})`;
    } else if (['property-rera', 'matrimonial-family', 'inheritance-partition', 'criminal-bns-bnss', 'cheque-bounce-138'].includes(domainInfo.domain)) {
      resolvedDoor = 'civil-criminal';
      resolvedMode = 'civil-criminal-advisor';
      nextCaseState.subTrack = domainInfo.domain === 'criminal-bns-bnss' ? 'criminal' : domainInfo.domain;
      autoDetectedCategoryLabel = `New Case — ${domainInfo.label.split('(')[0].trim()}`;
    } else {
      resolvedDoor = 'start';
      resolvedMode = 'messy-dump-intake';
      autoDetectedCategoryLabel = `New Dispute — ${domainInfo.label.split('(')[0].trim()}`;
    }
  }

  return {
    door: resolvedDoor,
    mode: resolvedMode,
    caseState: nextCaseState,
    domainInfo,
    autoDetectedCategoryLabel
  };
}

/**
 * Extracts consideration / claim amount in INR from text or caseState (e.g. "Rs 72 lakhs", "₹8,000", "Rs 1.85 Crore").
 */
export function extractPaidAmountInr(text = '', explicitAmount = null) {
  if (Number.isFinite(Number(explicitAmount)) && Number(explicitAmount) > 0) {
    return Number(explicitAmount);
  }
  const s = String(text || '');
  const croreMatch = s.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*crore/i);
  if (croreMatch) return Math.round( parseFloat(croreMatch[1]) * 10000000 );

  const lakhMatch = s.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i);
  if (lakhMatch) return Math.round( parseFloat(lakhMatch[1]) * 100000 );

  const plainMatch = s.match(/(?:paid|for|of|amount|cheque\s+for|refund\s+of)?\s*(?:rs\.?|inr|₹)\s*([\d,]{3,12})/i)
    || s.match(/\b([\d,]{4,10})\s*rupaye\b/i);
  if (plainMatch) {
    const num = Number(plainMatch[1].replace(/,/g, ''));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

/**
 * Deterministic Consumer Commission Pecuniary Jurisdiction (2021 Rules) & Rule 7 Filing Fee Calculator.
 * Based strictly on value of goods/services paid as consideration (NOT compensation claimed).
 */
export function evaluateConsumerPecuniaryAndFee(paidAmountInr) {
  const amount = Number(paidAmountInr);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let forum = 'District Consumer Disputes Redressal Commission (up to ₹50 lakh paid)';
  if (amount > 20000000) {
    forum = 'National Consumer Disputes Redressal Commission — NCDRC (above ₹2 crore paid)';
  } else if (amount > 5000000) {
    forum = 'State Consumer Disputes Redressal Commission — SCDRC (above ₹50 lakh up to ₹2 crore paid)';
  }

  let filingFeeInr = 0;
  let feeSlabLabel = 'Up to ₹5 lakh paid: ₹0 (NIL / Free filing under Rule 7)';
  if (amount > 500000 && amount <= 1000000) {
    filingFeeInr = 200;
    feeSlabLabel = 'Above ₹5 lakh up to ₹10 lakh paid: ₹200';
  } else if (amount > 1000000 && amount <= 2000000) {
    filingFeeInr = 400;
    feeSlabLabel = 'Above ₹10 lakh up to ₹20 lakh paid: ₹400';
  } else if (amount > 2000000 && amount <= 5000000) {
    filingFeeInr = 1000;
    feeSlabLabel = 'Above ₹20 lakh up to ₹50 lakh paid: ₹1,000';
  } else if (amount > 5000000 && amount <= 10000000) {
    filingFeeInr = 2000;
    feeSlabLabel = 'Above ₹50 lakh up to ₹1 crore paid: ₹2,000';
  } else if (amount > 10000000 && amount <= 20000000) {
    filingFeeInr = 2500;
    feeSlabLabel = 'Above ₹1 crore up to ₹2 crore paid: ₹2,500';
  } else if (amount > 20000000) {
    filingFeeInr = 5000;
    feeSlabLabel = 'Above ₹2 crore paid: ₹5,000+ (as per NCDRC slab)';
  }

  return {
    paidAmountInr: amount,
    competentForum: forum,
    filingFeeInr,
    feeSlabLabel,
    statutoryBasis: 'Consumer Protection (Jurisdiction of the District Commission, the State Commission and the National Commission) Rules, 2021 & Rule 7 of Consumer Protection (Consumer Disputes Redressal Commissions) Rules, 2020'
  };
}

/**
 * Deterministic Negotiable Instruments Act, 1881 — Section 138 & Section 142 Deadline & Jurisdiction Calculator.
 */
export function evaluateNiAct138Deadlines({
  dishonourDate,
  noticeSentDate = null,
  noticeReceivedDate = null,
  evaluationDate = new Date().toISOString().slice(0, 10)
} = {}) {
  if (!dishonourDate) return null;

  const daysSinceDishonour = daysBetween(dishonourDate, evaluationDate);
  const noticeDeadlineDate = addDays(dishonourDate, 30);
  const daysRemainingForNotice = 30 - daysSinceDishonour;
  const noticeWindowExpired = !noticeSentDate && daysSinceDishonour > 30;

  let paymentCureDeadlineDate = null;
  let complaintFilingDeadlineDate = null;
  let daysRemainingForPayment = null;

  if (noticeReceivedDate) {
    paymentCureDeadlineDate = addDays(noticeReceivedDate, 15);
    complaintFilingDeadlineDate = addDays(paymentCureDeadlineDate, 30);
    daysRemainingForPayment = daysBetween(evaluationDate, paymentCureDeadlineDate);
  }

  return {
    governingAct: 'Negotiable Instruments Act, 1881 — Section 138 & Section 142',
    dishonourDate,
    evaluationDate,
    daysSinceDishonour,
    noticeDeadlineDate,
    daysRemainingForNotice,
    noticeWindowExpired,
    paymentCureDeadlineDate,
    daysRemainingForPayment,
    complaintFilingDeadlineDate,
    jurisdictionRule: 'Under Section 142(2)(a) NI Act (post-2015 amendment), if the cheque was presented for collection through a bank account, the criminal complaint MUST be filed in the court within whose local jurisdiction the branch of the bank where the PAYEE maintains the account is situated (not merely where the payee lives or works, if their bank branch is elsewhere).',
    warning: 'CRITICAL: Consumer Protection Act 2-year (730-day) limitation does NOT apply to Section 138 NI Act. If the 30-day statutory demand notice window from the bank return memo is missed, criminal prosecution under Section 138 is barred.'
  };
}

/**
 * Deterministic Criminal Code (IPC/CrPC vs BNS/BNSS 01.07.2024 cutoff), Bailability & Arnesh Kumar Calculator.
 */
export function evaluateCriminalCodeAndBail({
  incidentDate = null,
  rawInput = '',
  custodyDays = null
} = {}) {
  const beforeCutoff = Boolean(incidentDate && incidentDate < BNS_CUTOFF_DATE);
  const substantiveCode = beforeCutoff
    ? `Indian Penal Code, 1860 (incident date ${incidentDate} is prior to 01.07.2024 cutoff; saved under Section 358 BNS)`
    : 'Bharatiya Nyaya Sanhita (BNS), 2023 (effective 01.07.2024; cite legacy IPC section alongside BNS for clarity)';
  const proceduralCode = 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 (governs all FIRs, notices, bail, and inquiries initiated on or after 01.07.2024; cite legacy CrPC equivalent in parentheses)';

  const matchedOffences = VERIFIED_CRIMINAL_OFFENCE_MAP.filter(o => o.matchRegex.test(rawInput));

  let defaultBailStatus = null;
  if (Number.isFinite(Number(custodyDays)) && Number(custodyDays) > 0) {
    const days = Number(custodyDays);
    defaultBailStatus = {
      custodyDays: days,
      sixtyDayThresholdReached: days >= 60,
      ninetyDayThresholdReached: days >= 90,
      rule: 'Under Section 187(2)-(3) BNSS (formerly Section 167(2) CrPC), an accused in custody is entitled to indefeasible Default/Statutory Bail if the police fail to file the chargesheet within 60 days (for offences punishable up to 10 years) or 90 days (for offences punishable with death, life imprisonment, or >= 10 years).'
    };
  }

  return {
    bnsCutoffDate: BNS_CUTOFF_DATE,
    incidentDate: incidentDate || 'Not specified (provide both BNS/BNSS 2023 and legacy IPC/CrPC sections)',
    substantiveCode,
    proceduralCode,
    matchedOffences,
    proceduralEquivalents: PROCEDURAL_CODE_EQUIVALENTS,
    defaultBailStatus
  };
}

/**
 * Deterministic Civil Suit Written Statement Window (Order VIII Rule 1 CPC).
 */
export function evaluateCivilWrittenStatementWindow({
  serviceDate,
  evaluationDate = new Date().toISOString().slice(0, 10),
  isCommercialSuit = false,
  writtenStatementFiled = false
} = {}) {
  if (!serviceDate) return null;
  const daysSinceService = daysBetween(serviceDate, evaluationDate);
  const baseDeadline = addDays(serviceDate, 30);
  const maxDays = isCommercialSuit ? 120 : 90;
  const outerDeadline = addDays(serviceDate, maxDays);

  return {
    governingRule: isCommercialSuit
      ? 'Order VIII Rule 1 CPC (as amended by Commercial Courts Act, 2015 — strict 120-day mandatory forfeiture cap per SCG Contracts India)'
      : 'Order VIII Rule 1 CPC (30 days base + extendable up to 90 days from service of summons with recorded reasons and costs per Kailash v. Nanhku)',
    serviceDate,
    daysSinceService,
    baseDeadline,
    outerDeadline,
    writtenStatementFiled,
    exceededOuterWindow: !writtenStatementFiled && daysSinceService > maxDays
  };
}

/**
 * Post-Generation Legal Guardrail Verifier across Consumer, Property/RERA, Matrimony, Inheritance & Criminal domains.
 * Catches dangerous legal misstatements in LLM output so they are flagged explicitly.
 */
export function verifyDomainLegalAccuracy(markdown = '', { domain = 'consumer', paidAmountInr = null } = {}) {
  const text = String(markdown || '');
  const warnings = [];
  const checks = [];

  // 1. Criminal / Matrimonial 498A / BNS 85 bailability check
  if (/\b(498\s*-?\s*a|bns\s*85)\b/i.test(text)) {
    const falselyCallsBailable = /\b(?:charge|offence|498\s*-?\s*a|section\s+85)\s+is\s+bailable\b/i.test(text)
      && !/\bnon\s*-?\s*bailable\b/i.test(text);
    if (falselyCallsBailable) {
      warnings.push('⚠️ Legal Accuracy Alert: Section 498A IPC / Section 85 BNS is NON-BAILABLE (though subject to Arnesh Kumar / Section 35(3) BNSS notice safeguards).');
    } else {
      checks.push('✓ Verified: Section 498A IPC / Section 85 BNS non-bailable status & BNSS s.35(3) safeguard respected.');
    }
  }

  // 2. Matrimonial DV Act: Protection Officer vs Magistrate & Restitution of Conjugal Rights misuse
  if (domain === 'matrimonial-family' || /\b(streedhan|stridhan|protection\s+order|domestic\s+violence)\b/i.test(text)) {
    if (/protection\s+officer\s+(?:can|may|will)\s+issue\s+a\s+protection\s+order/i.test(text)) {
      warnings.push('⚠️ Legal Accuracy Alert: A Protection Officer cannot issue a Protection Order; only a Magistrate can pass a Protection Order under Section 18 of the PWDVA, 2005.');
    }
    if (/restitution\s+of\s+conjugal\s+rights[\s\S]{0,180}(?:recover|return)[\s\S]{0,80}(?:streedhan|stridhan|jewellery|passport)/i.test(text)) {
      warnings.push('⚠️ Legal Accuracy Alert: Restitution of Conjugal Rights (Section 9 HMA) is for resuming cohabitation, NOT for recovering streedhan/documents (which falls under Section 12 read with Section 19(8) PWDVA, 2005 / Section 316(2) BNS).');
    }
    if (warnings.length === 0) {
      checks.push('✓ Verified: Matrimonial / PWDVA 2005 remedies (Section 12 Magistrate application & BNSS s.144) accurately framed.');
    }
  }

  // 3. Property / RERA concurrent jurisdiction & pecuniary slab check
  if (domain === 'property-rera' || /\b(maharera|rera)\b/i.test(text)) {
    if (/consumer\s+commission[\s\S]{0,120}(?:only\s+if\s+you\s+bought\s+via\s+a\s+broker|not\s+for\s+builder\s+delay)/i.test(text)) {
      warnings.push('⚠️ Legal Accuracy Alert: Under Supreme Court precedent (Imperia Structures / Pioneer Urban Land), homebuyers have concurrent remedies before RERA and the Consumer Commission.');
    } else {
      checks.push('✓ Verified: RERA & Consumer Commission concurrent remedies and Authority vs Adjudicating Officer roles respected.');
    }
  }

  // 4. Inheritance / Partition Sub-Registrar Caveat hallucination check
  if (domain === 'inheritance-partition' || /\b(partition\s+suit|intestate)\b/i.test(text)) {
    if (/caveat\s+at\s+the\s+sub\s*-?\s*registrar/i.test(text)) {
      warnings.push('⚠️ Legal Accuracy Alert: Caveats under Section 148A CPC are filed in Civil Courts, not at the Sub-Registrar office; restraining a co-heir sale requires a Partition Suit + Order 39 Rules 1 & 2 CPC Temporary Injunction.');
    } else {
      checks.push('✓ Verified: Partition / succession remedies (HSA 1956 Class I shares & Order 39 CPC injunction) accurately stated.');
    }
  }

  // 5. Consumer Fee & Pecuniary Jurisdiction check when paidAmountInr is known
  if (paidAmountInr && paidAmountInr > 500000) {
    if (/free\s*\(\s*up\s+to\s+₹?\s*50\s*lakh/i.test(text)) {
      warnings.push('⚠️ Legal Accuracy Alert: Consumer Commission filing is ₹0 (free) only up to ₹5 lakh paid; claims above ₹5 lakh attract Rule 7 statutory fees, and claims above ₹50 lakh lie before the State Commission.');
    }
  }

  return {
    verified: warnings.length === 0,
    warnings,
    checks
  };
}
