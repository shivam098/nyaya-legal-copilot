/**
 * SQLite Semantic Vector Embedding + FTS5 Hybrid Statutory & Practitioner Knowledge Index
 *
 * - Creates and stores 384-dimensional L2-normalized Float32 vector embeddings (`embedding_blob` BLOB + `embedding_json`)
 *   inside SQLite alongside an FTS5 virtual table (`statutory_provisions_fts`).
 * - Supports true multilingual semantic similarity search (English, Devanagari Hindi, Roman Hinglish)
 *   combined with automatic `chapter_cluster` adjacent-section expansion (so a query on "chain snatching"
 *   automatically pulls s.303 Theft, s.304 Snatching [3 yrs], s.309(4)/(6) Robbery [10 yrs / Life],
 *   s.54 BNSS TIP, and s.497/503 BNSS Jimmanama/Supurdari property release without hardcoded if/else branches).
 * - Also manages the `practitioner_lessons` semantic memory table so Super-Admin / Lawyer corrections
 *   added in the Admin Lab are vector-indexed and retrieved automatically on future cases.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const embeddingWorkerPath = path.join(__dirname, 'embedding-worker.py');

export const EMBEDDING_DIM = 384;
export const EMBEDDING_MODEL_ID = 'Xenova/multilingual-e5-small+legal-anchors-384';

/**
 * Optional Neural Transformer Embedding via Local ONNX Runtime (`Xenova/multilingual-e5-small`, 384-dim)
 * Can be called directly for neural batch embedding, and is fused with the 384-dim Legal Concept Anchor vector.
 */
export function computeNeuralOnnxEmbeddingsBatch(texts = [], prefix = 'query: ') {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  try {
    const payload = JSON.stringify({ id: 'batch-1', texts, prefix }) + '\n';
    const proc = spawnSync('python', [embeddingWorkerPath], {
      input: payload,
      encoding: 'utf8',
      timeout: 8000
    });
    if (proc.status === 0 && proc.stdout) {
      const firstLine = proc.stdout.trim().split(/\r?\n/).find(l => l.startsWith('{'));
      if (firstLine) {
        const parsed = JSON.parse(firstLine);
        if (parsed.ok && Array.isArray(parsed.embeddings)) {
          return parsed.embeddings.map(arr => new Float32Array(arr));
        }
      }
    }
  } catch {
    // Fallback gracefully to fast in-process concept+subword embedding
  }
  return [];
}

/**
 * 64 Multilingual Legal Concept Anchors (Dims 0..63)
 * Maps English, Hindi (Devanagari), and Hinglish phrases into semantic concept dimensions
 * so semantically equivalent descriptions activate the same vector coordinates even with zero word overlap.
 */
