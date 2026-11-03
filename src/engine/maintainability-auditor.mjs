/**
 * Senior-Counsel Threshold Engine (Stages 2 & 3 of the Nyaya v3.0 Spec)
 *
 * Runs BEFORE any merits advice is generated, the way a senior advocate checks a brief:
 *  1. Will the matter survive the front door? (Section 9 CPC civil-court ousters, hard limitation ceilings,
 *     arbitration-clause overrides)
 *  2. Is the case on paper, or only oral? Did the client sign or send something damaging? (paper trail / self-goals)
 *  3. Which forum should be ELECTED? (mutually exclusive vs cumulative remedies, interim power, execution teeth)
 *  4. Which State's local laws are in play? (3D jurisdiction: domain x state x forum)
 *
 * Deterministic and data-driven: every rule is a row in a table below, so adding a statute is a data change,
 * not new branching logic. Each row carries a `verifyNote` where state amendments or recent case law can shift
 * the position, so the advice never overstates certainty.
 */

import { daysBetween } from './consumer-rules.mjs';

/**
 * Section 9 CPC — statutory bars on civil-court jurisdiction.
 * Test: Dhulabhai v. State of M.P., AIR 1969 SC 78 (7-Judge Bench). Even where a bar exists, a civil suit can lie
 * where the statutory authority acted wholly without jurisdiction, violated fundamental judicial procedure, or the
 * claim is founded on fraud the tribunal cannot try (Mardia Chemicals v. Union of India, (2004) 4 SCC 311, para 51).
 */
