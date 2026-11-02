const configuredLibraries = new WeakSet();
const nuktaLetters = {
  '\u0915': '\u0958', '\u0916': '\u0959', '\u0917': '\u095a', '\u091c': '\u095b',
  '\u0921': '\u095c', '\u0922': '\u095d', '\u092b': '\u095e', '\u092f': '\u095f',
  '\u0930': '\u0931', '\u0933': '\u0934', '\u0928': '\u0929'
};

function configure(sanscript) {
  if (configuredLibraries.has(sanscript)) return;
  const source = structuredClone(sanscript.schemes.devanagari);
  const roman = structuredClone(sanscript.schemes.iast);
  // Speech services emit modern Hindi vowels and both forms of nukta letters.
  source.extra_consonants['\u0922\u093c'] = '\u095d';
  for (const [letter, output] of Object.entries({
    '\u090d': 'e', '\u090e': 'e', '\u0911': 'o', '\u0912': 'o', '\u0972': 'a'
  })) {
    source.vowels[letter] = letter;
    roman.vowels[letter] = output;
  }
  for (const [mark, output] of Object.entries({ '\u0945': 'e', '\u0949': 'o' })) {
    source.vowel_marks[mark] = mark;
    roman.vowel_marks[mark] = output;
  }
  sanscript.addBrahmicScheme('nyaya-hindi', source);
  sanscript.addRomanScheme('nyaya-roman', roman);
  configuredLibraries.add(sanscript);
}

function readableRoman(word) {
  const vowels = { '\u0101': 'aa', '\u012b': 'ee', '\u016b': 'oo', '\u1e5b': 'ri', '\u1e5d': 'ree', '\u1e37': 'li', '\u1e39': 'lee' };
  return word
    .replace(/ch|c/g, match => match === 'ch' ? 'chh' : 'ch')
    .replace(/[\u0101\u012b\u016b\u1e5b\u1e5d\u1e37\u1e39]/g, match => vowels[match])
    .replace(/[\u015b\u1e63]/g, 'sh')
    .replace(/[\u1e43\u1e41~](?=[pbm])/g, 'm')
    .replace(/[\u1e43\u1e41~]/g, 'n')
    .normalize('NFD').replace(/\p{M}/gu, '');
}

export function romanizeVoiceText(text, sanscript) {
  if (!/[\u0900-\u097f]/.test(text)) return text;
  if (!sanscript?.t) throw new Error('English-letter transcription could not load. Reload the page or type your text.');
  configure(sanscript);
  return text.replace(/[\u0900-\u097f\u200c\u200d]+/g, segment => {
    const word = segment
      .replace(/([\u0915\u0916\u0917\u091c\u0921\u0922\u092b\u092f\u0930\u0933\u0928])\u093c/g, (_, letter) => nuktaLetters[letter])
      .replace(/[\u200c\u200d]/g, '');
    // Keep word boundaries and punctuation outside Sanscript's Sanskrit schwa handling.
    return word.split(/([\u0964\u0965])/).map(part => {
      if (/^[\u0964\u0965]$/.test(part)) return '.';
      let roman = readableRoman(sanscript.t(part, 'nyaya-hindi', 'nyaya-roman'));
      if (/[\u0915-\u0939\u0958-\u095f]$/.test(part) && !/\u094d[\u092f\u0930]$/.test(part)) {
        if (roman.endsWith('a') && !roman.endsWith('aa')) roman = roman.slice(0, -1);
      }
      if (/[\u0900-\u097f]/.test(roman)) throw new Error('Some Hindi characters could not be transliterated.');
      return roman;
    }).join('');
  });
}