const MULTILINGUAL_LEGAL_CONCEPT_ANCHORS = [
  // 0..7: Property Offences — Theft, Snatching, Robbery, Extortion
  /(\b(?:theft|stole|stolen|chori|pickpocket|shoplift|steal|gayab|bns\s*303|378\s*ipc|379\s*ipc)\b|चोरी|गायब)/gi,
  /(\b(?:snatch|snatched|snatching|chain\s+snatch(?:ing)?|mobile\s+snatch(?:ing)?|pulled\s+from\s+neck|jerk|jhapat|bns\s*304)\b|झपटमारी|चेन\s+स्नैचिंग|छीन\s+लिया)/gi,
  /(\b(?:robbery|robbed|loot|luta|gunpoint|knife|dragged|pushed\s+and\s+took|neck\s+injury|scratched\s+neck|hurt\s+while\s+taking|bns\s*309|392\s*ipc|394\s*ipc)\b|डकैती|लूट)/gi,
  /(\b(?:extort|extortion|blackmail|rangdari|threatened\s+to\s+expose|demanded\s+money\s+under\s+threat|bns\s*308|384\s*ipc)\b|रंगदारी|वसूली)/gi,
  /(\b(?:burglary|house\s+break|trespass|lock\s+broken|tala\s+tod|bns\s*305|bns\s*331|457\s*ipc)\b|ताला\s+तोड़|घर\s+में\s+घुस)/gi,
  /(\b(?:entrust|entrusted|handed\s+over|gave\s+to\s+keep|safekeeping|rakhne\s+ke\s+liye|diya\s+tha|wapas\s+nahi|criminal\s+breach\s+of\s+trust|misappropriation|bns\s*314|bns\s*316|403\s*ipc|406\s*ipc)\b|अमानत|गहने\s+रखने|रखने\s+के\s+लिए\s+दिया|वापस\s+नहीं\s+कर\s+रहा)/gi,
  /(\b(?:cheat|cheating|fraud|scam|defraud|dhokha|false\s+promise|inception|fake\s+document|forged|bns\s*318|420\s*ipc)\b|धोखाधड़ी|जालसाजी)/gi,
  /(\b(?:cyber\s*crime|upi\s+fraud|otp\s+scam|phishing|bank\s+account\s+hacked|1930|66c|66d)\b|साइबर\s+ठगी|ऑनलाइन\s+धोखाधड़ी)/gi,

  // 8..15: Offences Against Body — Assault, Hurt, Grievous Hurt, Intimidation, Sexual Offences
  /\b(assault|gesture|raised\s+hand|tried\s+to\s+hit|marne\s+ka\s+ishara|हाथ\s+उठाया|हमला|bns\s*130|351\s*ipc)\b/gi,
  /\b(criminal\s+force|pushed|shoved|dhakka|धक्का|जबरदस्ती|bns\s*129|350\s*ipc)\b/gi,
  /\b(hurt|beaten|slapped|punched|maar\s*peet|मारपीट|पीट\s+दिया|चोट|mlc|medical\s+injury|bns\s*115|323\s*ipc)\b/gi,
  /\b(grievous\s+hurt|fracture|broken\s+bone|bleeding|hospitalized|weapon|rod|lathi|गंभीर\s+चोट|हड्डी\s+टूट|हथियार|bns\s*117|bns\s*118|325\s*ipc|326\s*ipc)\b/gi,
  /\b(wrongful\s+restraint|blocked\s+way|locked\s+in\s+room|confinement|रास्ता\s+रोका|बंधक|bns\s*126|bns\s*127|341\s*ipc|342\s*ipc)\b/gi,
  /\b(criminal\s+intimidation|death\s+threat|jaan\s+se\s+marne|जान\s+से\s+मारने\s+की\s+धमकी|धमकी|bns\s*351|506\s*ipc)\b/gi,
  /\b(stalking|outRaging\s+modesty|harassment\s+of\s+woman|छेड़छाड़|पीछा\s+करना|bns\s*74|bns\s*78|354\s*ipc)\b/gi,
  /(\b(?:false\s+promise\s+to\s+marry|breach\s+of\s+promise|deceitful\s+means|deceitful\s+intercourse|marital\s+rape|section\s+69\b|s\.?\s*69\b|bns\s*69|376\s*ipc|pramod\s+suryabhan|consensual\s+relationship|breakup)\b|शादी\s+का\s+झांसा)/gi,

  // 16..23: Police Station, FIR, Preliminary Inquiry, Bail & Property Release (BNSS 2023)
  /\b(fir|zero\s+fir|e-?fir|173\s*bnss|154\s*crpc|police\s+station|thana|थाना|प्राथमिकी|एफआईआर)\b/gi,
  /\b(police\s+refus|not\s+registering|downgrade|sanha|ncr|missing\s+report|lost\s+report|सनहा|गुमशुदगी|दर्ज\s+नहीं\s+कर\s+रहे|173\(4\)\s*bnss|175\(3\)\s*bnss|156\(3\)\s*crpc|ssp|sp\s+complaint)\b/gi,
  /\b(preliminary\s+inquiry|173\(3\)\s*bnss|lalita\s+kumari|dsp\s+permission|14\s+days\s+inquiry|प्रारंभिक\s+जांच)\b/gi,
  /\b(cognizable|non-?cognizable|first\s+schedule\s+bnss|5000|5,000|संज्ञेय|असंज्ञेय)\b/gi,
  /\b(arrest|arnesh\s+kumar|notice\s+of\s+appearance|35\(3\)\s*bnss|41a\s*crpc|7\s+years|सात\s+साल|गिरफ्तारी\s+नोटिस)\b/gi,
  /\b(anticipatory\s+bail|regular\s+bail|default\s+bail|480\s*bnss|482\s*bnss|483\s*bnss|187\s*bnss|438\s*crpc|439\s*crpc|जमानत|अग्रिम\s+जमानत)\b/gi,
  /\b(recovery\s+of\s+stolen|release\s+of\s+property|jimmanama|zimmanama|supurdari|superdari|497\s*bnss|503\s*bnss|451\s*crpc|457\s*crpc|sunderbhai|जिम्मानामे|सुपुर्दगी|बरामदगी)\b/gi,
  /\b(test\s+identification\s+parade|tip\b|54\s*bnss|identification\s+of\s+accused|identification\s+of\s+jewellery|शिनाख्त\s+परेड)\b/gi,

  // 24..31: Matrimonial, Family, Domestic Violence & Maintenance
  /\b(498\s*-?\s*a|bns\s*85|bns\s*86|cruelty\s+by\s+husband|dowry\s+harassment|dahej|दहेज\s+उत्पीड़न|caw\s+cell|mahila\s+thana)\b/gi,
  /\b(domestic\s+violence|pwdva|dv\s+act|section\s+12\s+pwdva|protection\s+order|residence\s+order|shared\s+household|locked\s+out|घर\s+से\s+निकाल\s+दिया|घरेलू\s+हिंसा)\b/gi,
  /\b(streedhan|stridhan|jewellery\s+kept|passport\s+kept|section\s+19\(8\)|406\s*ipc|bns\s*316|स्त्रीधन|गहने\s+रख\s+लिये)\b/gi,
  /\b(maintenance|alimony|144\s*bnss|125\s*crpc|rajnesh\s+v\s+neha|interim\s+maintenance|भरण\s+पोषण|खर्चा)\b/gi,
  /\b(marital\s+argument|minor\s+quarrel|nok\s*jhok|not\s+calling\s+back|reconcil|mediation|restitution\s+of\s+conjugal|section\s+9\s+hma|नोकझोंक|मायके|सुलह)\b/gi,
  /\b(child\s+custody|visitation|guardianship|section\s+21\s+pwdva|बच्चे\s+की\s+कस्टडी)\b/gi,
  /\b(divorce|mutual\s+consent|13b\s+hma|contested\s+divorce|तलाक)\b/gi,
  /\b(senior\s+citizen|elderly\s+parents?|old\s+parents|maintenance\s+tribunal|gift\s+deed|section\s+23\s+senior|parents\s+maintenance|evict\s+abusive\s+son|माता\s+पिता\s+भरण\s+पोषण)\b/gi,

  // 32..39: Property, Builder/RERA, Bank Loan Trap & Family Partition
  /\b(rera|maharera|builder\s+delay|possession\s+delay|flat\s+delay|occupancy\s+certificate|section\s+18\s+rera|section\s+31\s+rera|imperia\s+structures|newtech\s+promoters|बिल्डर)\b/gi,
  /\b(home\s+loan|bank\s+loan|emi\s+harassment|recovery\s+agent|possession\s+notice|bank\s+auction|13\(2\)|13\(4\)|securitisation|tripartite\s+agreement|subvention\s+scheme|sarfaesi|drt\b|cibil|बैंक\s+लोन|ईएमआई)\b/gi,
  /\b(land\s+fraud|plot\s+fraud|fake\s+registry|mutation|dakhil\s+kharij|khatiyan|circle\s+officer|revenue\s+court|cnt\s+act|raiyati|jamabandi|encumbrance|zameen|जमीन\s+धोखाधड़ी|रजिस्ट्री)\b/gi,
  /\b(partition\s+suit|ancestral\s+property|coparcener|daughter\s+share|section\s+6\s+hsa|vineeta\s+sharma|intestate|without\s+a\s+will|बंटवारा|पैतृक\s+संपत्ति)\b/gi,
  /\b(temporary\s+injunction|order\s+39|stay\s+on\s+sale|lis\s+pendens|section\s+52\s+tpa|स्टे\s+ऑर्डर|रोक)\b/gi,
  /\b(tenancy|landlord|tenant|eviction|security\s+deposit|rent\s+agreement|किरायेदार|मकान\s+मालिक)\b/gi,
  /\b(written\s+statement|order\s+viii\s+rule\s+1|30\s+days|90\s+days|120\s+days|civil\s+suit|plaint|prayer\s+clause)\b/gi,
  /\b(settlement\s+trap|out\s+of\s+court\s+settlement|compromise\s+decree|lok\s+adalat|post\s+dated\s+cheque|समझौता)\b/gi,

  // 40..47: Consumer Disputes, Pecuniary Slabs & Sectoral Ombudsmen
  /\b(consumer\s+protection|defective\s+product|warranty\s+refused|service\s+centre|job\s+sheet|nch\b|1915|ingram|e-?jagriti|उपभोक्ता)\b/gi,
  /\b(pecuniary\s+jurisdiction|district\s+commission|state\s+commission|ncdrc|50\s+lakh|2\s+crore|rule\s+7\s+fee|5\s+lakh\s+free)\b/gi,
  /\b(written\s+version|45\s+days|30\s+days\s+plus\s+15|hilli\s+multipurpose|section\s+38\(2\)\(a\)|forfeit\s+right)\b/gi,
  /\b(adjournment|delaying\s+evidence|section\s+38\(7\)|90\s+days\s+disposal|close\s+evidence|ex-?parte)\b/gi,
  /\b(rbi\s+ombudsman|banking\s+ombudsman|unauthorized\s+debit|chargeback|wrong\s+deduction|credit\s+card\s+dispute)\b/gi,
  /\b(insurance\s+ombudsman|claim\s+rejected|health\s+insurance|motor\s+insurance|bima\s+bharosa|irdai)\b/gi,
  /\b(airline|flight\s+cancelled|baggage\s+lost|airsewa|dgca|telecom|electricity\s+bill)\b/gi,
  /\b(dlsa\b|victim\s+compensation|section\s+396\s+bnss|357a\s+crpc|free\s+legal\s+aid|विधिक\s+सेवा\s+प्राधिकरण)\b/gi,

  // 48..55: Cheque Bounce (NI Act s.138), MSME, Service/Freelance Contracts & Labour
  /\b(section\s+138|ni\s+act|cheque\s+bounce|cheque\s+dishonour|return\s+memo|insufficient\s+funds|30\s+days\s+notice|15\s+days\s+payment|चेक\s+बाउंस)\b/gi,
  /\b(section\s+142\(2\)\(a\)|payee\s+bank\s+branch|section\s+139\s+presumption|section\s+143a\s+interim\s+compensation)\b/gi,
  /\b(website\s+client|freelance|software\s+project|scope\s+of\s+work|milestone|partial\s+delivery|quantum\s+meruit|section\s+70\s+contract\s+act|unfair\s+refund\s+demand)\b/gi,
  /\b(unpaid\s+salary|forced\s+to\s+resign|forced\s+resignation|non-?compete|notice\s+period|posh|internal\s+committee|relieving\s+letter|full\s+and\s+final|samadhan|labour\s+commissioner|gratuity|pf\b)\b/gi,
  /\b(msme\s+samadhaan|udyam|msefc|arbitration\s+clause|arbitrator|arbitral\s+award|delayed\s+payment\s+to\s+vendor|45\s+days\s+msme|compound\s+interest\s+3\s+times)\b/gi,
  /\b(traffic\s+challan|road\s+accident|motor\s+accident|accident\s+claim|mact|hit\s+and\s+run|e-?challan|virtual\s+court|parivahan|helmet|overspeeding|motor\s+vehicles\s+act)\b/gi,
  /\b(company\s+incorporation|gst\s+notice|show\s+cause\s+notice|drc-?01|section\s+148a\s+notice|income\s+tax\s+notice|reassessment|opc\b|one\s+person\s+company|private\s+limited|llp\b|roc\s+notice|inc-?20a|section\s+10a|strike\s+off|section\s+248)\b/gi,
  /\b(RTI\b|right\s+to\s+information|public\s+authority|pio\b|first\s+appeal)\b/gi,

  // 56..63: Evidence, NDPS, Constitutional Writs & Court Procedure
  /\b(ndps|tofan\s+singh|tufan\s+singh|section\s+67\s+ndps|section\s+53\s+ndps|section\s+37\s+ndps|confession\s+to\s+police|section\s+23\s+bsa|section\s+25\s+evidence)\b/gi,
  /\b(electronic\s+evidence|whatsapp\s+chat|cctv\s+footage|call\s+recording|section\s+63\s+bsa|section\s+65b|arjun\s+panditrao)\b/gi,
  /\b(article\s+12|state\s+instrumentality|fundamental\s+rights|article\s+226|article\s+32|writ\s+petition|bcci|zee\s+telefilms|ajay\s+hasia)\b/gi,
  /\b(quashing|section\s+528\s+bnss|section\s+482\s+crpc|discharge|section\s+250\s+bnss|bhajan\s+lal)\b/gi,
  /\b(burden\s+of\s+proof|beyond\s+reasonable\s+doubt|preponderance\s+of\s+probabilities|weighing\s+of\s+evidence|section\s+104\s+bsa)\b/gi,
  /\b(priyanka\s+srivastava|affidavit\s+mandatory|magistrate\s+direction\s+175\(3\))\b/gi,
  /\b(limitation\s+period|condonation\s+of\s+delay|section\s+5\s+limitation\s+act|section\s+69\s+cpa)\b/gi,
  /\b(execution\s+petition|order\s+21\s+cpc|section\s+71\s+cpa|section\s+72\s+cpa|recovery\s+certificate)\b/gi
];