export const CIVIL_COURT_OUSTER_MATRIX = [
  {
    id: 'sarfaesi-s34',
    family: 'Banking & Insolvency',
    statute: 'SARFAESI Act, 2002',
    section: 'Section 34',
    triggerRegex: /\b(sarfaesi|13\s*\(\s*2\s*\)\s*notice|13\s*\(\s*4\s*\)|symbolic\s+possession|physical\s+possession\s+notice|bank\s+auction|e-?auction\s+of\s+(?:my|our)\s+(?:house|flat|property)|secured\s+creditor)\b/i,
    exclusiveForum: 'Debts Recovery Tribunal — Securitisation Application under Section 17 within 45 days of the Section 13(4) measure',
    exception: 'Civil suit survives only where the claim is founded on fraud the DRT cannot adjudicate, or the relief is outside the DRT\'s domain (Mardia Chemicals, para 51).'
  },
  {
    id: 'rdb-s18',
    family: 'Banking & Insolvency',
    statute: 'Recovery of Debts and Bankruptcy Act, 1993',
    section: 'Section 18',
    triggerRegex: /\b(drt\b|debts?\s+recovery\s+tribunal|original\s+application\s+by\s+(?:the\s+)?bank|bank\s+(?:filed|has\s+filed)\s+(?:an\s+)?o\.?a\.?)\b/i,
    exclusiveForum: 'Debts Recovery Tribunal (for bank/FI debts of ₹20 lakh and above)',
    exception: 'Below the pecuniary threshold, ordinary civil/commercial courts retain jurisdiction.'
  },
  {
    id: 'ibc-s63-s231',
    family: 'Banking & Insolvency',
    statute: 'Insolvency and Bankruptcy Code, 2016',
    section: 'Sections 63 & 231 (with Section 14 moratorium)',
    triggerRegex: /\b(ibc\b|insolvency|cirp|resolution\s+professional|nclt\s+admitted|moratorium\s+under\s+section\s+14|liquidat)/i,
    exclusiveForum: 'NCLT / NCLAT (corporate debtors); civil proceedings against the corporate debtor are stayed during the Section 14 moratorium',
    exception: 'Personal guarantor and criminal proceedings follow separate rules; check the stage of the CIRP.'
  },
  {
    id: 'rera-s79',
    family: 'Real Estate, Land & Tenancy',
    statute: 'Real Estate (Regulation and Development) Act, 2016',
    section: 'Section 79',
    triggerRegex: /\b(rera|maharera|builder|promoter|possession\s+delay|flat\s+delay|allotment\s+letter|occupancy\s+certificate)\b/i,
    exclusiveForum: 'RERA Authority / Adjudicating Officer (Consumer Commission remains a concurrent option — Imperia Structures v. Anil Patni, (2020) 10 SCC 783)',
    exception: 'Title and partition disputes between private parties remain with the civil court.'
  },
  {
    id: 'state-land-revenue',
    family: 'Real Estate, Land & Tenancy',
    statute: 'State Land Revenue / Tenancy Codes (e.g., Chota Nagpur Tenancy Act 1908, U.P. Revenue Code 2006, Delhi Land Reforms Act 1954)',
    section: 'State-specific bar-of-suit provisions',
    triggerRegex: /\b(mutation|dakhil[\s-]?kharij|jamabandi|khatauni|khatiyan|revenue\s+court|tehsildar|circle\s+officer|cnt\s+act|chota\s*nagpur\s+tenancy|spt\s+act|bhumidhar|land\s+revenue|raiyat|adivasi\s+land|tribal\s+land)\b/i,
    exclusiveForum: 'Revenue Courts / Circle Officer / SDO / Deputy Commissioner under the State code',
    exception: 'Mutation entries are fiscal records and do not decide title (Sawarni v. Inder Kaur, (1996) 6 SCC 223); declaration of title still lies in the civil court.',
    verifyNote: 'The exact bar-of-suit section differs by State; confirm the local code before filing.'
  },
  {
    id: 'rent-control',
    family: 'Real Estate, Land & Tenancy',
    statute: 'State Rent Control Acts / Model Tenancy-based State Acts',
    section: 'State-specific exclusive-jurisdiction provisions',
    triggerRegex: /\b(rent\s+control|rent\s+controller|rent\s+authority|eviction\s+of\s+(?:a\s+)?tenant|tenant\s+(?:is\s+)?not\s+vacating|landlord\s+(?:is\s+)?evicting)\b/i,
    exclusiveForum: 'Rent Controller / Rent Authority / Rent Tribunal where the premises are covered by the State Act',
    exception: 'Premises outside the Act (e.g., above a rent threshold or newly constructed exemptions) go to the civil court.',
    verifyNote: 'Coverage thresholds and exemptions vary by State and city.'
  },
  {
    id: 'waqf-s85',
    family: 'Real Estate, Land & Tenancy',
    statute: 'Waqf Act, 1995',
    section: 'Section 85',
    triggerRegex: /\bwaqf\b/i,
    exclusiveForum: 'Waqf Tribunal',
    exception: 'Disputes not requiring determination under the Waqf Act may still lie in civil court.'
  },
  {
    id: 'public-premises-s15',
    family: 'Real Estate, Land & Tenancy',
    statute: 'Public Premises (Eviction of Unauthorised Occupants) Act, 1971',
    section: 'Section 15',
    triggerRegex: /\b(public\s+premises|estate\s+officer|government\s+quarter|railway\s+quarter|psu\s+quarter)\b/i,
    exclusiveForum: 'Estate Officer, with appeal to the District Judge'
  },
  {
    id: 'rfctlarr-s63',
    family: 'Real Estate, Land & Tenancy',
    statute: 'Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013',
    section: 'Section 63',
    triggerRegex: /\b(land\s+acquisition|acquisition\s+compensation|rfctlarr|enhancement\s+of\s+compensation|lara)\b/i,
    exclusiveForum: 'Land Acquisition, Rehabilitation and Resettlement Authority'
  },
  {
    id: 'cooperative-societies',
    family: 'Real Estate, Land & Tenancy',
    statute: 'State Co-operative Societies Acts',
    section: 'State-specific bar-of-suit provisions',
    triggerRegex: /\b(co-?operative\s+(?:housing\s+)?society|housing\s+society\s+(?:committee|secretary)|society\s+registrar|co-?op\s+court)\b/i,
    exclusiveForum: 'Registrar of Co-operative Societies / Co-operative Court',
    verifyNote: 'Section number and scope of the bar vary by State.'
  },
  {
    id: 'companies-s430',
    family: 'Corporate, Markets & Competition',
    statute: 'Companies Act, 2013',
    section: 'Section 430',
    triggerRegex: /\b(oppression\s+and\s+mismanagement|oppression|mismanagement|section\s+241|shareholder\s+dispute|minority\s+shareholder|rectification\s+of\s+register|removed\s+as\s+director)\b/i,
    exclusiveForum: 'NCLT / NCLAT'
  },
  {
    id: 'sebi-s20a',
    family: 'Corporate, Markets & Competition',
    statute: 'SEBI Act, 1992',
    section: 'Sections 15Y & 20A',
    triggerRegex: /\b(sebi\s+order|securities\s+appellate\s+tribunal|\bsat\b|stock\s+broker\s+dispute|scores\s+complaint)\b/i,
    exclusiveForum: 'SEBI / Securities Appellate Tribunal (SCORES and stock-exchange arbitration for broker disputes)'
  },
  {
    id: 'competition-s61',
    family: 'Corporate, Markets & Competition',
    statute: 'Competition Act, 2002',
    section: 'Section 61',
    triggerRegex: /\b(competition\s+commission|\bcci\b|abuse\s+of\s+dominan|cartel|anti-?competitive)\b/i,
    exclusiveForum: 'Competition Commission of India / NCLAT'
  },
  {
    id: 'family-courts-s8',
    family: 'Family, Senior Citizens, Service & Labour',
    statute: 'Family Courts Act, 1984',
    section: 'Section 8',
    triggerRegex: /\b(divorce|judicial\s+separation|restitution\s+of\s+conjugal|custody\s+of\s+(?:my\s+)?child|guardianship|maintenance\s+petition|alimony)\b/i,
    exclusiveForum: 'Family Court (where one is established for the area)'
  },
  {
    id: 'senior-citizens-s27',
    family: 'Family, Senior Citizens, Service & Labour',
    statute: 'Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
    section: 'Section 27',
    triggerRegex: /\b(senior\s+citizen|elderly\s+parents?|old\s+(?:mother|father|parents)|son\s+(?:is\s+)?(?:not\s+)?(?:looking\s+after|harass|threw|evict)|parents?\s+maintenance|gift\s+deed\s+to\s+(?:my\s+)?(?:son|daughter))\b/i,
    exclusiveForum: 'Maintenance Tribunal (SDO) under Sections 4–5, and Section 23 for voiding a property transfer made on a condition of care',
    exception: 'Section 23(1) needs proof that the transfer was conditional on care (Sudesh Chhikara v. Ramti Devi, 2022; Urmila Dixit v. Sunil Sharan Dixit, 2025). Tribunal eviction orders cannot defeat a daughter-in-law\'s PWDVA residence right without balancing (S. Vanitha v. Deputy Commissioner, (2021) 15 SCC 730).'
  },
  {
    id: 'administrative-tribunals-s28',
    family: 'Family, Senior Citizens, Service & Labour',
    statute: 'Administrative Tribunals Act, 1985',
    section: 'Section 28',
    triggerRegex: /\b(government\s+(?:employee|servant|job)|central\s+government\s+service|promotion\s+denied|departmental\s+inquiry|suspended\s+from\s+(?:government\s+)?service|\bcat\b|central\s+administrative\s+tribunal)\b/i,
    exclusiveForum: 'Central / State Administrative Tribunal (then writ to the High Court per L. Chandra Kumar)'
  },
  {
    id: 'industrial-disputes',
    family: 'Family, Senior Citizens, Service & Labour',
    statute: 'Industrial Disputes Act, 1947 (and the Industrial Relations Code, 2020 when in force)',
    section: 'Premier Automobiles v. Kamlakar Shantaram Wadke, (1976) 1 SCC 496',
    triggerRegex: /\b(workman|retrenchment|illegal\s+termination\s+of\s+(?:a\s+)?worker|reinstatement|industrial\s+dispute|labour\s+court|factory\s+worker)\b/i,
    exclusiveForum: 'Conciliation Officer → Labour Court / Industrial Tribunal for rights created by the Act',
    exception: 'Managerial/supervisory employees outside the "workman" definition sue in civil court for contractual dues.'
  },
  {
    id: 'electricity-s145',
    family: 'Utilities, MACT, Tax & Environment',
    statute: 'Electricity Act, 2003',
    section: 'Section 145',
    triggerRegex: /\b(electricity\s+theft|section\s+126\s+assessment|unauthori[sz]ed\s+use\s+of\s+electricity|provisional\s+assessment|vigilance\s+(?:raid|team)\s+(?:of\s+)?(?:the\s+)?electricity|discom\s+penalty)\b/i,
    exclusiveForum: 'Assessing Officer / Appellate Authority under Sections 126–127 (billing disputes: CGRF and Electricity Ombudsman)'
  },
  {
    id: 'motor-vehicles-s175',
    family: 'Utilities, MACT, Tax & Environment',
    statute: 'Motor Vehicles Act, 1988',
    section: 'Section 175',
    triggerRegex: /\b(road\s+accident|motor\s+accident|accident\s+claim|mact\b|hit\s+and\s+run|run\s+over\s+by|vehicle\s+hit\s+(?:me|my)|died\s+in\s+(?:a\s+)?(?:road\s+)?accident)\b/i,
    exclusiveForum: 'Motor Accident Claims Tribunal'
  },
  {
    id: 'tax-s293-cgst-s162',
    family: 'Utilities, MACT, Tax & Environment',
    statute: 'Income-tax Act, 1961 / CGST Act, 2017',
    section: 'Section 293 (Income-tax) & Section 162 (CGST)',
    triggerRegex: /\b(income[\s-]?tax\s+notice|section\s+148a?\s+(?:notice|of\s+(?:the\s+)?income)|143\(1\)\s+intimation|reassessment\s+notice|gst\s+notice|drc-?0?1|show\s+cause\s+notice\s+under\s+(?:section\s+)?7[34]|gst\s+registration\s+cancel)/i,
    exclusiveForum: 'Statutory tax authorities and appellate hierarchy (writ under Article 226 for jurisdictional errors or breach of natural justice)'
  },
  {
    id: 'ngt-s29',
    family: 'Utilities, MACT, Tax & Environment',
    statute: 'National Green Tribunal Act, 2010',
    section: 'Section 29',
    triggerRegex: /\b(pollution|ngt\b|green\s+tribunal|effluent|environmental\s+clearance|illegal\s+mining)\b/i,
    exclusiveForum: 'National Green Tribunal (for substantial environmental questions under the scheduled Acts)'
  }
];

