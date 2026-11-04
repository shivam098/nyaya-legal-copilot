/**
 * Scope guard: keeps Nyaya a legal specialist.
 *
 * A message is declined only when it carries a clear non-legal signal (relationships, studies, health,
 * recipes, entertainment, coding...) AND no legal signal at all, across the whole conversation so far.
 * Anything with a possible legal angle (harassment, threats, marriage, money, police, property, work...) is
 * answered. Borderline messages that pass this guard are handled by the system-prompt scope rule.
 * The person can always override ("it's a legal matter") or flag the decline for review.
 */

const DOC_MARKER = 'ATTACHED FOLDER / TEXT DOCUMENTS:';

// Any of these means there may be a legal question; the guard then stays out of the way.
const LEGAL_SIGNAL = new RegExp([
  // general legal vocabulary (English)
  'law', 'laws', 'legal(?:ly)?', 'illegal', 'lawyer', 'advocate', 'vakil', 'wakil', 'court', 'judge', 'judgment', 'judgement', 'bench',
  'case', 'cases', 'section', 'sec\\.?\\s*\\d+', 'act\\s*,?\\s*\\d{4}', 'the\\s+[a-z]+(?:\\s+[a-z]+)?\\s+act', 'article\\s*\\d+', 'constitution\\w*', '(?:my|legal|human|fundamental|tenant|consumer)\\s+rights?', 'rights?\\s+of', 'right\\s+to', 'petition', 'writ', 'pil',
  'complaint', 'complain\\w*', 'notice', 'summons?', 'warrant', 'fir', 'police', 'thana', 'arrest\\w*', 'bail', 'custody', 'jail', 'prison',
  'crime', 'criminal', 'offen[cs]e', 'punish\\w*', 'penalty', 'fined', 'challan', 'ipc', 'bns', 'bnss', 'bsa', 'crpc', 'cpc', 'mens\\s+rea', 'actus\\s+reus',
  'tort', 'contract', 'agreement', 'deed', 'affidavit', 'stamp\\s+duty', 'registr\\w*', 'notar\\w*', '(?:my|a|his|her|father\'?s|mother\'?s)\\s+will', 'inheritance', 'succession', 'heir',
  'property', 'land', 'plot', 'flat', 'builder', 'rera', 'rent', 'tenant', 'landlord', 'evict\\w*', 'lease', 'mutation', 'khata', 'patta',
  'divorce', 'marriage', 'married', 'maintenance', 'alimony', 'dowry', 'dahej', 'domestic\\s+violence', 'cruelty', 'talaq', 'custody',
  'harass\\w*', 'stalk\\w*', 'threat\\w*', 'blackmail\\w*', 'extort\\w*', 'assault\\w*', 'abuse\\w*', 'rape', 'molest\\w*', 'consent', 'minor', 'pocso',
  'cheat\\w*', 'fraud\\w*', 'scam\\w*', 'forg\\w*', 'defam\\w*', 'cyber', 'hack\\w*', 'theft', 'stolen', 'steal\\w*', 'snatch\\w*', 'robb\\w*', 'murder', 'kidnap\\w*',
  'refund', 'consumer', 'warranty', 'defect\\w*', 'deficien\\w*', 'compensation', 'claim', 'insurance', 'cheque', 'bounce\\w*', 'loan', 'emi', 'recovery', 'debt',
  'salary', 'wages', 'gratuity', 'pf', 'epf', 'esi', 'terminat\\w*', 'fired', 'resign\\w*', 'employer', 'posh',
  'gst', 'income\\s+tax', 'tax\\s+notice', 'rti', 'company', 'llp', 'opc', 'pvt\\s+ltd', 'roc', 'trademark', 'copyright', 'patent',
  'accident', 'mact', 'license', 'licence', 'permit', 'passport', 'visa', 'aadhaar', 'pan\\s+card', 'name\\s+change', 'gazette', 'certificate',
  'sue', 'sued', 'suing', 'liable', 'liability', 'evidence', 'witness', 'appeal', 'hearing', 'adjournment', 'tribunal', 'commission', 'authority',
  // Hindi / Hinglish legal vocabulary
  'kanoon\\w*', 'kanuni', 'kanooni', 'adalat', 'mukadma\\w*', 'mukadm\\w*', 'shikayat', 'dhara', 'jamanat', 'giraftar\\w*', 'case\\s+kar', 'shaadi', 'shadi', 'vivah',
  'talak', 'zameen', 'jamin', 'jameen', 'kiraya\\w*', 'kirayedar', 'makan\\s+malik', 'dhokha\\w*', 'dhamki', 'maar\\s?pit\\w*', 'chori', 'paisa\\s+wapas', 'paise\\s+wapas',
  'naukri', 'tankhwah', 'vetan', 'virasat', 'batwara', 'wasiyat', 'mera\\s+ha[kq]', 'ha[kq]\\s+(?:hai|milega|banta)', 'adhikar'
].map(w => `\\b${w}\\b`).join('|').replace('\\bcase\\b', '(?<!in\\s)\\bcase\\b') + '|कानून|अदालत|पुलिस|थाना|मुकदमा|शिकायत|धारा|जमानत|तलाक|शादी|ज़मीन|जमीन|किराया|धोखा|धमकी|चोरी|वकील|अधिकार', 'i');