function fnv1aHash(str, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Computes a deterministic 384-dimensional L2-normalized Float32 semantic embedding vector.
 * - Dims 0..63: Multilingual Legal Concept Anchor activations (weighted 2.5x for cross-lingual semantic alignment)
 * - Dims 64..383: Signed random-projection subword/trigram + word-stem features
 */
export function computeSemanticEmbedding384(text = '') {
  const vec = new Float32Array(EMBEDDING_DIM);
  const raw = String(text || '').toLowerCase().trim();
  if (!raw) return vec;

  // 1. Concept Anchor Activations (Dims 0..63)
  for (let i = 0; i < MULTILINGUAL_LEGAL_CONCEPT_ANCHORS.length && i < 64; i++) {
    const matches = raw.match(MULTILINGUAL_LEGAL_CONCEPT_ANCHORS[i]);
    if (matches && matches.length > 0) {
      vec[i] = 2.4 * (1 + Math.log1p(matches.length));
    }
  }

  // 2. Token + Stem + Character Trigram Signed Projection (Dims 64..383)
  const cleanTokens = raw
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);

  for (let tIdx = 0; tIdx < cleanTokens.length; tIdx++) {
    const tok = cleanTokens[tIdx];
    const stem = tok.length > 5 ? tok.slice(0, tok.length - 2) : tok;

    // Project word & stem
    const hWord = fnv1aHash(tok);
    const dimWord = 64 + (hWord % (EMBEDDING_DIM - 64));
    const signWord = (hWord & 1) === 0 ? 1.0 : -1.0;
    vec[dimWord] += signWord * 1.25;

    const hStem = fnv1aHash(`stem:${stem}`);
    const dimStem = 64 + (hStem % (EMBEDDING_DIM - 64));
    const signStem = (hStem & 1) === 0 ? 1.0 : -1.0;
    vec[dimStem] += signStem * 0.9;

    // Bigram phrase projection
    if (tIdx + 1 < cleanTokens.length) {
      const bigram = `${stem}_${cleanTokens[tIdx + 1].slice(0, 5)}`;
      const hBi = fnv1aHash(bigram);
      const dimBi = 64 + (hBi % (EMBEDDING_DIM - 64));
      const signBi = (hBi & 1) === 0 ? 1.0 : -1.0;
      vec[dimBi] += signBi * 1.1;
    }

    // Character trigrams for fuzzy/transliterated matching
    const padded = `^${tok}$`;
    for (let c = 0; c <= padded.length - 3; c++) {
      const tri = padded.slice(c, c + 3);
      const hTri = fnv1aHash(`tri:${tri}`);
      const dimTri = 64 + (hTri % (EMBEDDING_DIM - 64));
      const signTri = (hTri & 1) === 0 ? 1.0 : -1.0;
      vec[dimTri] += signTri * 0.35;
    }
  }

  // L2 Normalization
  let normSq = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    normSq += vec[i] * vec[i];
  }
  if (normSq > 0) {
    const invNorm = 1.0 / Math.sqrt(normSq);
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vec[i] *= invNorm;
    }
  }
  return vec;
}