/**
 * Statutory clocks with an outer limit that a court or tribunal cannot extend.
 * `anchorKeys` lists caseState date fields that start the clock, in priority order.
 */
export const HARD_LIMITATION_CEILINGS = [
  {
    id: 'ni-act-138-notice',
    label: 'NI Act Section 138(b) demand notice',
    triggerRegex: /\b(cheque\s+bounc|dishonou?r|return\s+memo|section\s+138)\b/i,
    baseDays: 30,
    outerDays: 30,
    condonable: false,
    anchorKeys: ['dishonourDate'],
    rule: 'Demand notice must be sent within 30 days of receiving the bank return memo. A missed notice cannot be condoned; if the cheque is still within its validity, re-present it to start a fresh cycle, otherwise pursue a civil summary suit (Order 37 CPC).'
  },
  {
    id: 'consumer-written-version',
    label: 'Consumer Commission Written Version (Section 38(2)(a) CPA 2019)',
    triggerRegex: /\b(written\s+version|consumer\s+(?:commission|forum|court)\s+notice)\b/i,
    baseDays: 30,
    outerDays: 45,
    condonable: false,
    anchorKeys: ['serviceDate'],
    rule: '30 days + at most 15 more. No power to accept a reply after Day 45 (New India Assurance v. Hilli Multipurpose Cold Storage, (2020) 5 SCC 757, Constitution Bench).'
  },
  {
    id: 'commercial-written-statement',
    label: 'Commercial suit Written Statement (Order VIII Rule 1 CPC as amended)',
    triggerRegex: /\b(commercial\s+(?:suit|court|division)|commercial\s+dispute)\b/i,
    baseDays: 30,
    outerDays: 120,
    condonable: false,
    anchorKeys: ['serviceDate'],
    rule: 'Right to file the written statement is forfeited after 120 days from service of summons (SCG Contracts India v. K.S. Chamankar Infrastructure, (2019) 12 SCC 210).'
  },
  {
    id: 'arbitration-s34',
    label: 'Challenge to an arbitral award (Section 34(3) Arbitration Act)',
    triggerRegex: /\b(arbitral\s+award|award\s+(?:was\s+)?passed\s+by\s+(?:the\s+)?arbitrator|set\s+aside\s+(?:the\s+)?award|section\s+34\s+petition)\b/i,
    baseDays: 90,
    outerDays: 120,
    condonable: false,
    anchorKeys: ['awardReceivedDate', 'keyDate'],
    rule: '3 months from receipt of the signed award, plus at most 30 days on sufficient cause, "but not thereafter" (Union of India v. Popular Construction, (2001) 8 SCC 470).'
  },
  {
    id: 'sarfaesi-s17',
    label: 'Securitisation Application to the DRT (Section 17 SARFAESI)',
    triggerRegex: /\b(sarfaesi|13\s*\(\s*4\s*\)|symbolic\s+possession|possession\s+notice|bank\s+auction)\b/i,
    baseDays: 45,
    outerDays: 45,
    condonable: true,
    anchorKeys: ['possessionNoticeDate', 'keyDate'],
    rule: '45 days from the date the Section 13(4) measure is taken. The DRT can condone delay under Section 5 of the Limitation Act (Mardia Chemicals), but file inside 45 days to keep the auction-stay argument clean.'
  },
  {
    id: 'mact-s166-3',
    label: 'Motor accident compensation claim (Section 166(3) MV Act, 2019 amendment)',
    triggerRegex: /\b(road\s+accident|motor\s+accident|accident\s+claim|mact\b|hit\s+and\s+run)\b/i,
    baseDays: 183,
    outerDays: 183,
    condonable: false,
    anchorKeys: ['incidentDate', 'keyDate', 'causeOfActionDate'],
    rule: 'Claim must be filed within 6 months of the accident under the amended Section 166(3).',
    verifyNote: 'Several High Courts have read this provision down or are hearing challenges to it; file inside 6 months and verify the current position in your High Court.'
  },
  {
    id: 'posh-s9',
    label: 'POSH complaint to the Internal Committee (Section 9 POSH Act)',
    triggerRegex: /\b(posh|sexual\s+harassment\s+at\s+(?:work|office|workplace)|internal\s+(?:complaints\s+)?committee)\b/i,
    baseDays: 90,
    outerDays: 180,
    condonable: true,
    anchorKeys: ['incidentDate', 'keyDate'],
    rule: '3 months from the incident (or the last in a series), extendable by up to 3 more months for recorded reasons.'
  },
  {
    id: 'consumer-s69',
    label: 'Consumer complaint limitation (Section 69 CPA 2019)',
    triggerRegex: /\b(consumer|defective\s+product|deficiency\s+in\s+service|warranty)\b/i,
    baseDays: 730,
    outerDays: 730,
    condonable: true,
    anchorKeys: ['causeOfActionDate'],
    rule: '2 years from the cause of action; delay can be condoned on sufficient cause recorded by the Commission.'
  }
];

