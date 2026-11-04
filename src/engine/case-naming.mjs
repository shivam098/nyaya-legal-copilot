/**
 * Case naming: gives every conversation a short, readable name from what kind of matter it is and what the
 * person asked, e.g. "Draft · Rent agreement (Maharashtra)", "Consumer · Apple Watch speaker not working",
 * "Criminal · Police refused to register FIR". Names the user typed themselves are never replaced
 * (the caller decides that); this module only builds the automatic name.
 */
import { autoSenseIntakeFromText } from './civil-criminal-rules.mjs';

const DOC_MARKER = 'ATTACHED FOLDER / TEXT DOCUMENTS:';

const AREA_BY_DOMAIN = {
  'corporate-roc': 'Company',
  'cheque-bounce-138': 'Cheque bounce',
  'banking-sarfaesi': 'Bank / SARFAESI',
  'motor-accident-mact': 'Accident claim',
  'senior-citizens': 'Senior citizen',
  'criminal-bns-bnss': 'Criminal',
  'matrimonial-family': 'Family',
  'inheritance-partition': 'Inheritance',
  'land-revenue': 'Land record',
  'property-rera': 'Property',
  'tenancy-civil': 'Tenancy',
  'traffic-challan': 'Traffic challan',
  'employment-labour': 'Employment',
  'msme-arbitration': 'MSME dues',
  'tax-rti-writ': 'Tax / RTI',
  consumer: 'Consumer',
  general: 'Legal question'
};

const DOCUMENT_SHORT_NAME = {
  'rent-agreement': 'Rent agreement',
  will: 'Will',
  'power-of-attorney': 'Power of attorney',
  'gift-deed': 'Gift deed',
  'sale-agreement': 'Sale agreement',
  'partnership-deed': 'Partnership deed',
  'service-contract': 'Service agreement',
  'employment-contract': 'Employment contract',
  'loan-agreement': 'Loan agreement',
  affidavit: 'Affidavit',
  generic: 'Legal document'
};

// Form-field lines produced by the guided forms. Story-like fields keep their content; metadata fields are dropped.
const FORM_LINE = /^\s*(User Role|User Side|Case Sub-Track|Key Date|Need Type|Proceeding Stage|Advocate Research Mode|Raw Story \/ WhatsApp Chat|Details|Query \/ Citation \/ Issue)\s*:\s*(.*)$/i;
const STORY_FIELDS = /^(Raw Story \/ WhatsApp Chat|Details|Query \/ Citation \/ Issue)$/i;

const LEADING_FILLER = [
  /^(hi|hello|hey|namaste|namaskar|sir|madam|dear\s+\w+)[\s,!.:-]+/i,
  /^(please|pls|kindly)\s+/i,
  /^(can|could|would)\s+you\s+(please\s+)?(help\s+me\s+(to\s+|with\s+)?|tell\s+me\s+(about\s+)?|explain\s+)?/i,
  /^help\s+me\s+(to\s+|with\s+|understand\s+)?/i,
  /^i\s+(need|want|would\s+like)\s+(some\s+)?(legal\s+)?(help|guidance|advice|to\s+know|information)\s*(for|with|on|about|regarding|in)?\s*/i,
  /^i\s+want\s+to\s+(know|ask|understand)\s+(about\s+|whether\s+|if\s+)?/i,
  /^(tell|explain)\s+(me\s+)?(about\s+)?/i,
  /^(what|how)\s+(should|can|do)\s+i\s+do\s+(about|if|when|now)?\s*/i,
  /^what\s+(should|can|must)\s+be\s+done\s*(so|now|here)?\s*/i,
  /^(mujhe|meri|mera)\s+(madad|help)\s+(chahiye|karo|kijiye)\s*/i,
  /^(question|query|issue)\s*[:-]\s*/i
];
const TRAILING_FILLER = /[\s,]*(\?+|\.{2,}|!+|what\s+(can|should|do)\s+i\s+do|what\s+are\s+my\s+options|please\s+(help|suggest|advise)|sujhao|sujhav\s+do|kya\s+karu|kya\s+karein|kya\s+kare|help\s+me|thanks?|thank\s+you)\s*$/i;