export function cosineSimilarity384(vecA, vecB) {
  let dot = 0;
  const len = Math.min(vecA.length, vecB.length, EMBEDDING_DIM);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

function float32ToBuffer(vec) {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

function bufferToFloat32(buf) {
  if (!buf || buf.byteLength < EMBEDDING_DIM * 4) return new Float32Array(EMBEDDING_DIM);
  const copy = Buffer.from(buf);
  return new Float32Array(copy.buffer, copy.byteOffset, EMBEDDING_DIM);
}

/**
 * Comprehensive Seed Catalog of BNS / BNSS First Schedule, BSA, CPA, RERA, PWDVA, CPC & NI Act Sections
 * Grouped into `chapter_cluster` families so retrieving one section automatically pulls adjacent
 * lower/higher degree sections (e.g. s.303 Theft <-> s.304 Snatching <-> s.309 Robbery + s.497/503 BNSS Jimmanama).
 */
export const STATUTORY_PROVISIONS_SEED = [
  // === CLUSTER 1: BNS CHAPTER XVII — THEFT, SNATCHING, ROBBERY & PROPERTY RECOVERY ===
  {
    id: 'bns-303-theft',
    act: 'Bharatiya Nyaya Sanhita (BNS), 2023 & BNSS First Schedule',
    section: 'Section 303(2) BNS (formerly Section 379 IPC)',
    legacyEquivalent: 'Section 378 / 379 IPC',
    chapterCluster: 'bns-property-theft-snatching-robbery',
    title: 'Theft & Proviso for Petty Theft Below ₹5,000',
    ingredients: 'Dishonestly moving movable property out of the possession of any person without that person\'s consent (chori, चोरी, stolen item, pickpocket). Under Section 303(2) Proviso, if the value of stolen property is less than ₹5,000 and it is a first conviction, it is punishable with community service upon restoration of property.',
    cognizable: 'Cognizable (EXCEPT where stolen property value is < ₹5,000 on first conviction, which is NON-COGNIZABLE under BNSS First Schedule)',
    bailable: 'Non-Bailable (Bailable if value < ₹5,000 first conviction)',
    maxPunishment: 'Up to 3 years + fine (or Community Service if < ₹5,000 first conviction)',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'Practitioner Check: Compare (1) whether property was taken without consent (s.303 Theft) vs voluntarily entrusted (s.314/316 Misappropriation/CBT), and (2) whether sudden force/jerk from body was used (escalates to s.304 Snatching, which is ALWAYS cognizable even below ₹5,000) or hurt/push/threat was caused (escalates to s.309(4)/(6) Robbery — 10 yrs to Life).'
  },
  {
    id: 'bns-304-snatching',
    act: 'Bharatiya Nyaya Sanhita (BNS), 2023 & BNSS First Schedule',
    section: 'Section 304 BNS (New Dedicated Offence in BNS)',
    legacyEquivalent: 'Previously prosecuted under Section 379 / 356 / 392 IPC',
    chapterCluster: 'bns-property-theft-snatching-robbery',
    title: 'Snatching (Chain Snatching, Mobile Snatching, Sudden/Forcible Seizure)',
    ingredients: 'Theft is "Snatching" if, in order to commit theft, the offender suddenly or quickly or forcibly seizes or secures or grabs or takes away from any person or from his possession any movable property (chain snatching, gold chain pulled from neck, mobile snatched on bike, झपटमारी, चेन स्नैचिंग).',
    cognizable: 'Cognizable (Regardless of value — the < ₹5,000 petty theft exception does NOT apply to Section 304 Snatching)',
    bailable: 'Non-Bailable',
    maxPunishment: 'Up to 3 years imprisonment + fine',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'CRITICAL TRIAL LAWYER CHECK (Section 304 Snatching [3 yrs] vs. Section 309(4)/(6) Robbery [10 yrs / Life]): Because Section 304 BNS carries only up to 3 years (<= 7 years), an accused booked ONLY under s.304 BNS can claim Arnesh Kumar / Section 35(3) BNSS notice benefits. Always check: did the snatcher cause ANY neck scratch/injury, push/drag the victim, or put the victim in fear of instant hurt? If YES, get an immediate Government Hospital MLC (Medico-Legal Case) report and insist on adding Section 309(4) BNS (Robbery — up to 10 years RI, or 14 years on a highway between sunset and sunrise) or Section 309(6) BNS (Voluntarily causing hurt in committing robbery — up to Life Imprisonment / 10 years RI), which crosses the 7-year line and bars automatic Section 35(3) BNSS notice! Never let the Thana downgrade a chain snatching to a "Sanha / गुमशुदगी (Lost Report)".'
  },
  {
    id: 'bns-309-robbery',
    act: 'Bharatiya Nyaya Sanhita (BNS), 2023 & BNSS First Schedule',
    section: 'Section 309(4) & Section 309(6) BNS (formerly Sections 392 & 394 IPC)',
    legacyEquivalent: 'Sections 390 / 392 / 394 IPC',
    chapterCluster: 'bns-property-theft-snatching-robbery',
    title: 'Robbery & Voluntarily Causing Hurt in Committing Robbery',
    ingredients: 'Theft becomes Robbery (Section 309 BNS) if, in order to the committing of the theft, or in committing the theft, or in carrying away property obtained by the theft, the offender voluntarily causes or attempts to cause to any person death or hurt or wrongful restraint, or fear of instant death/hurt/wrongful restraint (chain snatching with neck injury/ bruise/ push/ fall from vehicle/ knife/ weapon).',
    cognizable: 'Cognizable',
    bailable: 'Non-Bailable',
    maxPunishment: 'Section 309(4): Rigorous imprisonment up to 10 years + fine (up to 14 years if committed on a highway between sunset and sunrise). Section 309(6) (if hurt is caused): Imprisonment for Life, or Rigorous Imprisonment up to 10 years + fine.',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'Because punishment is 10 years to Life (> 7 years), Arnesh Kumar / Section 35(3) BNSS notice does NOT apply—police have full custodial arrest power. Ensure any physical scratch, fall, or threat during snatching is documented in the first written complaint and hospital MLC.'
  },
  {
    id: 'bnss-497-503-jimmanama-tip',
    act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023',
    section: 'Sections 497 & 503 BNSS + Section 54 BNSS (formerly Sections 451 / 457 & 54A CrPC)',
    legacyEquivalent: 'Sections 451 & 457 CrPC (Sunderbhai Ambalal Desai v. State of Gujarat)',
    chapterCluster: 'bns-property-theft-snatching-robbery',
    title: 'Release of Recovered Chain/Valuables on Jimmanama (Supurdari) & TIP (Test Identification Parade)',
    ingredients: 'When stolen/snatched gold chain, jewellery, vehicle, or cash is recovered by police during investigation: (1) Test Identification Parade (TIP) of property/accused is conducted before a Magistrate under Section 54 BNSS; (2) Interim custody/release of the recovered article to the rightful owner on executing an indemnity bond (Jimmanama / Supurdari / सुपुर्दगी) under Section 497 / 503 BNSS within 14–30 days per Sunderbhai Ambalal Desai ((2002) 10 SCC 283) after panchnama and photography.',
    cognizable: 'Procedural Remedy (Criminal Magistrate Court)',
    bailable: 'N/A',
    maxPunishment: 'N/A — Court Release Order on Jimmanama / Indemnity Bond',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'In Ranchi, Patna, and across trial courts, lawyers file a "Jimmanama / Supurdari Petition" under Section 497/503 BNSS attaching the goldsmith invoice/GST bill, weight/hallmark details, or family photographs wearing the chain so the jewellery does not sit in the Malkhana until the end of trial.'
  },

  // === CLUSTER 2: ENTRUSTMENT, MISAPPROPRIATION, BREACH OF TRUST & CHEATING ===
  {
    id: 'bns-314-316-cbt-misappropriation',
    act: 'Bharatiya Nyaya Sanhita (BNS), 2023 & BNSS First Schedule',
    section: 'Section 314 BNS (Misappropriation) & Section 316(2) BNS (Criminal Breach of Trust)',
    legacyEquivalent: 'Sections 403 & 406 IPC',
    chapterCluster: 'bns-property-entrustment-cheating',
    title: 'Dishonest Misappropriation & Criminal Breach of Trust (Voluntary Handover / Streedhan / Entrusted Property)',
    ingredients: 'Where property, money, jewellery (including wife\'s streedhan), or vehicle was VOLUNTARILY handed over or entrusted to another person in trust or for safekeeping (अमानत, गहने रखने के लिए दिया था, वापस नहीं कर रहा, rakhne ke liye diya, wapas nahi kar raha), and that person dishonestly misappropriates, converts to his own use, or refuses to return it.',
    cognizable: 'Section 316(2) BNS (CBT): Cognizable | Section 314 BNS (Misappropriation): Non-Cognizable',
    bailable: 'Section 316(2) BNS: Non-Bailable | Section 314 BNS: Bailable',
    maxPunishment: 'Section 316(2) BNS: Up to 5 years + fine (increased from 3 years in old IPC 406). Section 314 BNS: Up to 2 years + fine.',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'Laymen frequently call unreturned entrusted items "Chori (Theft)". Explain clearly that because the item was handed over with consent, Section 303 Theft does not apply—frame the complaint under Section 316(2) BNS (Criminal Breach of Trust) so it is Cognizable.'
  },
  {
    id: 'bns-318-cheating-vs-civil',
    act: 'Bharatiya Nyaya Sanhita (BNS), 2023 & BNSS First Schedule',
    section: 'Section 318(4) BNS (formerly Section 420 IPC)',
    legacyEquivalent: 'Sections 415 & 420 IPC',
    chapterCluster: 'bns-property-entrustment-cheating',
    title: 'Cheating and Dishonestly Inducing Delivery of Property vs. Civil Breach of Contract',
    ingredients: 'Deceiving any person with fraudulent or dishonest intention AT THE VERY INCEPTION of the transaction and thereby inducing delivery of money or property. Distinguished from mere subsequent failure to fulfill a contract (which is a Civil Breach under Section 73 Indian Contract Act).',
    cognizable: 'Cognizable (Subject to Section 173(3) BNSS 14-day Preliminary Inquiry in commercial/business disputes)',
    bailable: 'Non-Bailable',
    maxPunishment: 'Up to 7 years imprisonment + fine',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'To prevent police from rejecting a cheating complaint as a "civil money recovery matter", the complaint must specifically plead facts showing dishonest intention from Day 1 (e.g., seller had no title when taking booking money, issued a cheque from a closed account at inception, or immediately diverted funds).'
  },

  // === CLUSTER 3: POLICE FIR REGISTRATION, PRELIMINARY INQUIRY & MAGISTRATE DIRECTION (BNSS CH. XII) ===
  {
    id: 'bnss-173-fir-and-preliminary-inquiry',
    act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023',
    section: 'Section 173(1), 173(3) & 173(4) BNSS + Section 175(3) BNSS (formerly Sections 154 & 156(3) CrPC)',
    legacyEquivalent: 'Sections 154(1), 154(3) & 156(3) CrPC (Lalita Kumari & Priyanka Srivastava)',
    chapterCluster: 'bnss-fir-inquiry-escalation',
    title: 'Mandatory FIR, Zero FIR, e-FIR, 14-Day Preliminary Inquiry (s.173(3)), and SP/Magistrate Escalation',
    ingredients: 'Every information relating to the commission of a cognizable offence, irrespective of territorial jurisdiction (Zero FIR) or filed electronically (e-FIR signed within 3 days), must be registered under Section 173(1) BNSS and a free copy given under Section 173(2). Exception under Section 173(3) BNSS: for offences punishable with 3 years or more but less than 7 years, the officer in charge may, with prior permission from an officer not below the rank of Deputy Superintendent of Police (DSP/ACP), conduct a Preliminary Inquiry within 14 days to ascertain whether a prima facie case exists.',
    cognizable: 'Procedural Mandate',
    bailable: 'N/A',
    maxPunishment: 'Departmental & statutory accountability for unlawful refusal',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'Practitioner Ladder: (1) Hand over a written complaint setting out cognizable ingredients and obtain a DD/GD receiving stamp; (2) If the offence is 3–7 years, ask if DSP permission was taken for a 14-day s.173(3) BNSS inquiry; (3) If refused, send the complaint + receiving proof by Registered/Speed Post to the SP/SSP under Section 173(4) BNSS; (4) File an application before the Judicial Magistrate under Section 175(3) BNSS accompanied by a mandatory sworn affidavit (Priyanka Srivastava v. State of UP).'
  },

  // === CLUSTER 4: OFFENCES AGAINST BODY — ASSAULT, HURT, GRIEVOUS HURT & INTIMIDATION ===
  {
    id: 'bns-115-117-126-130-351-body-hurt',
    act: 'Bharatiya Nyaya Sanhita (BNS), 2023 & BNSS First Schedule',
    section: 'Sections 115(2), 117(2), 118, 126(2), 130 & 351(2)/(3) BNS',
    legacyEquivalent: 'Sections 323, 324, 325, 341, 351 & 506 IPC',
    chapterCluster: 'bns-body-assault-hurt-intimidation',
    title: 'Assault (Gesture) vs. Simple Hurt vs. Grievous Hurt / Weapon Hurt & Wrongful Restraint',
    ingredients: 'Section 130 BNS (Assault — threatening gesture without touch, non-cognizable); Section 115(2) BNS (Voluntarily causing simple hurt — up to 1 yr, Non-Cognizable & Bailable by itself); Section 126(2) BNS (Wrongful restraint — stopping someone\'s path, Cognizable & Bailable); Section 117(2) BNS (Grievous hurt — fracture/permanent injury/15 days severe pain, Cognizable, up to 7 yrs); Section 118 BNS (Hurt by dangerous weapon/rod/knife — Cognizable & Non-Bailable); Section 351(3) BNS (Threat to cause death/grievous hurt — up to 7 yrs).',
    cognizable: 'Simple Hurt s.115(2) alone is Non-Cognizable; becomes COGNIZABLE when coupled with Wrongful Restraint (s.126(2)), Weapon (s.118), Grievous Hurt (s.117), or House Trespass (s.333)',
    bailable: 'Bailable for s.115(2)/s.126(2); Non-Bailable for s.118(2) grievous hurt by weapon',
    maxPunishment: '1 year (s.115(2)) to 7–10 years (s.117/118/351(3))',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'CRITICAL PRACTITIONER INSIGHT: Simple hurt (Section 115(2) BNS / old s.323 IPC) by itself is Non-Cognizable, so police often record only an NCR! However, if the attacker blocked your way/stopped your vehicle (Wrongful Restraint — Section 126(2) BNS, which IS Cognizable) or used a blunt object/weapon (Section 118 BNS) or entered your premises (Section 333 BNS), the entire case becomes Cognizable under Section 174(4) BNSS! Always get a Government Hospital MLC immediately.'
  },

  // === CLUSTER 5: MATRIMONIAL CRUELTY, DOMESTIC VIOLENCE, STREEDHAN & MAINTENANCE ===
  {
    id: 'bns-85-pwdva-12-bnss-144-matrimonial',
    act: 'BNS 2023, PWDVA 2005, BNSS 2023 & Hindu Marriage Act 1955',
    section: 'Section 85 BNS (498A IPC) · Section 12 PWDVA (ss.18–21) · Section 144 BNSS (125 CrPC) · Section 9 HMA',
    legacyEquivalent: 'Section 498A IPC & Section 125 CrPC',
    chapterCluster: 'matrimonial-dv-cruelty-reconciliation',
    title: 'Matrimonial Triage: Reconciliation (s.9 HMA) vs. Civil DV Shield (s.12 PWDVA) vs. Criminal Cruelty (s.85 BNS)',
    ingredients: '(1) Minor domestic quarrel / spouse not calling back where client wants marriage restored -> Family Counselling / Mediation or Section 9 HMA Restitution of Conjugal Rights (NEVER file a criminal FIR if reconciliation is the goal); (2) Lockout from matrimonial home, need for shelter, return of streedhan/jewellery/passport, maintenance, or child custody -> Single-Window Application to Judicial Magistrate under Section 12 PWDVA, 2005 (s.18 Protection Order by Magistrate ONLY, s.19 Residence, s.19(8) Streedhan return, s.20 Monetary relief, s.21 Custody) + Section 144 BNSS Maintenance; (3) Severe dowry harassment / physical cruelty -> Section 85 BNS (Cognizable, NON-BAILABLE, max 3 yrs, Arnesh Kumar / s.35(3) BNSS Notice of Appearance applies).',
    cognizable: 'Section 85 BNS: Cognizable | Section 12 PWDVA & Section 144 BNSS: Civil/Quasi-Criminal Magistrate Petitions',
    bailable: 'Section 85 BNS: NON-BAILABLE (subject to Section 35(3) BNSS Arnesh Kumar notice shield)',
    maxPunishment: 'Section 85 BNS: Up to 3 years + fine',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'Always probe the client\'s true situation and goal first: do not turn a routine marital argument into a criminal 498A/BNS 85 war, and conversely never advise Section 9 HMA (Restitution) when a woman is locked out and needs emergency shelter or streedhan recovery under Section 12 read with Section 19(8) PWDVA.'
  },

  // === CLUSTER 6: PROPERTY / BUILDER DELAY (RERA vs CONSUMER) & PARALLEL BANK LOAN TRAP ===
  {
    id: 'rera-18-31-consumer-pecuniary-bank-loan',
    act: 'RERA Act, 2016 & Consumer Protection Act, 2019',
    section: 'Sections 18(1), 31 & 36 RERA Act · CPA 2019 (2021 Pecuniary Rules & Rule 7 Fees)',
    legacyEquivalent: 'Imperia Structures v. Anil Patni & Newtech Promoters v. State of UP',
    chapterCluster: 'property-rera-bank-loan-trap',
    title: 'Concurrent RERA & Consumer Remedies + Parallel Bank Home Loan / Tripartite Protection',
    ingredients: 'Homebuyer facing builder possession delay, arbitrary escalation demand, or defective land/flat title. RERA and Consumer Commission remedies are concurrent. Staying in project for possession + monthly interest lies before RERA Regulatory Authority (ss.18(1) & 31 + s.36 interim stay). Consumer Pecuniary Jurisdiction (by amount PAID): District up to ₹50L (₹0 fee only up to ₹5L); State above ₹50L to ₹2Cr (₹2,000–₹2,500 fee); National above ₹2Cr.',
    cognizable: 'Civil / Statutory Tribunal',
    bailable: 'N/A',
    maxPunishment: 'Refund/Possession with prescribed interest + Section 63/64 RERA penalties',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'BHU Legal Aid / Jamtara Practitioner Rule: If the buyer took a Bank Home Loan, the bank\'s EMI / SARFAESI / s.138 ECS recovery runs independently even if the builder defrauded the buyer! Always check the Tripartite Agreement / RBI Housing Finance rules against upfront disbursal without construction milestones, put the Bank on written notice, and include an explicit Prayer clause covering the bank/tripartite liability + interest + costs.'
  },

  // === CLUSTER 7: CHEQUE BOUNCE (NI ACT SECTION 138 & 142) ===
  {
    id: 'ni-act-138-139-142-143a',
    act: 'Negotiable Instruments Act, 1881',
    section: 'Sections 138, 139, 142(2)(a) & 143A NI Act',
    legacyEquivalent: 'NI Act 1881 (as amended in 2015 & 2018)',
    chapterCluster: 'ni-act-cheque-dishonour',
    title: 'Cheque Dishonour Strict 30+15+30 Day Clock, Reverse Burden (s.139) & Payee Bank Branch Jurisdiction',
    ingredients: '(1) Cheque presented within 3-month validity; (2) Written statutory demand notice dispatched within 30 days of Bank Return Memo receipt; (3) 15-day cure period from receipt of notice; (4) Complaint filed within 30 days after expiry of the 15-day period before the Magistrate having jurisdiction over the PAYEE\'S bank branch (Section 142(2)(a)); (5) Section 139 raises a statutory presumption in favour of the holder; (6) Section 143A allows up to 20% interim compensation.',
    cognizable: 'Non-Cognizable (Private Criminal Complaint before Magistrate)',
    bailable: 'Bailable',
    maxPunishment: 'Up to 2 years imprisonment, or fine up to twice the cheque amount, or both',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'If the 30-day demand notice window from the Return Memo is missed and the cheque is still within its 3-month validity, the payee can re-present the cheque to generate a fresh Return Memo and fresh 30-day clock; if validity expired, pursue a Summary Suit under Order 37 CPC / MSME Samadhaan / Section 318 BNS if dishonest from inception.'
  },

  // === CLUSTER 8: CYBER ACCOUNT FREEZE (BNSS s.106), SECTION 69 BNS FALSE PROMISE DEFENCE & MARITAL EXCEPTION ===
  {
    id: 'bns-69-false-promise-and-s63-marital-exception',
    act: 'Bharatiya Nyaya Sanhita (BNS), 2023 & BNSS, 2023',
    section: 'Section 69 BNS (Deceitful Means / False Promise to Marry) · Section 63 Exception 2 BNS (Marital Exception) · Sections 482 & 528 BNSS',
    legacyEquivalent: 'Sections 376 / 90 IPC & Exception 2 to Section 375 IPC (Pramod Suryabhan Pawar v. State of Maharashtra, (2019) 9 SCC 608)',
    chapterCluster: 'bns-69-false-promise-and-marital-defence',
    title: 'Defence Against False Section 69 BNS (False Promise to Marry) & Section 63 Exception 2 Marital Context',
    ingredients: '(1) Section 69 BNS penalises sexual intercourse (not amounting to rape) by deceitful means or making a promise to marry WITHOUT ANY INTENTION OF FULFILLING IT AT INCEPTION (Cognizable, Non-Bailable, up to 10 years—so Section 35(3) BNSS Arnesh Kumar notice does NOT automatically apply; immediate Section 482 BNSS Anticipatory Bail is critical); (2) Under Supreme Court law (Pramod Suryabhan Pawar (2019) 9 SCC 608, Sonu @ Subhash Kumar 2021, Naim Ahamed 2023), a "breach of a genuine promise to marry" after a consensual relationship (due to family/caste opposition or incompatibility) is NOT a "false promise to marry from Day 1" and is liable to be quashed under Section 528 BNSS; (3) If the parties are legally married and the wife is >= 18 years of age, Exception 2 to Section 63 BNS bars a charge of rape under s.63/64 BNS, and Section 69 BNS (promise to marry) is legally inapplicable once marriage has already taken place!',
    cognizable: 'Cognizable (Up to 10 years — Immediate Section 482 BNSS Anticipatory Bail required)',
    bailable: 'Non-Bailable',
    maxPunishment: 'Up to 10 years imprisonment + fine',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'SENIOR DEFENCE COUNSEL PROTOCOL: (1) Distinguish whether the parties are already married (where neither s.69 BNS "promise to marry" nor s.63 BNS rape applies if the wife is >=18 yrs per Exception 2 to s.63 BNS) vs. an unmarried couple after a breakup; (2) Because s.69 BNS carries 10 years (> 7 yrs), do NOT wait for a Section 35(3) BNSS notice—move immediately for Section 482 BNSS Anticipatory Bail before the Sessions/High Court; (3) Preserve all WhatsApp chats, photos, travel/hotel records, family-talk messages, and any extortion/blackmail threats with a Section 63 BSA certificate; (4) File a Section 528 BNSS High Court Quashing Petition citing Pramod Suryabhan Pawar v. State of Maharashtra, (2019) 9 SCC 608.'
  },
  {
    id: 'bnss-106-cyber-bank-account-freeze',
    act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023',
    section: 'Section 106 & Section 107 BNSS + Section 497/503 BNSS (formerly Section 102 & 451/457 CrPC)',
    legacyEquivalent: 'Section 102 CrPC (Cyber Cell Lien / Debit Freeze on Bank Account)',
    chapterCluster: 'cyber-bank-freeze-unfreeze',
    title: 'Bank Account Debit Freeze / Lien by Cyber Cell on P2P / UPI Layer Transaction',
    ingredients: 'When a bank account is suddenly debit-frozen or placed under a hold/lien due to a 1930 NCRP cyber complaint (Layer 2 / Layer 3 / P2P / merchant receipt): Police frequently issue a blanket notice under Section 106 BNSS (old s.102 CrPC) freezing the entire bank account instead of placing a lien only on the disputed transaction amount.',
    cognizable: 'Procedural Seizure / Defreeze Remedy',
    bailable: 'N/A',
    maxPunishment: 'N/A — Defreeze Application under Section 497/503 BNSS or High Court Writ under Article 226',
    arneshKumarApplies: 1,
    practitionerEscalationNote: 'Practitioner Unfreeze Protocol: (1) Obtain the exact NCRP Acknowledgement Number, Investigating Officer (IO) contact, and disputed Layer amount from your home bank branch; (2) Under High Court precedents, police cannot freeze an entire operational bank account for a small disputed credit—ask the bank/IO to convert a total debit freeze into a "Lien Marked ONLY on the Disputed Amount" upon furnishing KYC and invoice/proof of bona fide sale, or file an application before the jurisdictional Magistrate under Section 497/503 BNSS (or High Court Article 226 Writ).'
  },

  // === CLUSTER 15: RENT AGREEMENTS, LEASES & LEAVE AND LICENCE ===
  {
    id: 'tenancy-rent-agreement-registration',
    act: 'Transfer of Property Act 1882, Registration Act 1908, Indian Stamp Act 1899 / State Stamp Acts & State Rent Acts',
    section: 'Sections 105–107 TPA · Sections 17(1)(d) & 49 Registration Act · State Stamp Act · Section 55 Maharashtra Rent Control Act',
    legacyEquivalent: 'Model Tenancy Act 2021 (adopted in modified form by some States, e.g., U.P. 2021, Tamil Nadu 2017)',
    chapterCluster: 'tenancy-rent-agreement',
    title: 'Drafting a Rent Agreement / Lease / Leave & Licence: Registration, Stamp Duty and Key Clauses',
    ingredients: 'A lease transfers a right to enjoy immovable property for rent (Section 105 TPA). A lease from year to year or for more than one year can be made only by a registered instrument (Section 107 TPA; Section 17(1)(d) Registration Act); an unregistered one cannot be relied on to prove its terms (Section 49 Registration Act), which is why 11-month rent agreements are common. Stamp duty is payable under the State Stamp Act. In Maharashtra every leave and licence agreement must be registered (Section 55 Maharashtra Rent Control Act). Key clauses: parties, property description, term, rent and escalation, security deposit and refund timeline, lock-in and notice period, maintenance and utilities, repairs, sub-letting, inventory, police verification, and termination.',
    cognizable: 'Civil / Documentation',
    bailable: 'N/A',
    maxPunishment: 'N/A',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'Confirm the State first (stamp duty, registration and any deposit cap), whether the term crosses one year, and whether the premises are residential or commercial. Write deposit-refund timing and deduction rules precisely; that clause causes most later disputes.'
  },

  // === CLUSTER 9: BANKING RECOVERY, SARFAESI, DRT & CREDIT REPORTS ===
  {
    id: 'sarfaesi-13-17-34-drt',
    act: 'SARFAESI Act, 2002 & Recovery of Debts and Bankruptcy Act, 1993',
    section: 'Sections 13(2), 13(3A), 13(4), 17 & 34 SARFAESI',
    legacyEquivalent: 'Mardia Chemicals v. Union of India, (2004) 4 SCC 311',
    chapterCluster: 'banking-sarfaesi-drt',
    title: 'Bank Possession / Auction of Mortgaged Home or Shop (SARFAESI) & DRT Challenge',
    ingredients: 'Bank declares the loan NPA and issues a 60-day demand notice under Section 13(2) SARFAESI; the borrower may object under Section 13(3A) and the bank must reply with reasons within 15 days; the bank then takes symbolic/physical possession or auctions under Section 13(4). The challenge lies to the Debts Recovery Tribunal under Section 17 within 45 days; civil courts are barred by Section 34.',
    cognizable: 'Civil / Tribunal remedy (DRT)',
    bailable: 'N/A',
    maxPunishment: 'N/A — Section 17 DRT order can set aside the measure and restore possession',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'Senior counsel checks: (1) was the 13(2) notice properly served and the 13(3A) objection answered with reasons; (2) is the asset agricultural land (excluded by Section 31(i)); (3) count 45 days from the 13(4) step and file in the DRT, not a civil court; (4) for recovery-agent harassment or CIBIL errors, use the RBI Integrated Ombudsman (cms.rbi.org.in) — RBI rules require credit-data complaints to be resolved in 30 days with ₹100/day compensation for delay.'
  },

  // === CLUSTER 10: EMPLOYMENT, WAGES, GRATUITY, NON-COMPETE & POSH ===
  {
    id: 'employment-gratuity-noncompete-posh',
    act: 'Payment of Gratuity Act 1972, Indian Contract Act 1872, POSH Act 2013, Payment of Wages Act 1936',
    section: 'Section 7(3A) Gratuity Act · Section 27 Contract Act · Section 9 POSH Act',
    legacyEquivalent: 'Percept D\'Mark v. Zaheer Khan, (2006) 4 SCC 227; Union Bank of India v. C.G. Ajay Babu, (2018) 9 SCC 529',
    chapterCluster: 'employment-labour',
    title: 'Unpaid Salary / Full & Final, Forced Resignation, Gratuity, Non-Compete and Workplace Harassment',
    ingredients: 'Gratuity is payable after 5 years of continuous service and must be paid within 30 days of becoming payable (Section 7(3A)), with interest for delay; forfeiture needs termination for proved misconduct of the kind in Section 4(6) (C.G. Ajay Babu). Post-employment non-compete restraints are void under Section 27 Contract Act. A resignation can be withdrawn before it takes effect. A POSH complaint goes to the Internal Committee within 3 months (extendable by 3).',
    cognizable: 'Civil / Statutory authority',
    bailable: 'N/A',
    maxPunishment: 'N/A — recovery of dues with interest; POSH inquiry outcomes',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'Before any demand notice, save appraisal letters, handover emails, attendance and asset-return acknowledgements so a retaliatory "absconding" allegation fails. Route gratuity to the Controlling Authority, wages of covered employees to the Labour Commissioner (SAMADHAN portal), and contractual dues of managerial staff to the civil/commercial court.'
  },

  // === CLUSTER 11: MOTOR ACCIDENT CLAIMS ===
  {
    id: 'mact-164-166-claims',
    act: 'Motor Vehicles Act, 1988 (as amended in 2019)',
    section: 'Sections 164, 166(3), 161 & 175 MV Act',
    legacyEquivalent: 'Sarla Verma v. DTC, (2009) 6 SCC 121; National Insurance v. Pranay Sethi, (2017) 16 SCC 680',
    chapterCluster: 'motor-accident-mact',
    title: 'Road Accident Death / Injury Compensation (MACT), Hit-and-Run and No-Fault Claims',
    ingredients: 'A compensation claim for death or injury in a road accident lies exclusively before the Motor Accident Claims Tribunal (Section 175). Section 166(3) requires the claim within 6 months of the accident. Section 164 gives fixed no-fault compensation (₹5 lakh death, ₹2.5 lakh grievous hurt); Section 161 covers hit-and-run (Solatium Scheme). Loss-of-income compensation follows the Sarla Verma multiplier and Pranay Sethi future-prospects method.',
    cognizable: 'Civil / Tribunal remedy (MACT); rash and negligent driving is separately an offence under Section 106 BNS',
    bailable: 'N/A',
    maxPunishment: 'N/A — compensation award paid by the insurer',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'Collect the FIR, the police Detailed Accident Report (DAR), post-mortem / MLC, hospital bills, income proof and the vehicle\'s insurance details. File inside 6 months; some High Courts are testing the 6-month limit, so do not rely on a later filing.'
  },

  // === CLUSTER 12: SENIOR CITIZENS, PARENTS AND PROPERTY GIFTED TO CHILDREN ===
  {
    id: 'senior-citizens-4-5-23',
    act: 'Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
    section: 'Sections 4, 5, 23 & 27',
    legacyEquivalent: 'S. Vanitha v. Deputy Commissioner, (2021) 15 SCC 730; Urmila Dixit v. Sunil Sharan Dixit (SC, 2025)',
    chapterCluster: 'senior-citizens',
    title: 'Elderly Parents: Monthly Maintenance from Children and Cancelling a Gift Deed Made on a Promise of Care',
    ingredients: 'A senior citizen or parent unable to maintain themselves can claim monthly maintenance (up to ₹10,000 as originally enacted, subject to State rules) from children or relatives before the Maintenance Tribunal (SDO) under Sections 4–5. Under Section 23, a property transfer made on the condition that the transferee will provide basic amenities and care can be declared void if that condition is broken. Civil courts are barred (Section 27).',
    cognizable: 'Summary Tribunal remedy',
    bailable: 'N/A',
    maxPunishment: 'N/A — maintenance order; transfer declared void; abandonment is an offence under Section 24',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'For Section 23, prove the care condition (in the deed or by surrounding circumstances) and its breach. Eviction orders must be balanced against a daughter-in-law\'s residence right under PWDVA (S. Vanitha). Apply through the SDO office with proof of age, the deed, and evidence of neglect.'
  },

  // === CLUSTER 13: MSME DUES & ARBITRATION ===
  {
    id: 'msme-15-18-arbitration',
    act: 'MSMED Act, 2006 & Arbitration and Conciliation Act, 1996',
    section: 'Sections 15, 16, 18 & 19 MSMED Act · Sections 8, 11 & 34 Arbitration Act',
    legacyEquivalent: 'Gujarat State Civil Supplies Corp. v. Mahakali Foods, (2023) 6 SCC 401; Perkins Eastman v. HSCC, (2020) 20 SCC 760',
    chapterCluster: 'msme-arbitration',
    title: 'Unpaid Invoices to a Registered MSME Supplier & Arbitration Clauses',
    ingredients: 'A buyer must pay a registered micro/small supplier within the agreed period, capped at 45 days (Section 15); delay attracts compound interest at three times the RBI bank rate (Section 16). The supplier can approach the MSE Facilitation Council (MSME Samadhaan) under Section 18, which overrides a private arbitration clause (Mahakali Foods). A buyer challenging an MSEFC award must deposit 75% (Section 19). A clause letting one party alone appoint the sole arbitrator is invalid (Perkins Eastman; CORE Constitution Bench, 2024).',
    cognizable: 'Civil / Statutory conciliation & arbitration',
    bailable: 'N/A',
    maxPunishment: 'N/A — award with compound interest',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'Confirm Udyam registration existed when the supply contract was made; attach invoices, POs, delivery proof and ledger. A Section 34 challenge to an arbitral award has a hard 3 months + 30 days limit.'
  },

  // === CLUSTER 14: TAX NOTICES, RTI & WRITS ===
  {
    id: 'gst-75-4-it-148a-rti-writ',
    act: 'CGST Act 2017, Income-tax Act 1961, RTI Act 2005 & Constitution of India',
    section: 'Section 75(4) CGST · Section 148A Income-tax Act · Sections 6, 7(1) & 19 RTI Act · Article 226',
    legacyEquivalent: 'Whirlpool Corp. v. Registrar of Trade Marks, (1998) 8 SCC 1',
    chapterCluster: 'tax-rti-writ',
    title: 'GST / Income-tax Show-Cause Notices, RTI Requests and High Court Writs',
    ingredients: 'Before an adverse GST order, a personal hearing must be given where requested or where an adverse decision is contemplated (Section 75(4) CGST). Income-tax reassessment requires the Section 148A procedure before a Section 148 notice. RTI: the public authority must reply within 30 days, or 48 hours where life or liberty is involved (Section 7(1) proviso), with first and second appeals under Section 19. A writ under Article 226 lies despite an alternative remedy where natural justice is breached or the authority lacks jurisdiction (Whirlpool).',
    cognizable: 'Administrative / Constitutional remedy',
    bailable: 'N/A',
    maxPunishment: 'N/A',
    arneshKumarApplies: 0,
    practitionerEscalationNote: 'Reply to every tax notice in writing within the stated time, ask for the personal hearing in the reply itself, and keep the acknowledgement. RTI cannot be used against private companies; use it only for public authorities.'
  }
];

export const DEFAULT_PRACTITIONER_LESSONS_SEED = [
  {
    id: 'lesson-ranchi-chain-snatching-304-vs-309',
    domain: 'criminal-bns-bnss',
    topic: 'Chain Snatching / Mobile Snatching (BNS s.304 vs s.309 Robbery & Jimmanama s.497/503 BNSS)',
    lessonText:
      'When a client reports chain snatching or mobile snatching: (1) Ask first when it happened, whether an FIR is registered or police asked for a "Sanha/missing report", and whether any neck injury/scratch, push, drag, or threat occurred; (2) Explain that while Section 304 BNS (Snatching) is cognizable regardless of value, it carries only 3 years (allowing s.35(3) BNSS notice), whereas if any hurt/scratch/push occurred, an immediate Government Hospital MLC escalates the charge to Robbery under Section 309(4) BNS (10 yrs) or Section 309(6) BNS (Life/10 yrs RI); (3) For recovered jewellery, mention TIP under Section 54 BNSS and release on Jimmanama / Supurdari under Sections 497/503 BNSS.',
    author: 'Lawyer Consultation & Ranchi Review'
  },
  {
    id: 'lesson-simple-hurt-115-plus-126-cognizable',
    domain: 'criminal-bns-bnss',
    topic: 'Physical Beating / Assault (Turning Non-Cognizable Simple Hurt s.115(2) BNS into Cognizable FIR)',
    lessonText:
      'When someone is beaten up (maar-peet), Section 115(2) BNS (Simple Hurt, old s.323 IPC) alone is Non-Cognizable, so Thana staff often refuse an FIR and write an NCR. A seasoned lawyer always asks: (a) Did they block your way or hold you (Wrongful Restraint — Section 126(2) BNS, which IS Cognizable)? (b) Did they use any stick/rod/stone/weapon (Section 118 BNS) or enter your house/shop (Section 333 BNS)? Under Section 174(4) BNSS, if even ONE offence in the incident is cognizable, the entire case must be registered as a Cognizable FIR!',
    author: 'Lawyer Consultation (cr1 & cr3)'
  },
  {
    id: 'lesson-matrimonial-argument-vs-498a',
    domain: 'matrimonial-family',
    topic: 'Filtering Minor Marital Quarrel (s.9 HMA / Mediation) vs. Lockout/Cruelty (s.12 PWDVA / s.85 BNS)',
    lessonText:
      'Never rush to recommend a criminal FIR (Section 85 BNS / 498A IPC) merely because a user types "dowry harassment" or "marital dispute". First ask whether there is physical violence, lockout, or retention of streedhan, OR whether it was a domestic argument where the client wants reconciliation (in which case Family Counselling or Section 9 HMA applies).',
    author: 'Lawyer Consultation (cr3 14:22)'
  },
  {
    id: 'lesson-builder-fraud-parallel-bank-loan',
    domain: 'property-rera',
    topic: 'Builder / Land Fraud with Parallel Bank Home Loan & Plaint Prayer Clause Audit',
    lessonText:
      'In any property, plot, or builder-delay case, always ask if a Bank Home Loan / EMI is running. Warn the client that bank recovery (SARFAESI / s.138 ECS bounce) runs independently of builder fraud, check Tripartite Agreement / RBI construction-linked disbursal rules, and ensure the petition\'s Prayer clause explicitly prays for principal/possession, interest, interim stay, tripartite bank relief, litigation costs, and omnibus relief.',
    author: 'Lawyer Consultation (cr2 BHU Legal Aid / Jamtara Case)'
  }
];

let indexDbInstance = null;
let indexDbPathActive = null;

function resolveIndexDbPath() {
  const dataDir = process.env.NYAYA_DATA_DIR || path.join(rootDir, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'nyaya-sessions.sqlite');
}

export function getSemanticIndexDb() {
  const targetPath = resolveIndexDbPath();
  if (indexDbInstance && indexDbPathActive === targetPath) {
    return indexDbInstance;
  }
  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS statutory_provisions (
      id TEXT PRIMARY KEY,
      act TEXT NOT NULL,
      section TEXT NOT NULL,
      legacy_equivalent TEXT NOT NULL,
      chapter_cluster TEXT NOT NULL,
      title TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      cognizable TEXT NOT NULL,
      bailable TEXT NOT NULL,
      max_punishment TEXT NOT NULL,
      arnesh_kumar_applies INTEGER NOT NULL DEFAULT 0,
      practitioner_escalation_note TEXT NOT NULL,
      embedding_dim INTEGER NOT NULL DEFAULT 384,
      embedding_json TEXT NOT NULL,
      embedding_blob BLOB NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS statutory_provisions_fts USING fts5(
      id UNINDEXED,
      section,
      title,
      ingredients,
      practitioner_escalation_note
    );

    CREATE TABLE IF NOT EXISTS practitioner_lessons (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      topic TEXT NOT NULL,
      lesson_text TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Super-Admin',
      embedding_dim INTEGER NOT NULL DEFAULT 384,
      embedding_json TEXT NOT NULL,
      embedding_blob BLOB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  seedIndexWhenSeedChanges(db);
  indexDbInstance = db;
  indexDbPathActive = targetPath;
  return db;
}

/**
 * Re-seeds the statutory index (and re-embeds stored lessons) only when the seed catalogue or the concept
 * anchors change, inside one IMMEDIATE transaction. Several processes (server, tests) can share this file,
 * so startup must not rewrite it every time.
 */
function seedIndexWhenSeedChanges(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  const seedVersion = crypto
    .createHash('sha256')
    .update(JSON.stringify(STATUTORY_PROVISIONS_SEED))
    .update(MULTILINGUAL_LEGAL_CONCEPT_ANCHORS.map(rx => rx.source).join('|'))
    .update(JSON.stringify(DEFAULT_PRACTITIONER_LESSONS_SEED))
    .digest('hex');
  const current = db.prepare(`SELECT value FROM index_meta WHERE key = 'seed_version'`).get();
  if (current?.value === seedVersion) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    // Another process may have finished seeding while we waited for the lock.
    const recheck = db.prepare(`SELECT value FROM index_meta WHERE key = 'seed_version'`).get();
    if (recheck?.value !== seedVersion) {
      seedStatutoryAndLessons(db);
      db.prepare(`INSERT INTO index_meta (key, value) VALUES ('seed_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(seedVersion);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedStatutoryAndLessons(db) {
  const now = new Date().toISOString();
  const seedIds = STATUTORY_PROVISIONS_SEED.map(s => s.id);
  db.prepare(`DELETE FROM statutory_provisions WHERE id NOT IN (${seedIds.map(() => '?').join(',')})`).run(...seedIds);
  const upsertProv = db.prepare(`
      INSERT INTO statutory_provisions (
        id, act, section, legacy_equivalent, chapter_cluster, title, ingredients,
        cognizable, bailable, max_punishment, arnesh_kumar_applies,
        practitioner_escalation_note, embedding_dim, embedding_json, embedding_blob, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        act = excluded.act,
        section = excluded.section,
        legacy_equivalent = excluded.legacy_equivalent,
        chapter_cluster = excluded.chapter_cluster,
        title = excluded.title,
        ingredients = excluded.ingredients,
        cognizable = excluded.cognizable,
        bailable = excluded.bailable,
        max_punishment = excluded.max_punishment,
        arnesh_kumar_applies = excluded.arnesh_kumar_applies,
        practitioner_escalation_note = excluded.practitioner_escalation_note,
        embedding_dim = excluded.embedding_dim,
        embedding_json = excluded.embedding_json,
        embedding_blob = excluded.embedding_blob,
        updated_at = excluded.updated_at
    `);

    db.exec(`DELETE FROM statutory_provisions_fts`);
    const insertFts = db.prepare(`
      INSERT INTO statutory_provisions_fts (id, section, title, ingredients, practitioner_escalation_note)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of STATUTORY_PROVISIONS_SEED) {
      const textToEmbed = `${item.section} ${item.legacyEquivalent} ${item.title} ${item.ingredients} ${item.practitionerEscalationNote}`;
      const vec = computeSemanticEmbedding384(textToEmbed);
      const blob = float32ToBuffer(vec);
      const jsonArr = JSON.stringify(Array.from(vec.slice(0, 64)).map(n => Number(n.toFixed(4))));
      upsertProv.run(
        item.id,
        item.act,
        item.section,
        item.legacyEquivalent,
        item.chapterCluster,
        item.title,
        item.ingredients,
        item.cognizable,
        item.bailable,
        item.maxPunishment,
        item.arneshKumarApplies ? 1 : 0,
        item.practitionerEscalationNote,
        EMBEDDING_DIM,
        jsonArr,
        blob,
        now
      );
      insertFts.run(item.id, item.section, item.title, item.ingredients, item.practitionerEscalationNote);
  }

  const lessonCount = db.prepare(`SELECT COUNT(*) AS cnt FROM practitioner_lessons`).get();
  if (Number(lessonCount?.cnt || 0) > 0) {
    // Concept anchors evolve between releases; re-embed stored lessons so taught rules stay retrievable.
    const reembed = db.prepare(`UPDATE practitioner_lessons SET embedding_json = ?, embedding_blob = ? WHERE id = ?`);
    for (const r of db.prepare(`SELECT id, domain, topic, lesson_text FROM practitioner_lessons`).all()) {
      const vec = computeSemanticEmbedding384(`${r.domain} ${r.topic} ${r.lesson_text}`);
      reembed.run(JSON.stringify(Array.from(vec.slice(0, 64)).map(n => Number(n.toFixed(4)))), float32ToBuffer(vec), r.id);
    }
  }
  if (Number(lessonCount?.cnt || 0) === 0) {
    const now = new Date().toISOString();
    const insertLesson = db.prepare(`
      INSERT OR IGNORE INTO practitioner_lessons (
        id, domain, topic, lesson_text, author, embedding_dim, embedding_json, embedding_blob, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of DEFAULT_PRACTITIONER_LESSONS_SEED) {
      const vec = computeSemanticEmbedding384(`${l.domain} ${l.topic} ${l.lessonText}`);
      insertLesson.run(
        l.id,
        l.domain,
        l.topic,
        l.lessonText,
        l.author,
        EMBEDDING_DIM,
        JSON.stringify(Array.from(vec.slice(0, 64)).map(n => Number(n.toFixed(4)))),
        float32ToBuffer(vec),
        now,
        now
      );
    }
  }
}

/**
 * Performs Hybrid Semantic Vector (Cosine Similarity on 384-dim Float32 embeddings stored in SQLite)
 * + FTS5 Lexical Search + Automatic `chapter_cluster` Adjacent-Section Expansion!
 */
export function searchStatutoryProvisionsSemantic(queryText = '', { topK = 3, expandCluster = true } = {}) {
  const db = getSemanticIndexDb();
  const queryVec = computeSemanticEmbedding384(queryText);
  const allRows = db.prepare(`SELECT * FROM statutory_provisions`).all();

  // Optional FTS5 boost ordered by BM25 relevance (excluding generic stop-words like 'section'/'bns'/'case')
  const ftsStopWords = new Set(['section', 'sections', 'under', 'bns', 'bnss', 'ipc', 'crpc', 'case', 'with', 'from', 'that', 'this', 'what', 'have', 'someone']);
  const ftsHits = new Map();
  const safeTerms = String(queryText || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !ftsStopWords.has(w))
    .slice(0, 10);
  if (safeTerms.length > 0) {
    try {
      const ftsQuery = safeTerms.map(t => `"${t}"`).join(' OR ');
      const rows = db.prepare(
        `SELECT id, bm25(statutory_provisions_fts) AS bm25_score FROM statutory_provisions_fts WHERE statutory_provisions_fts MATCH ? ORDER BY bm25(statutory_provisions_fts) LIMIT 6`
      ).all(ftsQuery);
      rows.forEach((r, idx) => {
        ftsHits.set(r.id, Math.max(0.04, 0.14 - idx * 0.02));
      });
    } catch {
      // Ignore malformed FTS syntax
    }
  }

  const scored = allRows.map(row => {
    const rowVec = bufferToFloat32(row.embedding_blob);
    const cosine = cosineSimilarity384(queryVec, rowVec);
    const ftsBonus = ftsHits.get(row.id) || 0;
    const score = Number((cosine + ftsBonus).toFixed(4));
    return {
      id: row.id,
      act: row.act,
      section: row.section,
      legacyEquivalent: row.legacy_equivalent,
      chapterCluster: row.chapter_cluster,
      title: row.title,
      ingredients: row.ingredients,
      cognizable: row.cognizable,
      bailable: row.bailable,
      maxPunishment: row.max_punishment,
      arneshKumarApplies: Boolean(row.arnesh_kumar_applies),
      practitionerEscalationNote: row.practitioner_escalation_note,
      embeddingDim: row.embedding_dim,
      similarityScore: score
    };
  }).sort((a, b) => b.similarityScore - a.similarityScore);

  const primaryMatches = scored.filter(s => s.similarityScore >= 0.14).slice(0, topK);
  if (primaryMatches.length === 0 && scored.length > 0) {
    primaryMatches.push(scored[0]);
  }

  if (!expandCluster) return primaryMatches;

  // Adjacent-Section Cluster Expansion: pull sibling sections in the top-matched chapterCluster!
  const topClusters = new Set(primaryMatches.slice(0, 2).map(m => m.chapterCluster));
  const resultIds = new Set(primaryMatches.map(m => m.id));
  const expanded = [...primaryMatches];

  for (const item of scored) {
    if (!resultIds.has(item.id) && topClusters.has(item.chapterCluster)) {
      expanded.push({
        ...item,
        isAdjacentClusterSection: true
      });
      resultIds.add(item.id);
    }
  }

  return expanded.slice(0, 6);
}

/**
 * Searches `practitioner_lessons` in SQLite by 384-dim Cosine Similarity
 */
export function searchPractitionerLessonsSemantic(queryText = '', domain = '', topK = 3) {
  const db = getSemanticIndexDb();
  const queryVec = computeSemanticEmbedding384(`${domain} ${queryText}`);
  const rows = db.prepare(`SELECT * FROM practitioner_lessons ORDER BY updated_at DESC`).all();

  return rows
    .map(r => {
      const vec = bufferToFloat32(r.embedding_blob);
      const cosine = cosineSimilarity384(queryVec, vec);
      const domainBonus = domain && r.domain === domain ? 0.08 : 0;
      return {
        id: r.id,
        domain: r.domain,
        topic: r.topic,
        lessonText: r.lesson_text,
        author: r.author,
        updatedAt: r.updated_at,
        similarityScore: Number((cosine + domainBonus).toFixed(4))
      };
    })
    .filter(r => r.similarityScore >= 0.15)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, topK);
}

/**
 * Super-Admin CRUD for "Teach Nyaya" Live Semantic Memory (#4)
 */
export function listAllPractitionerLessons() {
  const db = getSemanticIndexDb();
  const rows = db.prepare(`SELECT id, domain, topic, lesson_text, author, embedding_dim, created_at, updated_at FROM practitioner_lessons ORDER BY updated_at DESC`).all();
  return rows.map(r => ({
    id: r.id,
    domain: r.domain,
    topic: r.topic,
    lessonText: r.lesson_text,
    author: r.author,
    embeddingDim: r.embedding_dim,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export function addOrUpdatePractitionerLesson({ id = '', domain = 'general', topic = '', lessonText = '', author = 'Super-Admin' } = {}) {
  const cleanTopic = String(topic || '').trim();
  const cleanLesson = String(lessonText || '').trim();
  if (!cleanTopic || !cleanLesson) {
    throw new Error('Both topic and lessonText are required to teach Nyaya a practitioner rule.');
  }
  const db = getSemanticIndexDb();
  const now = new Date().toISOString();
  const lessonId = id || `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const vec = computeSemanticEmbedding384(`${domain} ${cleanTopic} ${cleanLesson}`);
  const blob = float32ToBuffer(vec);
  const jsonArr = JSON.stringify(Array.from(vec.slice(0, 64)).map(n => Number(n.toFixed(4))));

  db.prepare(`
    INSERT INTO practitioner_lessons (
      id, domain, topic, lesson_text, author, embedding_dim, embedding_json, embedding_blob, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain,
      topic = excluded.topic,
      lesson_text = excluded.lesson_text,
      author = excluded.author,
      embedding_dim = excluded.embedding_dim,
      embedding_json = excluded.embedding_json,
      embedding_blob = excluded.embedding_blob,
      updated_at = excluded.updated_at
  `).run(lessonId, domain || 'general', cleanTopic, cleanLesson, author || 'Super-Admin', EMBEDDING_DIM, jsonArr, blob, now, now);

  return {
    id: lessonId,
    domain: domain || 'general',
    topic: cleanTopic,
    lessonText: cleanLesson,
    author: author || 'Super-Admin',
    embeddingDim: EMBEDDING_DIM,
    updatedAt: now
  };
}

export function deletePractitionerLesson(id = '') {
  const db = getSemanticIndexDb();
  db.prepare(`DELETE FROM practitioner_lessons WHERE id = ?`).run(String(id || ''));
  return { deleted: true, id };
}