const ARBITRATION_CLAUSE_REGEX = /\b(arbitration\s+clause|arbitration\s+agreement|refer(?:red)?\s+to\s+arbitration|sole\s+arbitrator|arbitrator\s+(?:will|shall)\s+be\s+appointed|disputes?\s+shall\s+be\s+(?:settled|resolved)\s+by\s+arbitration|section\s+8\s+application)\b/i;
const UNILATERAL_ARBITRATOR_REGEX = /\b((?:company|bank|nbfc|lender|builder|developer|employer)\s+(?:will|shall|can|may)\s+(?:alone\s+)?appoint\s+(?:the\s+)?(?:sole\s+)?arbitrator|appointed\s+by\s+(?:the\s+)?(?:company|bank|nbfc|lender|builder|managing\s+director)|nominated\s+by\s+(?:the\s+)?(?:company|bank|lender|builder))\b/i;

/**
 * Indian States & UTs (with major cities) for 3D jurisdiction: Domain × State × Forum.
 */
const STATE_DIRECTORY = [
  { state: 'Jharkhand', rx: /\b(jharkhand|ranchi|jamshedpur|dhanbad|bokaro|hazaribagh|deoghar|giridih|dumka)\b/i, localLawNote: 'Chota Nagpur Tenancy Act 1908 / Santhal Pargana Tenancy Act 1949 restrict transfer of raiyati and tribal land.' },
  { state: 'Bihar', rx: /\b(bihar|patna|gaya|muzaffarpur|bhagalpur|darbhanga|purnia)\b/i, localLawNote: 'Bihar Land Mutation Act 2011 and Bihar Land Disputes Resolution Act 2009 provide fast-track revenue remedies.' },
  { state: 'Uttar Pradesh', rx: /\b(uttar\s+pradesh|\bu\.?p\.?\b|lucknow|kanpur|varanasi|banaras|prayagraj|allahabad|noida|ghaziabad|agra|meerut|gorakhpur)\b/i, localLawNote: 'U.P. Revenue Code 2006 governs bhumidhari land and mutation; U.P. Regulation of Urban Premises Tenancy Act 2021 governs rent.' },
  { state: 'Maharashtra', rx: /\b(maharashtra|mumbai|pune|nagpur|thane|nashik|aurangabad|navi\s+mumbai)\b/i, localLawNote: 'MahaRERA, Maharashtra Rent Control Act 1999 and MCS Act 1960 (housing societies).' },
  { state: 'Delhi', rx: /\b(delhi|new\s+delhi)\b/i, localLawNote: 'Delhi Rent Control Act 1958 and Delhi Land Reforms Act 1954.' },
  { state: 'Karnataka', rx: /\b(karnataka|bengaluru|bangalore|mysuru|mysore|mangaluru|hubli)\b/i, localLawNote: 'Karnataka Land Revenue Act 1964 and Karnataka Rent Act 1999.' },
  { state: 'Tamil Nadu', rx: /\b(tamil\s+nadu|chennai|coimbatore|madurai|trichy|salem)\b/i, localLawNote: 'Tamil Nadu Regulation of Rights and Responsibilities of Landlords and Tenants Act 2017.' },
  { state: 'Telangana', rx: /\b(telangana|hyderabad|secunderabad|warangal)\b/i, localLawNote: 'Telangana Rights in Land and Pattadar Pass Books Act 2020 (Dharani records).' },
  { state: 'West Bengal', rx: /\b(west\s+bengal|kolkata|calcutta|howrah|siliguri|durgapur)\b/i, localLawNote: 'West Bengal Premises Tenancy Act 1997 and West Bengal Land Reforms Act 1955.' },
  { state: 'Gujarat', rx: /\b(gujarat|ahmedabad|surat|vadodara|rajkot|gandhinagar)\b/i, localLawNote: 'Gujarat Land Grabbing (Prohibition) Act 2020 provides a special-court route.' },
  { state: 'Rajasthan', rx: /\b(rajasthan|jaipur|jodhpur|udaipur|kota|ajmer)\b/i, localLawNote: 'Rajasthan Tenancy Act 1955 and Rajasthan Land Revenue Act 1956.' },
  { state: 'Madhya Pradesh', rx: /\b(madhya\s+pradesh|bhopal|indore|gwalior|jabalpur)\b/i, localLawNote: 'M.P. Land Revenue Code 1959.' },
  { state: 'Haryana', rx: /\b(haryana|gurugram|gurgaon|faridabad|panipat|ambala)\b/i, localLawNote: 'Haryana Urban (Control of Rent and Eviction) Act 1973.' },
  { state: 'Punjab', rx: /\b(punjab|ludhiana|amritsar|jalandhar|mohali|chandigarh)\b/i, localLawNote: 'Punjab Land Revenue Act 1887.' },
  { state: 'Kerala', rx: /\b(kerala|kochi|cochin|thiruvananthapuram|trivandrum|kozhikode)\b/i, localLawNote: 'Kerala Land Reforms Act 1963 and Kerala Buildings (Lease and Rent Control) Act 1965.' },
  { state: 'Odisha', rx: /\b(odisha|orissa|bhubaneswar|cuttack|rourkela)\b/i, localLawNote: 'Odisha Land Reforms Act 1960.' },
  { state: 'Assam', rx: /\b(assam|guwahati|dibrugarh|silchar)\b/i, localLawNote: 'Assam Land and Revenue Regulation 1886.' },
  { state: 'Chhattisgarh', rx: /\b(chhattisgarh|raipur|bilaspur|durg|bhilai)\b/i, localLawNote: 'Chhattisgarh Land Revenue Code 1959.' },
  { state: 'Uttarakhand', rx: /\b(uttarakhand|dehradun|haridwar|haldwani|nainital)\b/i, localLawNote: 'Uttarakhand (U.P. Zamindari Abolition and Land Reforms Act) as applicable.' },
  { state: 'Andhra Pradesh', rx: /\b(andhra\s+pradesh|visakhapatnam|vizag|vijayawada|guntur|tirupati)\b/i, localLawNote: 'A.P. Rights in Land and Pattadar Pass Books Act 1971.' },
  { state: 'Goa', rx: /\b(goa|panaji|margao)\b/i, localLawNote: 'Goa follows the Portuguese Civil Code for succession and community of property between spouses.' },
  { state: 'Jammu & Kashmir', rx: /\b(jammu|kashmir|srinagar)\b/i, localLawNote: 'Central laws apply after 2019 reorganisation; land laws amended by the 2020 Adaptation Orders.' },
  { state: 'Himachal Pradesh', rx: /\b(himachal|shimla|dharamshala|manali)\b/i, localLawNote: 'Section 118 H.P. Tenancy and Land Reforms Act 1972 restricts land purchase by non-agriculturists.' }
];

