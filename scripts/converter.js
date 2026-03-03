(() => {
  const KEY_TO_JAMO = {
    r: "ㄱ", R: "ㄲ", s: "ㄴ", e: "ㄷ", E: "ㄸ", f: "ㄹ", a: "ㅁ",
    q: "ㅂ", Q: "ㅃ", t: "ㅅ", T: "ㅆ", d: "ㅇ", w: "ㅈ", W: "ㅉ",
    c: "ㅊ", z: "ㅋ", x: "ㅌ", v: "ㅍ", g: "ㅎ",
    k: "ㅏ", o: "ㅐ", i: "ㅑ", O: "ㅒ", j: "ㅓ", p: "ㅔ", u: "ㅕ",
    P: "ㅖ", h: "ㅗ", y: "ㅛ", n: "ㅜ", b: "ㅠ", m: "ㅡ", l: "ㅣ"
  };

  const LEADS = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
    "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
  ];

  const VOWELS = [
    "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ",
    "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"
  ];

  const TAILS = [
    "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ",
    "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ",
    "ㅋ", "ㅌ", "ㅍ", "ㅎ"
  ];

  const COMBINED_VOWELS = {
    "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ",
    "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅡㅣ": "ㅢ"
  };

  const COMBINED_TAILS = {
    "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ",
    "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ"
  };

  const LEAD_INDEX = Object.fromEntries(LEADS.map((c, i) => [c, i]));
  const VOWEL_INDEX = Object.fromEntries(VOWELS.map((c, i) => [c, i]));
  const TAIL_INDEX = Object.fromEntries(TAILS.map((c, i) => [c, i]));

  const FRENCH_ACCENT_WORDS = [
    "à", "â", "âge", "août", "après", "ça", "café", "collège", "crème", "déjà",
    "déjeuner", "dîner", "école", "économie", "électricité", "élève", "équipe",
    "été", "étude", "état", "évident", "façade", "forêt", "français", "frère",
    "gâteau", "garçon", "goût", "hôtel", "là", "leçon", "maïs", "même", "médecin",
    "mère", "naïf", "noël", "où", "père", "pièce", "près", "première", "qualité",
    "réunion", "rôle", "santé", "sécurité", "siècle", "sœur", "théâtre", "très",
    "université", "voilà", "zéro", "être", "écrire", "était", "étais", "étions"
  ];
  const FRENCH_PLAIN_WORDS = new Set([
    "a", "ai", "au", "aux", "avec", "bonjour", "ce", "ces", "comme", "dans",
    "de", "des", "du", "elle", "en", "et", "il", "ils", "je", "la", "le",
    "les", "leur", "mais", "mes", "mon", "ne", "nous", "ou", "par", "pas",
    "pour", "que", "qui", "sa", "se", "ses", "son", "sur", "ta", "te", "tes",
    "tu", "un", "une", "vos", "votre", "vous"
  ]);

  const SPANISH_ACCENT_WORDS = [
    "adiós", "aquí", "allí", "aún", "camión", "canción", "cómo", "cuándo",
    "cuánto", "día", "difícil", "dónde", "está", "están", "estás", "fácil",
    "francés", "inglés", "jóvenes", "lápiz", "mamá", "más", "médico", "música",
    "niño", "número", "papá", "país", "qué", "quién", "rápido", "sí", "también",
    "teléfono", "tú", "último", "árbol", "él", "éxito", "índice", "práctica",
    "público", "sofá", "corazón", "razón", "café", "estás", "estábamos", "inglés"
  ];

  const SPANISH_ACCENT_MAP = {
    a: "á", e: "é", i: "í", o: "ó", u: "ú",
    A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú"
  };

  function stripAccents(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function buildAccentIndex(words) {
    const index = {};
    words.forEach((word) => {
      const lower = word.toLowerCase();
      const key = stripAccents(lower);
      if (!(key in index)) {
        index[key] = lower;
      }
    });
    return index;
  }

  const FRENCH_ACCENT_INDEX = buildAccentIndex(FRENCH_ACCENT_WORDS);
  const SPANISH_ACCENT_INDEX = buildAccentIndex(SPANISH_ACCENT_WORDS);

  function applyCasePattern(template, word) {
    if (template.toUpperCase() === template) {
      return word.toUpperCase();
    }

    if (template[0] && template[0] === template[0].toUpperCase() && template.slice(1) === template.slice(1).toLowerCase()) {
      return word[0].toUpperCase() + word.slice(1);
    }

    return word;
  }

  function maybeAccentFromIndex(input, accentIndex) {
    const clean = input.replace(/[^A-Za-zÀ-ÿ'~]/g, "");
    if (!clean) return input;

    const lower = clean.toLowerCase();
    const lookup = stripAccents(lower);
    const accented = accentIndex[lookup];
    if (!accented || accented === lower) return input;

    return applyCasePattern(clean, accented);
  }

  function isConsonant(ch) {
    return ch in LEAD_INDEX;
  }

  function isVowel(ch) {
    return ch in VOWEL_INDEX;
  }

  function composeSyllable(lead, vowel, tail = "") {
    const l = LEAD_INDEX[lead];
    const v = VOWEL_INDEX[vowel];
    const t = TAIL_INDEX[tail];

    if (l === undefined || v === undefined || t === undefined) {
      return lead + vowel + tail;
    }

    const code = 0xac00 + (l * 21 + v) * 28 + t;
    return String.fromCharCode(code);
  }

  function keysToJamo(input) {
    return input
      .split("")
      .map((char) => KEY_TO_JAMO[char] || char)
      .join("");
  }

  function composeFromJamo(text) {
    const chars = Array.from(text);
    let i = 0;
    let out = "";

    while (i < chars.length) {
      const cur = chars[i];

      if (!isConsonant(cur)) {
        out += cur;
        i += 1;
        continue;
      }

      if (i + 1 >= chars.length || !isVowel(chars[i + 1])) {
        out += cur;
        i += 1;
        continue;
      }

      const lead = cur;
      let vowel = chars[i + 1];
      i += 2;

      if (i < chars.length && isVowel(chars[i])) {
        const combo = COMBINED_VOWELS[vowel + chars[i]];
        if (combo) {
          vowel = combo;
          i += 1;
        }
      }

      let tail = "";
      if (i < chars.length && isConsonant(chars[i])) {
        const c1 = chars[i];

        if (i + 1 < chars.length && isVowel(chars[i + 1])) {
          tail = "";
        } else if (i + 1 < chars.length && isConsonant(chars[i + 1])) {
          const c2 = chars[i + 1];
          const comboTail = COMBINED_TAILS[c1 + c2];

          if (comboTail && !(i + 2 < chars.length && isVowel(chars[i + 2]))) {
            tail = comboTail;
            i += 2;
          } else {
            tail = c1;
            i += 1;
          }
        } else {
          tail = c1;
          i += 1;
        }
      }

      out += composeSyllable(lead, vowel, tail);
    }

    return out;
  }

  function convertToKorean(input) {
    return composeFromJamo(keysToJamo(input));
  }

  function convertToFrench(input) {
    const clean = input.replace(/[^A-Za-zÀ-ÿ]/g, "").toLowerCase();
    if (FRENCH_PLAIN_WORDS.has(clean)) {
      return input;
    }
    return maybeAccentFromIndex(input, FRENCH_ACCENT_INDEX);
  }

  function convertToSpanish(input) {
    let out = input;

    out = out.replace(/([nN])~/g, (_, n) => (n === "N" ? "Ñ" : "ñ"));
    out = out.replace(/~([nN])/g, (_, n) => (n === "N" ? "Ñ" : "ñ"));

    Object.entries(SPANISH_ACCENT_MAP).forEach(([plain, accented]) => {
      const before = new RegExp(`${plain}'`, "g");
      const after = new RegExp(`'${plain}`, "g");
      out = out.replace(before, accented).replace(after, accented);
    });

    out = out.replace(/;/g, "ñ").replace(/:/g, "Ñ");
    return maybeAccentFromIndex(out, SPANISH_ACCENT_INDEX);
  }

  function convertWithLanguage(input, language) {
    switch (language) {
      case "spanish":
        return convertToSpanish(input);
      case "french":
        return convertToFrench(input);
      case "korean":
      default:
        return convertToKorean(input);
    }
  }

  window.convertToKorean = convertToKorean;
  window.convertWithLanguage = convertWithLanguage;
})();