function cleanQuestionText(rawInput = '') {
  const lines = String(rawInput || '').split(DOC_MARKER)[0]
    .replace(/=== FILE:.*?===/g, '')
    .split(/\r?\n/)
    .map(line => {
      const field = line.match(FORM_LINE);
      if (!field) return line;
      return STORY_FIELDS.test(field[1]) ? field[2] : '';
    })
    .map(l => l.trim())
    .filter(Boolean);
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

/** Short subject phrase from the person's first question. */
export function extractCaseSubject(rawInput = '', maxLength = 48) {
  const text = cleanQuestionText(rawInput);
  if (!text) return '';
  const strip = (value) => {
    let out = value;
    for (let pass = 0; pass < 4; pass++) {
      const before = out;
      for (const rx of LEADING_FILLER) out = out.replace(rx, '');
      out = out.replace(TRAILING_FILLER, '').trim();
      if (out === before) break;
    }
    return out.replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').replace(/\s+/g, ' ');
  };
  const letters = s => s.replace(/[^\p{L}\p{N}]/gu, '').length;
  // Sentences (Hinglish users often separate with "...."); greetings and fillers are dropped.
  const sentences = text.split(/(?<=[?!।])\s+|\.{2,}\s*|(?<=\.)\s+(?=[A-Z])/).map(s => strip(s.trim())).filter(s => letters(s) >= 6);
  if (sentences.length === 0) return '';

  // A short opener ("I bought an Apple Watch") says little on its own; add the next sentence for the actual problem.
  let subject = sentences[0];
  if (subject.length < 28 && sentences[1]) subject = `${subject}, ${sentences[1].charAt(0).toLowerCase()}${sentences[1].slice(1)}`;

  if (subject.length > maxLength) {
    const cut = subject.slice(0, maxLength + 1);
    const lastSpace = cut.lastIndexOf(' ');
    subject = `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut.slice(0, maxLength)).replace(/[\s,.:;-]+$/, '')}…`;
  }
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

/**
 * Builds the automatic case name.
 * @param {object} p
 * @param {string} p.firstQuestion  the first thing the person asked in this conversation
 * @param {object} [p.engineResult] latest engine result (area of law, request kind, detected State)
 * @param {string} [p.door]
 * @param {string} [p.mode]
 */
export function generateCaseTitle({ firstQuestion = '', engineResult = null, door = '', mode = '' } = {}) {
  // Without a fresh engine result (e.g. renaming old conversations), route the first question with the current rules.
  if (!engineResult) {
    const guided = ['midcase', 'lawyer-workbench', 'company'].includes(door);
    const sensed = autoSenseIntakeFromText({
      door: guided ? door : 'unified',
      mode: guided ? mode : 'auto',
      caseState: {},
      rawInput: cleanQuestionText(firstQuestion)
    });
    engineResult = {
      domainInfo: sensed.domainInfo,
      effectiveDoor: sensed.door,
      effectiveMode: sensed.mode,
      inferredCaseState: sensed.caseState,
      practitionerIntelligence: sensed.mode === 'document-drafting'
        ? { factReadiness: { kind: 'drafting', documentType: sensed.caseState?.documentType } }
        : null
    };
  }
  const pi = engineResult?.practitionerIntelligence || null;
  const kind = pi?.factReadiness?.kind || '';
  const effectiveMode = engineResult?.effectiveMode || mode || '';
  const effectiveDoor = engineResult?.effectiveDoor || door || '';

  if (kind === 'drafting' || effectiveMode === 'document-drafting') {
    const docType = pi?.factReadiness?.documentType || engineResult?.inferredCaseState?.documentType || 'generic';
    const state = pi?.factReadiness?.detectedState?.state;
    return `Draft · ${DOCUMENT_SHORT_NAME[docType] || DOCUMENT_SHORT_NAME.generic}${state ? ` (${state})` : ''}`;
  }

  const subject = extractCaseSubject(firstQuestion);
  let area = AREA_BY_DOMAIN[engineResult?.domainInfo?.domain] || '';
  if (effectiveDoor === 'lawyer-workbench' || effectiveMode === 'lawyer-research-bench') area = 'Advocate research';
  else if (effectiveDoor === 'midcase' || effectiveMode === 'midcase-battle-card') area = area && area !== 'Legal question' ? `Ongoing ${area.toLowerCase()} case` : 'Ongoing case';
  else if (!area) area = effectiveDoor === 'company' ? 'Company' : 'Legal question';

  return subject ? `${area} · ${subject}` : `${area} matter`;
}

/** True for names produced by the old automatic namer ("[Dispute] …", "Ongoing Case — …"), so they can be upgraded. */
export function isLegacyAutoTitle(title = '') {
  const t = String(title || '').trim();
  return !t
    || /^\[[^\]]{1,40}\]\s/.test(t)
    || /^(Dispute Session|Defend Claim Session|Ongoing Case — |Company \/ RoC Advisory$|Advocate Judgment & Bare Act Dossier$|Case — |Untitled Case$)/.test(t);
}