export function detectIndianState(rawInput = '', caseState = {}) {
  if (caseState.state) {
    const known = STATE_DIRECTORY.find(s => s.state.toLowerCase() === String(caseState.state).toLowerCase());
    return known ? { state: known.state, localLawNote: known.localLawNote } : { state: caseState.state, localLawNote: null };
  }
  const text = String(rawInput || '');
  for (const entry of STATE_DIRECTORY) {
    if (entry.rx.test(text)) {
      return { state: entry.state, localLawNote: entry.localLawNote };
    }
  }
  return null;
}

function resolveAnchorDate(caseState = {}, anchorKeys = []) {
  for (const key of anchorKeys) {
    if (caseState[key] && /^\d{4}-\d{2}-\d{2}$/.test(String(caseState[key]))) {
      return { key, date: caseState[key] };
    }
  }
  return null;
}

/**
 * Stage 2 — Threshold maintainability: civil-court ousters, hard limitation ceilings, arbitration overrides.
 */
export function evaluateMaintainabilityAndOusters({
  rawInput = '',
  domainInfo = {},
  caseState = {},
  evaluationDate = new Date().toISOString().slice(0, 10)
} = {}) {
  const text = String(rawInput || '');
  const mentionsFraud = /\b(fraud|forged|forgery|fabricated|fake\s+(?:signature|document|deed)|impersonat)/i.test(text);

  const ousters = CIVIL_COURT_OUSTER_MATRIX
    .filter(row => row.triggerRegex.test(text))
    .map(row => ({
      id: row.id,
      family: row.family,
      statute: row.statute,
      section: row.section,
      exclusiveForum: row.exclusiveForum,
      exception: row.exception || null,
      verifyNote: row.verifyNote || null,
      fraudExceptionMayApply: mentionsFraud
    }));

  const limitationChecks = HARD_LIMITATION_CEILINGS
    .filter(row => row.triggerRegex.test(text))
    .map(row => {
      const anchor = resolveAnchorDate(caseState, row.anchorKeys);
      let status = 'date-needed';
      let daysElapsed = null;
      let daysRemaining = null;
      if (anchor) {
        daysElapsed = daysBetween(anchor.date, evaluationDate);
        daysRemaining = row.outerDays - daysElapsed;
        if (daysElapsed <= row.baseDays) status = 'within-time';
        else if (daysElapsed <= row.outerDays) status = 'extension-window-only';
        else status = row.condonable ? 'delayed-condonation-needed' : 'barred-hard-ceiling';
      }
      return {
        id: row.id,
        label: row.label,
        baseDays: row.baseDays,
        outerDays: row.outerDays,
        condonable: row.condonable,
        anchorDateField: anchor?.key || null,
        anchorDate: anchor?.date || null,
        daysElapsed,
        daysRemaining,
        status,
        rule: row.rule,
        verifyNote: row.verifyNote || null
      };
    });

  let arbitration = null;
  if (ARBITRATION_CLAUSE_REGEX.test(text)) {
    const domain = domainInfo.domain || '';
    const statutoryOverride =
      domain === 'consumer' || domain === 'property-rera'
        ? 'An arbitration clause does NOT bar a Consumer Commission complaint (Emaar MGF Land v. Aftab Singh, (2019) 12 SCC 1) or a RERA complaint.'
        : /\b(msme|udyam|micro|small\s+enterprise|samadhaan)\b/i.test(text)
        ? 'For a registered MSME supplier, Section 18 MSMED Act overrides a private arbitration clause (Gujarat State Civil Supplies Corp. v. Mahakali Foods, (2023) 6 SCC 401).'
        : /\b(workman|labour\s+court|salary|gratuity|wages)\b/i.test(text)
        ? 'Statutory labour remedies (wages, gratuity, industrial disputes) are not displaced by a private arbitration clause.'
        : domain === 'matrimonial-family' || domain === 'criminal-bns-bnss'
        ? 'Matrimonial status and criminal offences are not arbitrable.'
        : 'For an ordinary commercial or contractual dispute, a party can seek reference to arbitration under Section 8 instead of a civil suit.';
    arbitration = {
      clauseDetected: true,
      statutoryOverride,
      unilateralAppointmentDetected: UNILATERAL_ARBITRATOR_REGEX.test(text),
      unilateralAppointmentRule: 'A clause letting one party (or its nominee) alone appoint the sole arbitrator is invalid (Perkins Eastman v. HSCC, (2020) 20 SCC 760; CORE v. ECI-SPIC-SMO-MCML, 2024 INSC 857, Constitution Bench). Seek appointment by the High Court under Section 11.'
    };
  }

  const barredChecks = limitationChecks.filter(c => c.status === 'barred-hard-ceiling');
  const urgentChecks = limitationChecks.filter(c => c.daysRemaining !== null && c.daysRemaining >= 0 && c.daysRemaining <= 10);

  return {
    ousters,
    limitationChecks,
    arbitration,
    summary: {
      ousterCount: ousters.length,
      hardBarDetected: barredChecks.length > 0,
      urgentDeadlineDetected: urgentChecks.length > 0,
      datesNeeded: limitationChecks.filter(c => c.status === 'date-needed').map(c => c.label)
    }
  };
}