// Clear non-legal topics, grouped so the decline can name what kind of question it was.
const NON_LEGAL_TOPICS = [
  {
    category: 'relationship',
    rx: /\b(love|crush|girlfriend|boyfriend|gf|bf|propose|proposal|impress|patao|pata\w*|pyar|pyaar|prem|ishq|mohabbat|dil|feelings?|interest\s+(?:nahi|kam|dikhat\w*)|ignore\s+kar\w*|break\s?up\s+(?:ke\s+baad|se\s+kaise|advice)|move\s+on|miss\s+(?:her|him|kar\w*)|dating|date\s+pe|relationship\s+advice|ladki\s+(?:se|ko|mujhe)|ladka\s+(?:se|ko|mujhe))\b|प्यार|प्रेम|इश्क/i
  },
  {
    category: 'studies',
    rx: /\b(homework|assignment|essay\s+on|exam\s+(?:tips|preparation)|syllabus|photosynthesis|algebra|calculus|trigonometry|physics|chemistry|biology|solve\s+(?:this|the)\s+(?:equation|question|sum)|explain\s+(?:the\s+)?(?:theorem|formula)|history\s+of\s+(?!law)\w+|padhai\s+kaise)\b/i
  },
  {
    category: 'health',
    rx: /\b(symptoms?|fever|headache|diet\s+plan|weight\s+loss|lose\s+weight|gym|workout|medicine\s+for|tablet\s+for|cure\s+for|home\s+remed\w*|pimples?|hair\s+fall|bimari|ilaaj|dawai|dawa)\b/i
  },
  {
    category: 'lifestyle',
    rx: /\b(recipe|how\s+to\s+(?:cook|make\s+(?:tea|chai|cake|biryani|pasta))|khana\s+kaise\s+banaye|travel\s+plan|places\s+to\s+visit|best\s+(?:phone|laptop|movie|song)s?|movie\s+(?:suggest|recommend)\w*|song\s+lyrics|joke|shayari|poem|horoscope|rashifal|astrology|kundli|cricket\s+score|match\s+score|weather)\b/i
  },
  {
    category: 'tech',
    rx: /\b(write\s+(?:a\s+)?(?:code|program|script)|python|javascript|java\s+code|c\+\+|html|css|sql\s+query|debug\s+(?:my|this)|excel\s+formula)\b/i
  },
  {
    category: 'career',
    rx: /\b(resume\s+tips|cv\s+format|interview\s+(?:tips|questions)|career\s+advice|which\s+course|motivat\w*|life\s+advice|how\s+to\s+be\s+happy|depress\w*\s+(?:tips|kaise))\b/i
  }
];

function questionOnly(text = '') {
  return String(text || '').split(DOC_MARKER)[0].trim();
}

/**
 * @returns {{ outOfScope: boolean, category: string, reason: string }}
 */
