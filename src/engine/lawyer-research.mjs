/**
 * Advocate Mode — Precedent, Judgment & Bare Act Workbench Engine
 * Solves the core practitioner pain point: finding verified Supreme Court judgments (e.g., Tofan Singh),
 * exact Bare Act provisions (with IPC/CrPC/IEA <-> BNS/BNSS/BSA 2023 cross-references),
 * oral-argument paragraph pointers, and direct Indian Kanoon / Supreme Court e-SCR / IndiaCode links in one place.
 */

export const VERIFIED_LANDMARK_JUDGMENTS = [
  {
    id: 'pramod-suryabhan-pawar-bns-s69-false-promise',
    keywords: ['pramod suryabhan pawar', 'section 69 bns', 'bns 69', 'false promise to marry', 'deceitful means', 'breach of promise', 'consensual relationship', 'marital rape', 'exception 2 section 63', 'sonu @ subhash', 'naim ahamed', '376 ipc'],
    caseTitle: 'Pramod Suryabhan Pawar v. State of Maharashtra (read with Sonu @ Subhash Kumar v. State of UP & Naim Ahamed v. State (NCT of Delhi))',
    citation: '(2019) 9 SCC 608 | 2019 INSC 938 · 2021 SCC OnLine SC 181 · 2023 SCC OnLine SC 89',
    courtAndBench: 'Supreme Court of India — 2-Judge Bench (D.Y. Chandrachud & Indira Banerjee, JJ.)',
    dateOfJudgment: '21 August 2019',
    domain: 'Criminal Defence — Section 69 BNS (False Promise to Marry) vs. Consensual Breakup & Section 63 Exception 2 BNS (Marital Context)',
    bareActProvisions: [
      {
        act: 'Bharatiya Nyaya Sanhita (BNS), 2023',
        sections: 'Section 69 BNS (Sexual intercourse by employing deceitful means / false promise to marry — up to 10 years) & Section 63 Exception 2 BNS (Marital exception where wife is not under 18 years)',
        bareActSummary: 'Section 69 BNS penalises sexual intercourse (not amounting to rape) by employing deceitful means or by making a promise to marry without any intention of fulfilling the same (Cognizable, Non-Bailable, up to 10 years). Under Exception 2 to Section 63 BNS (read with Independent Thought v. Union of India, (2017) 10 SCC 800), sexual intercourse by a man with his own wife, the wife not being under 18 years of age, is not rape under Section 63/64 BNS (though physical/mental cruelty or hurt remains actionable under Section 85/115 BNS and Section 12 PWDVA).',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/20062'
      },
      {
        act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023',
        sections: 'Section 482 BNSS (Anticipatory Bail — old s.438 CrPC) & Section 528 BNSS (High Court Quashing of FIR — old s.482 CrPC)',
        bareActSummary: 'Because Section 69 BNS carries up to 10 years (> 7 years), automatic Section 35(3) BNSS (Arnesh Kumar) notice protection does NOT apply—immediate Anticipatory Bail under Section 482 BNSS and High Court Quashing under Section 528 BNSS are the primary remedies.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/20099'
      }
    ],
    ratioDecidendi: [
      '1. "False Promise to Marry" vs. "Breach of Promise to Marry": There is a fundamental legal distinction between a promise to marry that was false from the very inception (given in bad faith with zero intention to abide by it when made) and a subsequent breach of a genuine promise to marry due to unforeseen family opposition, caste/horoscope differences, or breakdown of a consensual relationship.',
      '2. Two Mandatory Ingredients for Offence: To sustain an FIR under Section 69 BNS (or old s.376/90 IPC), the prosecution must establish prima facie that: (a) the maker of the promise had NO intention to uphold his word AT THE TIME OF MAKING IT (deceit from Day 1), and (b) the false promise was of immediate relevance and the direct proximate cause of the woman\'s consent.',
      '3. Long-Standing Consensual Relationship & Existing Marriage Bar (Naim Ahamed v. State, 2023 SCC OnLine SC 89): Where educated adults continue a consensual physical relationship over a long period knowing the practical hurdles (or where one party was already married and no divorce had taken place), a subsequent breakup cannot be weaponized into a criminal prosecution—the FIR is an abuse of process liable to be quashed under Section 528 BNSS (s.482 CrPC).'
    ],
    keyParagraphs: 'Paragraphs 16, 18 & 21 of Pramod Suryabhan Pawar, (2019) 9 SCC 608.',
    whenToCiteInCourt: 'Cite in Section 482 BNSS (s.438 CrPC) Anticipatory Bail petitions, Section 528 BNSS (s.482 CrPC) High Court FIR Quashing petitions, and Section 250 BNSS Discharge applications when a consensual relationship breakup or marital dispute is falsely given the colour of Section 69 / 64 BNS.',
    howToDistinguishIfOpposing: 'The prosecution/complainant can defeat Pramod Suryabhan Pawar only by showing fraudulent concealment at inception—e.g., the accused was already secretly married and hid that fact from Day 1, used a fake identity, or conducted a sham/fraudulent marriage ceremony.',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/147241625/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=Pramod+Suryabhan+Pawar+v.+State+of+Maharashtra+2019+9+SCC+608',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  },
  {
    id: 'tofan-singh-ndps-s67',
    keywords: ['tofan singh', 'tufan singh', 'ndps', 'section 67', 's. 67', 's.67', 'section 53', 'confessional statement', 'ncb', 'narcotic', 'section 25 evidence', 'section 23 bsa', 'pallulabid'],
    caseTitle: 'Tofan Singh v. State of Tamil Nadu',
    citation: '(2021) 4 SCC 1 | 2020 INSC 620',
    courtAndBench: 'Supreme Court of India — 3-Judge Bench (R.F. Nariman, Navin Sinha & Indira Banerjee, JJ.; 2:1 Majority by Nariman, J.)',
    dateOfJudgment: '29 October 2020',
    domain: 'Criminal / NDPS Act & Evidence Law',
    bareActProvisions: [
      {
        act: 'Narcotic Drugs and Psychotropic Substances (NDPS) Act, 1985',
        sections: 'Section 67 (Power to call for information), Section 53 (Power to invest officers of certain departments with powers of an officer-in-charge of a police station), Section 42, Section 50, Section 52A & Section 37 (Bail twin conditions)',
        bareActSummary: 'Section 67 empowers an authorised officer during an enquiry to call for information or examine any person acquainted with the facts. Section 53 invests Central Excise, Narcotics, Customs, DRI, and NCB officers with the powers of an officer-in-charge of a police station for investigation of offences under the NDPS Act.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/1791'
      },
      {
        act: 'Bharatiya Sakshya Adhiniyam (BSA), 2023 / Indian Evidence Act, 1872',
        sections: 'Section 23(1) BSA, 2023 (formerly Section 25 of the Indian Evidence Act, 1872)',
        bareActSummary: 'No confession made to a police officer shall be proved as against a person accused of any offence.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/20063'
      },
      {
        act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 / Code of Criminal Procedure, 1973',
        sections: 'Sections 180 & 181 BNSS, 2023 (formerly Sections 161 & 162 CrPC, 1973)',
        bareActSummary: 'Statements made to a police officer in the course of an investigation cannot be signed by the maker and are barred from being used as substantive evidence at trial except to contradict a prosecution witness.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/20099'
      }
    ],
    ratioDecidendi: [
      '1. Officers invested with powers under Section 53 of the NDPS Act (including NCB, DRI, Customs, and Central Excise officers) are "police officers" within the meaning of Section 25 of the Indian Evidence Act, 1872 (now Section 23(1) BSA, 2023). Consequently, any confessional statement made to them is completely barred from being proved against an accused.',
      '2. A statement recorded under Section 67 of the NDPS Act cannot be used as a confessional statement in the trial of an offence under the NDPS Act (overruling Kanhaiyalal v. Union of India, (2008) 4 SCC 668 and Raj Kumar Karwal v. Union of India, (1990) 2 SCC 409).',
      '3. Companion Bail Application Rule — State by (NCB) Bengaluru v. Pallulabid Ahmad Arimutta, (2022) 12 SCC 633: Even at the stage of Regular/Anticipatory Bail under Section 37 NDPS Act, a co-accused\'s or accused\'s voluntary confessional statement under Section 67 NDPS Act is inadmissible and, absent independent recovery of contraband or financial trail, cannot overcome the grant of bail.'
    ],
    keyParagraphs: 'Paragraphs 155 & 158 of (2021) 4 SCC 1 (Conclusions of the Majority per R.F. Nariman, J.).',
    whenToCiteInCourt: 'Cite during Bail hearings ( opposing Section 37 NDPS twin-condition bar when prosecution relies on a Section 67 statement or co-accused disclosure without recovery ), Discharge applications (Section 250 BNSS / old Section 227 CrPC), or Final Arguments.',
    howToDistinguishIfOpposing: 'Clarify that while a self-incriminating confession under Section 67 is barred by Section 25 IEA / Section 23(1) BSA, independent physical recovery of contraband from conscious possession or discovery of an objective physical fact strictly satisfying Section 27 IEA (Proviso to Section 23(2) BSA) stands on a separate footing and must be proved independently.',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/143202244/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=Tofan+Singh+v.+State+of+Tamil+Nadu+%282021%29+4+SCC+1',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  },
  {
    id: 'arnesh-kumar-bnss-s35',
    keywords: ['arnesh kumar', 'satender kumar antil', '41a', 'section 35 bnss', '35(3)', '498a', 'bns 85', 'automatic arrest', 'notice of appearance', 'checklist', 'remand'],
    caseTitle: 'Arnesh Kumar v. State of Bihar (read with Satender Kumar Antil v. CBI)',
    citation: '(2014) 8 SCC 273 | 2014 INSC 463 & (2022) 10 SCC 51',
    courtAndBench: 'Supreme Court of India — 2-Judge Bench',
    dateOfJudgment: '2 July 2014 (Antil: 11 July 2022)',
    domain: 'Criminal Procedure / Arrest Safeguards & Bail',
    bareActProvisions: [
      {
        act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 / Code of Criminal Procedure, 1973',
        sections: 'Section 35(1)(b) & Section 35(3)–(6) BNSS, 2023 (formerly Section 41(1)(b) & Section 41A CrPC, 1973)',
        bareActSummary: 'For any offence punishable with imprisonment up to 7 years (including BNS s.85 / IPC s.498A, BNS s.318(4) / IPC s.420, BNS s.316(2) / IPC s.406), a police officer shall not automatically arrest the accused and must instead issue a Notice of Appearance under Section 35(3) BNSS unless specific written reasons under Section 35(1)(b)(ii) are recorded.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/20099'
      }
    ],
    ratioDecidendi: [
      '1. Mandatory Notice of Appearance under Section 35(3) BNSS (old Section 41A CrPC) must be served within 2 weeks of institution of the case for all offences punishable up to 7 years.',
      '2. Police cannot arrest merely because an offence is cognizable and non-bailable; they must record concrete facts satisfying the Section 35(1)(b) BNSS checklist, and the Magistrate cannot authorise mechanical remand.',
      '3. Per Satender Kumar Antil v. CBI, (2022) 10 SCC 51, non-compliance with Section 41 / 41A CrPC (now Section 35 BNSS) entitles the accused to grant of bail.'
    ],
    keyParagraphs: 'Paragraphs 11.1 to 11.8 of Arnesh Kumar (2014) 8 SCC 273 (8-point mandatory directions).',
    whenToCiteInCourt: 'Cite in Anticipatory Bail (Section 482 BNSS / old s.438 CrPC), Regular Bail (Section 480/483 BNSS), Remand opposition before the Magistrate, and CAW Cell / police inquiry representations.',
    howToDistinguishIfOpposing: 'Show concrete material on record satisfying Section 35(1)(b)(ii) BNSS — e.g., active tampering with evidence, direct threat to witnesses, absconding despite service of s.35(3) notice, or where the offence carries >7 years punishment (e.g., BNS s.69 / s.316(5)).',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/2982624/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=Arnesh+Kumar+v.+State+of+Bihar+2014+8+SCC+273',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  },
  {
    id: 'hilli-multipurpose-cpa-45-day-cap',
    keywords: ['hilli multipurpose', 'new india assurance', '45 days', '45-day', 'written version', 'section 38(2)(a)', 'condonation of delay', 'forfeit', 'consumer'],
    caseTitle: 'New India Assurance Co. Ltd. v. Hilli Multipurpose Cold Storage Pvt. Ltd.',
    citation: '(2020) 5 SCC 757 | 2020 INSC 274',
    courtAndBench: 'Supreme Court of India — 5-Judge Constitution Bench',
    dateOfJudgment: '4 March 2020',
    domain: 'Consumer Protection Law (CPA 2019)',
    bareActProvisions: [
      {
        act: 'Consumer Protection Act, 2019',
        sections: 'Section 38(2)(a) & Section 38(3)(a) (formerly Section 13(2)(a) of CPA 1986)',
        bareActSummary: 'The Opposite Party must file its Written Version within 30 days of receipt of notice accompanied by the complaint copy, extendable by the Commission for a period not exceeding 15 days (45 days absolute ceiling).',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/15256'
      }
    ],
    ratioDecidendi: [
      '1. The District, State, or National Consumer Commission has NO power to extend the time for filing the Written Version beyond the statutory period of 30 days plus a maximum discretionary extension of 15 days (45 days in total).',
      '2. The 45-day clock commences from the date of service of notice accompanied by a complete copy of the complaint and annexures.'
    ],
    keyParagraphs: 'Paragraphs 41 & 62–63 of (2020) 5 SCC 757.',
    whenToCiteInCourt: 'Cite immediately on Day 46+ after service of notice to forfeit/close the Opposite Party\'s right to file its Written Version, or to strike off a belatedly filed Written Version.',
    howToDistinguishIfOpposing: 'Demonstrate from the postal packet / registry endorsement that the notice was NOT accompanied by a legible copy of the complaint and annexures (the 45-day clock runs only from receipt of the complete complaint paper-book).',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/152926323/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=New+India+Assurance+Hilli+Multipurpose+2020+5+SCC+757',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  },
  {
    id: 'arjun-panditrao-electronic-evidence-s63-bsa',
    keywords: ['arjun panditrao', '65b', 'section 65b', 'section 63 bsa', 'electronic evidence', 'whatsapp', 'certificate', 'cctv', 'call recording', 'anvar p.v.'],
    caseTitle: 'Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal',
    citation: '(2020) 7 SCC 1 | 2020 INSC 453',
    courtAndBench: 'Supreme Court of India — 3-Judge Bench',
    dateOfJudgment: '14 July 2020',
    domain: 'Evidence Law — Electronic Records (BSA 2023 / IEA 1872)',
    bareActProvisions: [
      {
        act: 'Bharatiya Sakshya Adhiniyam (BSA), 2023 / Indian Evidence Act, 1872',
        sections: 'Section 63 BSA, 2023 (formerly Section 65B of the Indian Evidence Act, 1872) & Section 61 BSA',
        bareActSummary: 'Secondary output of an electronic record (printouts, screenshots, CD/pendrive copies of WhatsApp chats, emails, server logs, CCTV) is admissible without producing the original device only if accompanied by a Section 63(4) BSA certificate signed by the person in charge of the device and the expert/hash details specified in the Schedule.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/20063'
      }
    ],
    ratioDecidendi: [
      '1. A certificate under Section 65B(4) IEA (now Section 63(4) BSA, 2023) is a mandatory condition precedent for admissibility of secondary electronic evidence; oral evidence cannot substitute for the certificate (affirming Anvar P.V. v. P.K. Basheer, (2014) 10 SCC 473 and overruling Shafhi Mohammad).',
      '2. Exception 1 (Primary Evidence): If the owner produces the original primary device itself (e.g., the original phone/laptop on which the record is stored) before the court, no Section 63(4)/65B(4) certificate is required.',
      '3. Exception 2 (Curable Stage): If a party failed to file or filed a defective certificate earlier, the trial court/tribunal has discretion to permit filing a compliant certificate at any stage before the trial is concluded.'
    ],
    keyParagraphs: 'Paragraphs 61, 73.1 to 73.3 of (2020) 7 SCC 1.',
    whenToCiteInCourt: 'Cite either to object to an opponent\'s uncertified WhatsApp/email printouts OR to seek leave to file a supplemental/corrected Section 63 BSA certificate before evidence closes.',
    howToDistinguishIfOpposing: 'If the electronic record is in the possession of the opposing party or a third party (bank/telecom/platform) who refuses to give a certificate, apply to the court to summon the person/authority to produce the certificate.',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/172105937/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=Arjun+Panditrao+Khotkar+2020+7+SCC+1',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  },
  {
    id: 'imperia-newtech-rera-consumer',
    keywords: ['imperia structures', 'newtech promoters', 'pioneer urban', 'rera', 'builder delay', 'adjudicating officer', 'possession delay', 'section 18 rera'],
    caseTitle: 'Imperia Structures Ltd. v. Anil Patni & M/s Newtech Promoters v. State of UP',
    citation: '(2020) 10 SCC 783 & (2021) 18 SCC 1',
    courtAndBench: 'Supreme Court of India — 2-Judge & 3-Judge Benches',
    dateOfJudgment: '2 November 2020 & 11 November 2021',
    domain: 'Real Estate (RERA 2016) & Consumer Law (CPA 2019)',
    bareActProvisions: [
      {
        act: 'Real Estate (Regulation and Development) Act, 2016 (RERA) & Consumer Protection Act, 2019',
        sections: 'Sections 18(1), 31, 36, 71 & 79 of RERA Act, 2016; Section 100 of CPA, 2019',
        bareActSummary: 'Section 18(1) RERA grants an allottee an unqualified right to refund with interest (if withdrawing) or monthly interest for every month of delay until possession (if staying in the project). Section 100 CPA 2019 states the Consumer Protection Act is in addition to and not in derogation of any other law.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/2158'
      }
    ],
    ratioDecidendi: [
      '1. Imperia Structures: Availability of a remedy under the RERA Act, 2016 does NOT bar a homebuyer (allottee) from initiating proceedings before the Consumer Commission under the Consumer Protection Act.',
      '2. Newtech Promoters: Under the RERA Act, jurisdiction is bifurcated — claims for refund, possession, and statutory delay interest under Section 18(1) lie exclusively before the Real Estate Regulatory Authority (under Section 31), whereas claims for standalone compensation under Sections 12, 14, 18 & 19 lie before the Adjudicating Officer (under Section 71).'
    ],
    keyParagraphs: 'Imperia Structures ¶23–32; Newtech Promoters ¶86.',
    whenToCiteInCourt: 'Cite to defeat a builder\'s preliminary objection on maintainability before the Consumer Commission, or to frame proper reliefs before the RERA Authority vs Adjudicating Officer.',
    howToDistinguishIfOpposing: 'Show that the buyer is a commercial investor purchasing multiple units purely for resale profit rather than a "consumer" under Section 2(7) CPA 2019, or has already elected and pursued the identical relief in another forum.',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/73014084/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=Imperia+Structures+Anil+Patni+2020+10+SCC+783',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  },
  {
    id: 'vineeta-sharma-hindu-succession-s6',
    keywords: ['vineeta sharma', 'rakesh sharma', 'section 6 hindu succession', 'coparcener', 'daughter share', 'ancestral property', 'partition suit'],
    caseTitle: 'Vineeta Sharma v. Rakesh Sharma',
    citation: '(2020) 9 SCC 1 | 2020 INSC 487',
    courtAndBench: 'Supreme Court of India — 3-Judge Bench (Arun Mishra, S. Abdul Nazeer & M.R. Shah, JJ.)',
    dateOfJudgment: '11 August 2020',
    domain: 'Family & Property Law — Hindu Succession Act, 1956',
    bareActProvisions: [
      {
        act: 'Hindu Succession Act, 1956 (as amended by Act 39 of 2005) & Code of Civil Procedure, 1908',
        sections: 'Section 6 & Section 8 HSA, 1956; Order 39 Rules 1 & 2 CPC (Temporary Injunction)',
        bareActSummary: 'Section 6(1) HSA confers coparcenary status by birth on a daughter of a coparcener in the same manner as a son. Section 6(5) saves only partitions effected by a registered deed of partition or a decree of a court prior to 20 December 2004.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/1549'
      }
    ],
    ratioDecidendi: [
      '1. The substituted Section 6 of the Hindu Succession Act, 1956 confers status of coparcener on the daughter born before or after the 2005 amendment in the same manner as a son.',
      '2. Since the right in coparcenary is by birth, it is NOT necessary that the father coparcener should have been living as on 9 September 2005 (overruling Prakash v. Phulavati).',
      '3. An unregistered oral family settlement or plea of prior partition without a registered deed or court decree prior to 20.12.2004 cannot defeat the daughter\'s share save in exceptional cases proved by contemporaneous public documents.'
    ],
    keyParagraphs: 'Paragraph 137 (Summary of Conclusions) of (2020) 9 SCC 1.',
    whenToCiteInCourt: 'Cite in Partition Suits (O.S.) and Order 39 Rules 1 & 2 CPC Temporary Injunction applications to establish a daughter\'s prima facie coparcenary right and restrain brothers/co-heirs from alienating joint family property.',
    howToDistinguishIfOpposing: 'Establish that the property was already partitioned by a registered partition deed or final court decree prior to 20 December 2004, or was self-acquired property disposed of by a valid, proven Will under Section 30 HSA.',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/67965481/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=Vineeta+Sharma+v.+Rakesh+Sharma+2020+9+SCC+1',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  },
  {
    id: 'rajnesh-v-neha-maintenance-pwdva',
    keywords: ['rajnesh v neha', 'rajnesh vs neha', 'maintenance', 'section 125 crpc', 'section 144 bnss', 'affidavit of assets', 'pwdva', 'section 12 dv act', 'interim maintenance'],
    caseTitle: 'Rajnesh v. Neha & Another',
    citation: '(2021) 2 SCC 324 | 2020 INSC 631',
    courtAndBench: 'Supreme Court of India — 2-Judge Bench (Indu Malhotra & R. Subhash Reddy, JJ.)',
    dateOfJudgment: '4 November 2020',
    domain: 'Matrimonial & Family Law — Maintenance & Domestic Violence',
    bareActProvisions: [
      {
        act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 & Protection of Women from Domestic Violence Act (PWDVA), 2005',
        sections: 'Section 144 BNSS, 2023 (formerly Section 125 CrPC); Sections 12, 18, 19, 20, 21 & 23 of PWDVA, 2005; Section 24 HMA, 1955',
        bareActSummary: 'Section 144 BNSS provides summary monthly maintenance for wives, children, and parents. Section 12 PWDVA provides a single-window Magistrate application for Protection (s.18), Shared Household Residence (s.19), Return of Streedhan (s.19(8)), Monetary Relief (s.20), Custody (s.21), and Ex-Parte/Interim Orders (s.23).',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/2059'
      }
    ],
    ratioDecidendi: [
      '1. Both parties in all maintenance proceedings (under Section 144 BNSS / s.125 CrPC, PWDVA, or HMA) must file a mandatory, comprehensive Affidavit of Disclosure of Assets and Liabilities (Enclosure I).',
      '2. Maintenance in all forums must be awarded from the DATE OF FILING THE APPLICATION, not from the date of the order.',
      '3. While a wife can pursue maintenance under multiple statutes (e.g., PWDVA + BNSS s.144), she must disclose prior maintenance orders, and the subsequent court must grant an adjustment / set-off.'
    ],
    keyParagraphs: 'Part VI (Final Directions) of (2021) 2 SCC 324.',
    whenToCiteInCourt: 'Cite to demand the respondent\'s mandatory Affidavit of Assets & Liabilities (and adverse inference if concealed), to claim arrears from the date of application, or for a respondent to seek set-off against parallel maintenance proceedings.',
    howToDistinguishIfOpposing: 'Use the mandatory Enclosure-I Affidavit of Assets, ITRs, and bank statements to prove the applicant\'s independent income or to obtain set-off of amounts already being paid under another statute.',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/119554494/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=Rajnesh+v.+Neha+2021+2+SCC+324',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  },
  {
    id: 'lalita-kumari-priyanka-srivastava-fir',
    keywords: ['lalita kumari', 'priyanka srivastava', '156(3)', '175(3)', '154(3)', '173(4)', 'zero fir', 'fir registration', 'preliminary inquiry'],
    caseTitle: 'Lalita Kumari v. Govt. of UP & Priyanka Srivastava v. State of UP',
    citation: '(2014) 2 SCC 1 (5-Judge Bench) & (2015) 6 SCC 287',
    courtAndBench: 'Supreme Court of India — 5-Judge Constitution Bench & 2-Judge Bench',
    dateOfJudgment: '12 November 2013 & 19 March 2015',
    domain: 'Criminal Procedure — FIR Registration & Magistrate Investigation Directions',
    bareActProvisions: [
      {
        act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 / Code of Criminal Procedure, 1973',
        sections: 'Section 173(1), 173(3), 173(4) & Section 175(3) BNSS, 2023 (formerly Section 154(1), 154(3) & Section 156(3) CrPC)',
        bareActSummary: 'Section 173(1) BNSS mandates FIR registration (including Zero FIR regardless of territorial jurisdiction and e-FIR). Section 173(3) permits a 14-day preliminary inquiry with DSP permission for offences punishable with 3 to <7 years. Section 173(4) provides escalation to the SP, followed by a Magistrate application under Section 175(3) BNSS.',
        indiaCodeUrl: 'https://www.indiacode.nic.in/handle/123456789/20099'
      }
    ],
    ratioDecidendi: [
      '1. Lalita Kumari: Registration of an FIR is mandatory if the information discloses commission of a cognizable offence; preliminary inquiry is permissible only to ascertain whether a cognizable offence is disclosed in specified categories (matrimonial, commercial, medical negligence, corruption, or abnormal delay — note BNSS s.173(3) statutory modification for 3–7 yr offences).',
      '2. Priyanka Srivastava: An application to the Magistrate under Section 175(3) BNSS (formerly Section 156(3) CrPC) MUST be supported by a duly sworn affidavit of the complainant and proof of prior compliance with Section 173(1) (SHO) and Section 173(4) (SP).'
    ],
    keyParagraphs: 'Lalita Kumari ¶120.1–120.8; Priyanka Srivastava ¶29–31.',
    whenToCiteInCourt: 'Cite for complainants when police refuse to register an FIR, or for accused/respondents to challenge an unverified or premature s.175(3) BNSS / s.156(3) CrPC order that skipped SP escalation or lacked a sworn affidavit.',
    howToDistinguishIfOpposing: 'Point to Section 173(3) BNSS (for offences punishable with 3 to <7 years) and Section 175(3) BNSS (which now explicitly requires the Magistrate to consider the police officer\'s submission before ordering investigation).',
    links: {
      indianKanoonDocUrl: 'https://indiankanoon.org/doc/10239019/',
      indianKanoonSearchUrl: 'https://indiankanoon.org/search/?formInput=Lalita+Kumari+v.+Government+of+UP+2014+2+SCC+1',
      eScrUrl: 'https://digiscr.sci.gov.in/'
    }
  }
];

/**
 * Matches verified landmark judgments & Bare Act provisions against the advocate's query.
 */
export function matchLandmarkJudgmentsAndBareActs(query = '') {
  const lower = String(query || '').toLowerCase();
  const scored = [];

  for (const item of VERIFIED_LANDMARK_JUDGMENTS) {
    let score = 0;
    for (const kw of item.keywords) {
      if (lower.includes(kw)) {
        // Exact case-name match gets highest boost
        score += (kw.includes('singh') || kw.includes('kumar') || kw.includes('hilli') || kw.includes('khotkar') || kw.includes('imperia') || kw.includes('vineeta') || kw.includes('rajnesh') || kw.includes('lalita')) ? 10 : 3;
      }
    }
    if (score > 0) {
      scored.push({ ...item, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 4);
}

/**
 * Generates direct, clickable Indian Kanoon, Supreme Court e-SCR, and IndiaCode Bare Act research links
 * for any legal query or judgment name so the advocate always has one-click access to the primary files.
 */
export function buildDirectLegalResearchLinks(rawQuery = '', matchedJudgments = []) {
  const clean = String(rawQuery || '')
    .split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0]
    .replace(/Advocate Research Mode:.*?\n/gi, '')
    .replace(/Proceeding Stage:.*?\n/gi, '')
    .replace(/Query \/ Citation \/ Issue:/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110);

  const searchTerms = clean || 'Supreme Court of India judgment Bare Act';
  const links = [
    {
      label: '📄 Search Full Judgments on Indian Kanoon',
      source: 'Indian Kanoon',
      url: `https://indiankanoon.org/search/?formInput=${encodeURIComponent(searchTerms)}`
    },
    {
      label: '🏛️ Supreme Court Digital Reports (Official e-SCR)',
      source: 'Supreme Court of India (e-SCR)',
      url: `https://digiscr.sci.gov.in/`
    },
    {
      label: '📘 Official Central Bare Acts Repository (IndiaCode)',
      source: 'Ministry of Law & Justice (IndiaCode)',
      url: `https://www.indiacode.nic.in/`
    }
  ];

  for (const j of matchedJudgments) {
    if (j.links?.indianKanoonDocUrl) {
      links.unshift({
        label: `⚖️ Full Text: ${j.caseTitle} (${j.citation.split('|')[0].trim()})`,
        source: 'Indian Kanoon Direct Judgment',
        url: j.links.indianKanoonDocUrl
      });
    }
  }

  return links.slice(0, 6);
}

/**
 * Performs a live Indian Kanoon judgment & Bare Act search (with graceful fallback in offline/mocked tests)
 * and formats the complete Advocate Research Context Block.
 */
export async function buildAdvocateResearchContext(rawQuery = '', { timeoutMs = 2800, fetchImpl = globalThis.fetch } = {}) {
  const matchedJudgments = matchLandmarkJudgmentsAndBareActs(rawQuery);
  const directLinks = buildDirectLegalResearchLinks(rawQuery, matchedJudgments);
  const liveJudgments = [];

  const cleanQuery = String(rawQuery || '')
    .split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0]
    .replace(/Advocate Research Mode:.*?\n/gi, '')
    .replace(/Proceeding Stage:.*?\n/gi, '')
    .replace(/Query \/ Citation \/ Issue:/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  if (cleanQuery.length >= 4 && process.env.NYAYA_DISABLE_WEB_SEARCH !== '1' && process.env.LLM_PROVIDER !== 'openai') {
    try {
      const ikUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(cleanQuery)}`;
      const res = await fetchImpl(ikUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html'
        },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok) {
        const html = await res.text();
        const docRegex = /<div\s+class="result_title">\s*<a\s+href="(\/docfragment\/\d+\/[^"]*|\/doc\/\d+\/)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = docRegex.exec(html)) !== null && liveJudgments.length < 4) {
          const docIdMatch = match[1].match(/\/(\d+)\//);
          const docUrl = docIdMatch
            ? `https://indiankanoon.org/doc/${docIdMatch[1]}/`
            : `https://indiankanoon.org${match[1]}`;
          const title = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (title) {
            liveJudgments.push({ title, url: docUrl });
          }
        }
      }
    } catch {
      // graceful fallback to verified library + direct search links
    }
  }

  const promptBlocks = [];
  if (matchedJudgments.length > 0) {
    promptBlocks.push(
      '=== VERIFIED LANDMARK SUPREME COURT JUDGMENTS & BARE ACT REPOSITORY (Authoritative — cite directly) ===\n' +
      matchedJudgments.map(j => [
        `### ${j.caseTitle} — ${j.citation}`,
        `• Court & Bench: ${j.courtAndBench} (${j.dateOfJudgment})`,
        `• Direct Judgment Link: ${j.links.indianKanoonDocUrl}`,
        `• Bare Act Provisions Involved:\n` + j.bareActProvisions.map(b => `  - ${b.act} — ${b.sections}: ${b.bareActSummary} (${b.indiaCodeUrl})`).join('\n'),
        `• Ratio Decidendi (Binding Holding):\n` + j.ratioDecidendi.map(r => `  ${r}`).join('\n'),
        `• Key Paragraphs for Oral Argument: ${j.keyParagraphs}`,
        `• When to Cite in Court: ${j.whenToCiteInCourt}`,
        `• How Opposing Counsel Distinguishes It: ${j.howToDistinguishIfOpposing}`
      ].join('\n')).join('\n\n')
    );
  }

  if (liveJudgments.length > 0) {
    promptBlocks.push(
      '=== LIVE INDIAN KANOON JUDGMENT MATCHES ===\n' +
      liveJudgments.map((l, idx) => `${idx + 1}. ${l.title} — ${l.url}`).join('\n')
    );
  }

  promptBlocks.push(
    '=== DIRECT RESEARCH & BARE ACT LINKS ===\n' +
    directLinks.map(l => `- ${l.label}: ${l.url}`).join('\n')
  );

  return {
    matchedJudgments,
    liveJudgments,
    directLinks,
    contextBlock: promptBlocks.join('\n\n')
  };
}