/**
 * Stage 1b — Paper trail vs oral truth, and self-goals (admissions / discharge vouchers).
 */
export function evaluatePaperTrailAndSelfGoals({ rawInput = '', hasAttachments = false } = {}) {
  const text = String(rawInput || '');
  const lower = text.toLowerCase();

  const oralSignals = /\b(orally|verbally|over\s+(?:the\s+)?phone|on\s+call|said\s+(?:no|that)|told\s+me|refused\s+(?:to\s+)?(?:take|accept|register)|nothing\s+in\s+writing|no\s+written|did\s+not\s+give\s+(?:any\s+)?(?:receipt|job\s+sheet|letter)|mauk(?:hik)?|zubani|मौखिक|फोन\s+पर)\b/i.test(text);
  // Ignore negated mentions ("did not give any job sheet", "no receipt") so they are not counted as proof.
  const affirmativeText = text.replace(/\b(?:no|not|never|without|nothing\s+in|did\s*n[o']?t\s+(?:give|get|receive|issue)(?:\s+(?:me|us))?(?:\s+(?:any|a|the))?)\s+[a-z-]+(?:\s+[a-z-]+)?/gi, ' ');
  const documentSignals = hasAttachments || /\b(invoice|bill|receipt|agreement|allotment|email|e-?mail|whatsapp|screenshot|letter|notice|job\s+sheet|mlc|medical\s+report|cctv|bank\s+statement|return\s+memo|order\s+sheet|fir\s+copy|recording|बिल|रसीद|चैट)\b/i.test(affirmativeText);

  const selfGoals = [];
  if (/\b(full\s+and\s+final|full\s*&\s*final|discharge\s+voucher|settlement\s+voucher|no\s+dues\s+certificate|signed\s+(?:a\s+)?(?:release|waiver|undertaking))\b/i.test(lower)) {
    selfGoals.push({
      id: 'discharge-voucher',
      issue: 'A "full and final" / discharge voucher or no-dues document was signed.',
      counterMove: 'A discharge signed under financial pressure or coercion does not automatically bar the claim (National Insurance v. Boghara Polyfab, (2009) 1 SCC 267). Record a written protest immediately, stating the circumstances, before taking any further step.'
    });
  }
  if (/\b(i\s+(?:admitted|accepted|apologi[sz]ed|said\s+sorry)|i\s+wrote\s+(?:that\s+)?(?:i|we)\s+(?:will|would)\s+pay|asked\s+for\s+more\s+time|promised\s+to\s+pay|my\s+mistake|maafi|माफी)\b/i.test(lower)) {
    selfGoals.push({
      id: 'written-admission',
      issue: 'The client may have sent a message admitting fault, liability or asking for time.',
      counterMove: 'An admission is relevant evidence but not conclusive (Sections 15–21 & 25 BSA 2023 / old Sections 17–23 & 31 IEA). Collect the full chat around it so the context (pressure, partial admission, without-prejudice talks) can be shown; never delete it.'
    });
  }
  if (/\b(resign(?:ed|ation)?\s+(?:under\s+pressure|forcibly|was\s+forced)|forced\s+(?:me\s+)?to\s+resign|made\s+me\s+sign\s+(?:a\s+)?resignation)\b/i.test(lower)) {
    selfGoals.push({
      id: 'forced-resignation',
      issue: 'A resignation was submitted under pressure.',
      counterMove: 'Withdraw or protest the resignation in writing at once, before it is accepted, describing the pressure; a resignation can be withdrawn before it takes effect (Union of India v. Gopal Chandra Misra, (1978) 2 SCC 301).'
    });
  }

  return {
    oralOnlyDeficit: oralSignals && !documentSignals,
    documentSignals,
    selfGoals,
    stepZeroAdvice: oralSignals && !documentSignals
      ? 'Everything so far is oral. Before escalating, create a dated written record: send a short, calm email/WhatsApp or Speed Post letter recording what happened, what was said, and what you are asking for. Keep the delivery proof.'
      : null
  };
}

/**
 * Stage 3 — Doctrine of election & forum economics. Each row names the remedies, whether they are
 * mutually exclusive or cumulative, and compares day-1 interim power with how the order is enforced.
 */
const FORUM_ELECTION_TABLE = {
  'property-rera': {
    electionRule: 'RERA and Consumer Commission are concurrent, but the same relief cannot be pursued in both. Elect one (Imperia Structures v. Anil Patni, (2020) 10 SCC 783).',
    relationship: 'mutually-exclusive',
    options: [
      { forum: 'Written notice to builder + lending bank\'s nodal officer', bestFor: 'Creating the paper trail and freezing EMI pressure', interimPower: 'None', executionTeeth: 'Persuasive only' },
      { forum: 'RERA Authority (Sections 18, 31, 36)', bestFor: 'Staying in the project: possession + monthly delay interest; stay on cancellation', interimPower: 'Section 36 interim orders', executionTeeth: 'Recovery as arrears of land revenue (Section 40)' },
      { forum: 'Consumer Commission (District ≤ ₹50 lakh, State ≤ ₹2 crore paid)', bestFor: 'Full refund + interest + compensation for harassment', interimPower: 'Interim orders under Section 38(8)', executionTeeth: 'Section 71 execution; Section 72 penalty and imprisonment for non-compliance' }
    ]
  },
  'cheque-bounce-138': {
    electionRule: 'Criminal complaint under Section 138 NI Act and civil recovery (Order 37 CPC / MSME Samadhaan) are cumulative and can run together.',
    relationship: 'cumulative',
    options: [
      { forum: 'Section 138 NI Act complaint (payee\'s bank branch court)', bestFor: 'Pressure to pay: reverse burden under Section 139', interimPower: 'Up to 20% interim compensation (Section 143A)', executionTeeth: 'Fine up to twice the cheque amount and/or imprisonment' },
      { forum: 'Order 37 CPC summary suit', bestFor: 'Money decree with interest', interimPower: 'Defendant must seek leave to defend', executionTeeth: 'Attachment and sale of assets in execution' },
      { forum: 'MSME Samadhaan (registered MSME supplier)', bestFor: 'Delayed business payments', interimPower: 'Conciliation, then arbitration by the MSEFC', executionTeeth: 'Award with compound interest at three times the bank rate; 75% pre-deposit to challenge (Section 19)' }
    ]
  },
  'matrimonial-family': {
    electionRule: 'Section 12 PWDVA and Section 144 BNSS maintenance can run together, but earlier maintenance awards must be disclosed and adjusted (Rajnesh v. Neha, (2021) 2 SCC 324).',
    relationship: 'cumulative-with-disclosure',
    options: [
      { forum: 'Family counselling / mediation / One Stop Centre (181)', bestFor: 'Ordinary marital disagreement where reconciliation is wanted', interimPower: 'None', executionTeeth: 'Settlement recorded before court becomes enforceable' },
      { forum: 'Section 12 PWDVA before the Magistrate', bestFor: 'Lockout, residence, streedhan, maintenance, custody in one petition', interimPower: 'Section 23 ex parte interim orders', executionTeeth: 'Breach of protection order is an offence (Section 31)' },
      { forum: 'FIR under Section 85 BNS (and Section 316 BNS for streedhan)', bestFor: 'Grave cruelty or unlawful dowry demands', interimPower: 'Police investigation', executionTeeth: 'Criminal prosecution' }
    ]
  },
  'criminal-bns-bnss': {
    electionRule: 'A criminal complaint and a civil claim on the same facts can both proceed, but dressing up a pure money dispute as cheating invites quashing (Mitesh Kumar J. Sha v. State of Karnataka, (2022) 14 SCC 572).',
    relationship: 'cumulative-if-genuine-ingredients',
    options: [
      { forum: 'Written complaint at the police station (Section 173 BNSS)', bestFor: 'Cognizable offence', interimPower: 'Police investigation and arrest powers', executionTeeth: 'Prosecution and property recovery' },
      { forum: 'Superintendent of Police (Section 173(4) BNSS)', bestFor: 'Police refused to register', interimPower: 'Directs registration', executionTeeth: 'Administrative' },
      { forum: 'Magistrate (Section 175(3) BNSS, with affidavit)', bestFor: 'Registration still refused', interimPower: 'Orders investigation', executionTeeth: 'Judicial supervision' }
    ]
  },
  'banking-sarfaesi': {
    electionRule: 'For secured-asset action, the DRT under Section 17 is the forum; civil courts are barred (Section 34). RBI Ombudsman handles service complaints, not challenges to SARFAESI measures.',
    relationship: 'exclusive-tribunal',
    options: [
      { forum: 'Representation under Section 13(3A) within 60 days of the 13(2) notice', bestFor: 'Putting objections on record; bank must reply in 15 days', interimPower: 'None', executionTeeth: 'Unreasoned rejection strengthens the DRT case' },
      { forum: 'DRT Securitisation Application (Section 17)', bestFor: 'Stopping or setting aside possession/auction', interimPower: 'Stay of auction', executionTeeth: 'Restoration of possession' },
      { forum: 'RBI Integrated Ombudsman (cms.rbi.org.in)', bestFor: 'Recovery-agent harassment, CIBIL errors, wrong charges', interimPower: 'None', executionTeeth: 'Ombudsman award binding on the bank if accepted' }
    ]
  },
  'employment-labour': {
    electionRule: 'Statutory claims (gratuity, wages) go to the statutory authority; contractual dues of non-workmen go to the civil court. Choose by the employee category and the right claimed.',
    relationship: 'depends-on-right',
    options: [
      { forum: 'Written demand to HR with records attached', bestFor: 'Creating the record before any counter-allegation', interimPower: 'None', executionTeeth: 'Persuasive' },
      { forum: 'Controlling Authority under the Payment of Gratuity Act / Labour Commissioner (SAMADHAN portal)', bestFor: 'Gratuity, unpaid wages for covered employees', interimPower: 'Limited', executionTeeth: 'Recovery certificate as arrears of land revenue' },
      { forum: 'Civil suit / commercial suit', bestFor: 'Contractual dues, bonuses, ESOPs for managerial staff', interimPower: 'Order 39 injunctions', executionTeeth: 'Money decree' }
    ]
  },
  'motor-accident-mact': {
    electionRule: 'Choose either no-fault compensation (Section 164) or fault-based compensation (Section 166); the claimant cannot take both for the same accident.',
    relationship: 'mutually-exclusive',
    options: [
      { forum: 'Section 164 MV Act (no-fault, structured)', bestFor: 'Quick fixed compensation: ₹5 lakh death, ₹2.5 lakh grievous hurt', interimPower: 'Settlement through the insurer\'s Section 149 procedure', executionTeeth: 'Insurer pays; a pending Section 166 claim lapses if this is accepted' },
      { forum: 'Section 166 MV Act claim before MACT', bestFor: 'Full loss-of-income based compensation', interimPower: 'Interim award', executionTeeth: 'Insurer deposits award; recovery from owner if policy breach' }
    ]
  },
  'consumer': {
    electionRule: 'Try the free regulator route first; a Consumer Commission complaint remains available within 2 years.',
    relationship: 'sequential',
    options: [
      { forum: 'Written job sheet / grievance officer + National Consumer Helpline (1915)', bestFor: 'Quick brand-level resolution', interimPower: 'None', executionTeeth: 'Persuasive' },
      { forum: 'Sectoral ombudsman (RBI, Insurance, Telecom, Electricity)', bestFor: 'Bank, insurance, telecom, power disputes', interimPower: 'None', executionTeeth: 'Award binding on the service provider' },
      { forum: 'Consumer Commission', bestFor: 'Refund + compensation + costs', interimPower: 'Section 38(8) interim orders', executionTeeth: 'Sections 71–72' }
    ]
  }
};

export function evaluateForumElectionAndEconomics({ domainInfo = {} } = {}) {
  const row = FORUM_ELECTION_TABLE[domainInfo.domain];
  if (!row) return null;
  return {
    domain: domainInfo.domain,
    relationship: row.relationship,
    electionRule: row.electionRule,
    options: row.options
  };
}

/**
 * Stage 4 — 360° flank shield: anticipated counter-moves by the other side or third parties.
 */
export function evaluateFlankRisks({ rawInput = '', domainInfo = {} } = {}) {
  const text = String(rawInput || '');
  const flanks = [];
  if (/\b(terminate|terminating|evict|evicting|stop\s+(?:the\s+)?work|cancel(?:ling)?\s+(?:the\s+)?(?:contract|agreement)|take\s+back\s+possession)\b/i.test(text)) {
    flanks.push({
      id: 'caveat-s148a',
      risk: 'The other side may rush to court for an ex parte stay once you act.',
      shield: 'File a caveat under Section 148A CPC in the likely court; it lasts 90 days and requires notice to you before any interim order.'
    });
  }
  if (domainInfo.domain === 'employment-labour' || /\b(salary|full\s+and\s+final|relieving\s+letter|gratuity|notice\s+period)\b/i.test(text)) {
    flanks.push({
      id: 'hr-counter-allegation',
      risk: 'Employer may answer a dues demand with an "absconding" or misconduct allegation.',
      shield: 'Before sending a demand, save handover emails, appraisal records, attendance and asset-return acknowledgements. Post-employment non-compete clauses are void under Section 27 of the Contract Act (Percept D\'Mark v. Zaheer Khan, (2006) 4 SCC 227).'
    });
  }
  if (/\b(loan|emi|home\s+loan|sarfaesi|bank\s+notice)\b/i.test(text)) {
    flanks.push({
      id: 'credit-report',
      risk: 'Missed EMIs during a dispute damage the credit report and can trigger cheque/ECS dishonour proceedings.',
      shield: 'Write to the lender before stopping any payment, and raise CIBIL errors with the bank and bureau; RBI rules require resolution within 30 days, with ₹100/day compensation for delay.'
    });
  }
  return flanks;
}

/**
 * Builds the instruction for the "Cross-Examination & Contradictions" artifact.
 */
export function buildCrossExaminationInstruction(domainInfo = {}) {
  const forumHint = domainInfo.domain === 'criminal-bns-bnss'
    ? 'criminal trial (prosecution witness or defence witness as applicable)'
    : domainInfo.domain === 'consumer'
    ? 'Consumer Commission (written interrogatories / affidavit evidence)'
    : 'civil or tribunal trial';
  return `Act as senior trial counsel preparing for cross-examination in a ${forumHint}. Using ONLY the facts, documents and the opposite party's reply/affidavit/FIR available in this case:
1. Build a Contradiction Table: | Opponent's statement (para/page) | What the record shows (document/date) | Why it matters |.
2. Draft 10–15 short, closed, leading cross-examination questions (permitted in cross-examination under Section 146 BSA 2023 / old Section 143 IEA), grouped by theme, each targeting one contradiction or admission. Avoid open "why" questions.
3. List documents to confront the witness with (Section 148 BSA 2023 / old Section 145 IEA for previous written statements) and any electronic record needing a Section 63 BSA certificate.
4. Flag questions that would be risky (could let the witness explain away a point) so counsel can drop them.
If the opponent's pleading or statement is not yet available, say so and list exactly which document to obtain first; do not invent their statements.`;
}