export function classifyLegalScope({ text = '', priorText = '', hasAttachments = false, domain = '' } = {}) {
  const current = questionOnly(text);
  const cumulative = `${questionOnly(priorText)}\n${current}`;
  if (!current) return { outOfScope: false, category: '', reason: 'empty' };
  if (hasAttachments) return { outOfScope: false, category: '', reason: 'documents attached' };
  if (domain && domain !== 'general') return { outOfScope: false, category: '', reason: `legal area detected: ${domain}` };
  if (LEGAL_SIGNAL.test(cumulative)) return { outOfScope: false, category: '', reason: 'legal signal present' };
  const topic = NON_LEGAL_TOPICS.find(t => t.rx.test(current));
  if (!topic) return { outOfScope: false, category: '', reason: 'no clear non-legal signal' };
  return { outOfScope: true, category: topic.category, reason: `non-legal topic: ${topic.category}` };
}

function detectReplyLanguage(text = '') {
  const t = questionOnly(text);
  if (/[\u0900-\u097F]/.test(t)) return 'hi';
  const hinglishHits = (t.toLowerCase().match(/\b(hai|hain|mujhe|mera|meri|kya|kaise|nahi|nahin|kyun|ho|raha|rahi|gaya|gayi|tha|thi|karu|kare|karna|aur|ab|se|ko|ki|ka|ke|wo|woh|yeh|ye)\b/g) || []).length;
  return hinglishHits >= 3 ? 'hinglish' : 'en';
}

const TOPIC_WORDS = {
  en: { relationship: 'relationship or personal advice', studies: 'study or homework help', health: 'health or fitness advice', lifestyle: 'general or lifestyle questions', tech: 'coding or tech help', career: 'career or life advice' },
  hinglish: { relationship: 'relationship ya personal advice', studies: 'padhai ya homework', health: 'health ya fitness', lifestyle: 'general ya lifestyle sawaal', tech: 'coding ya tech help', career: 'career ya life advice' },
  hi: { relationship: 'रिश्तों या निजी सलाह', studies: 'पढ़ाई या होमवर्क', health: 'सेहत या फिटनेस', lifestyle: 'सामान्य सवालों', tech: 'कोडिंग या टेक मदद', career: 'करियर या जीवन सलाह' }
};

/** Short, polite decline in the person's language that points to a general assistant and invites a legal angle. */
export function buildOutOfScopeReply({ text = '', category = 'lifestyle' } = {}) {
  const lang = detectReplyLanguage(text);
  const topic = (TOPIC_WORDS[lang] || TOPIC_WORDS.en)[category] || (TOPIC_WORDS[lang] || TOPIC_WORDS.en).lifestyle;
  if (lang === 'hi') {
    return `मैं **न्याय** हूँ — भारतीय कानूनी मामलों का सहायक। ${topic} के लिए मैं सही जगह नहीं हूँ; इसके लिए ChatGPT, Gemini या Copilot जैसे सामान्य AI सहायक आपकी बेहतर मदद करेंगे।\n\nअगर इसमें कोई **कानूनी पहलू** है — जैसे धमकी, उत्पीड़न, शादी, पैसे का लेन-देन, पुलिस या कोई विवाद — तो वह बताइए, मैं ज़रूर मदद करूँगा।`;
  }
  if (lang === 'hinglish') {
    return `Main **Nyaya** hoon — sirf Indian legal matters ke liye bana assistant. ${topic.charAt(0).toUpperCase()}${topic.slice(1)} ke liye main sahi jagah nahi hoon; iske liye ChatGPT, Gemini ya Copilot jaise general AI assistant aapki behtar madad karenge.\n\nAgar isme koi **legal angle** hai — jaise dhamki, harassment, shaadi, paison ka len-den, police ya koi vivaad — toh woh bataiye, main zaroor madad karunga.`;
  }
  return `I'm **Nyaya**, an assistant for Indian legal matters only. ${topic.charAt(0).toUpperCase()}${topic.slice(1)} is outside what I do — a general assistant such as ChatGPT, Gemini or Copilot will help you better with this.\n\nIf there is a **legal side** to it — for example threats, harassment, marriage, money owed, the police or a dispute — tell me about that and I'll gladly help.`;
}
