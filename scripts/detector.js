(() => {
  // Korean <-> English decision model.
  //
  // Every token gets two evidence scores:
  //   korean  - how much the Hangul form looks like real Korean (syllable frequency,
  //             known words, particles/endings)
  //   english - how much the Latin form looks like real English (common words count
  //             far more than the long tail of obscure dictionary entries)
  // plus a context score from the surrounding words. The decision is
  //   (target evidence) - (source evidence) + context  >=  threshold(mode)

  const root = typeof window !== "undefined" ? window : globalThis;

  const DATA_FILES = {
    koreanWords: "data/korean-words.txt",
    englishCommon: "data/english-common.txt",
    englishAll: "data/english-words.txt"
  };

  // Roughly the 300 most frequent Hangul syllables in everyday / chat Korean.
  const CORE_SYLLABLES =
    "이다는의에하고가을를지서한기리사자로도대어아나수시해있으인주정구부게전일그국만상들보원소제내장과" +
    "니성동문비적마여우신라요거것면오경화개스치생위공실중히미관세데진무회계했저물방연행선학조터분말안" +
    "았었되된될속식간결모발산법단명유체본년월날때더또좀잘못왜뭐네응야너엄빠집밥먹갈갔와왔봐봤좋싫많같" +
    "않없났알줄줘할함합됐돼됨말씀께님요죠죠까냐래게걸건데던든랑려렇럼런렸루른를맞며몰몇받밤배번볼봄빨" +
    "사살새생서설셨손쇼수순술쉬습시싶쓰써아악앉알암았앞애야약얘어억언얼업없었엔여역연열영예오올와완왜" +
    "외요용우운울웃원월위유으은을음응의이익인일읽잃임입있잊자작잔잘잠장재저전점정제져조좀종좋죠주준줄" +
    "중즘지직진질짜쪽차참찾처천철첫청체쳐초최추축출충취치친카커케코크키타탁터토통트특티파판팔퍼편평포" +
    "표프피필하학한할함합해했행허현혹혼화확회후힘";

  const COMMON_SYLLABLES =
    "가각간갈감갑값강같개객거걱건걷걸검겁것게겠겨격견결겼경계고곡곤곧골곳공과관광괜교구국군굴굽권귀규" +
    "균그극근글금급긍기긴길김깊까깐깔깜깝깨꺼께꼬꼭꽃꾸꿈끄끈끊끝끼나낙난날남납났낮내냈냉냐너넌널넓넘" +
    "넣네넷녀녁년념녕노녹논놀농높놓놨뇌누눈뉴느는늘능늦니닌님다닥단닫달닭담답당닿대댁더덕던덜덤덥덧데" +
    "도독돈돌동돼된될두둑둘뒤드득든듣들듯등디딩따딱딸땅때떠떡떤떨떻또똑뚜뚫뛰뜨뜻띠라락란람랍랐랑래랜" +
    "램랫략량러럭런럴럼럽렀렇레려력련렬렵령례로록론롤롭뢰료루룩룹룰류륙률르른를름릇릎리린릴림립링마막" +
    "만많말맑맘맛망맞맡매맥맨맵맺머먹먼멀멈멋멍메멘며면명몇모목몬몰몸못묘무묵문묻물뭄뭐뭔뭘므미민믿밀" +
    "밍및밑바박밖반받발밝밟밤밥방밭배백뱃버번벌범법벗베벤벨벼벽변별병보복본볼봄봉봐봤뵙부북분불붉붙뷰" +
    "브블비빌빛빠빨빵빼뻐뻔뼈뽑뿌뿐쁘삐사삭산살삶삼샀상새색샌생샤서석섞선설섬섭섯성세섹센셋셔션셨소속" +
    "손솔솜송쇄쇠쇼수숙순술숨숫쉬쉽슈스슨슬슴습승시식신실싫심십싱싶싸싹쌀쌍쌓써썩썰썼쎄쏘쑥쓰쓴쓸씀씨" +
    "씩씬씻아악안앉않알앓암압았앙앞애액앨야약얀양얗얘어억언얹얻얼엄업없엇었엉에엔엘여역연열엷염엽엿였" +
    "영옆예옛오옥온올옮옳옷와완왕왜외왼요욕용우욱운울움웃웅워원월웨위윗유육윤으은을음응의이익인일읽잃" +
    "임입잇있잊잎자작잔잖잘잠잡장잦재쟁저적전절젊점접정젖제져졌조족존졸좀좁종좋좌죄주죽준줄줌줍중쥐즈" +
    "즉즌즐즘증지직진질짐집짓징짙짜짝짧째쨌쩌쩍쪽쫓쭉찌찍찢차착찬찮찰참창찾채책챙처척천철첨첫청체쳐초" +
    "촉촌총촬최추축춘출춤충취츠측층치칙친칠침칭카칸칼캐캠커컨컬컴컵컷케켜코콘콜콤콩쾌쿠퀴크큰클큼키킨" +
    "킬타탁탄탈탐탑탓탕태택탤터턱턴털텅테텍텐텔템토톤톨톱통퇴투툼퉁튀튜트특튼틀틈티틱팀팅파판팔팝패팬" +
    "팩퍼펀펄페펜펴편펼평폐포폭폰폴폼표푸푹풀품풍퓨프플피픽필핏하학한할함합항해핵핸햇했행향허헌험헤헬" +
    "혀혁현혈협형혜호혹혼홀홍화확환활황회획횟효후훈훌훨휘휴흐흑흔흘흙흥희흰히힌힐힘";

  // Particles / copula / common endings that attach to a known stem.
  const SUFFIXES = [
    "에서는", "에서도", "에게서", "한테서", "으로는", "으로도", "이라도", "이라서", "이라고",
    "이에요", "입니다", "이었어", "이었다", "였어요",
    "에서", "에게", "한테", "께서", "으로", "이랑", "하고", "까지", "부터", "처럼", "보다",
    "마다", "밖에", "이나", "라도", "이야", "예요", "이다", "이고", "이지", "이네", "인데",
    "이라", "라고", "랑은", "들이", "들은", "들을", "들도", "들한테", "였어", "였다", "이요",
    "은", "는", "이", "가", "을", "를", "에", "도", "만", "의", "와", "과", "로", "랑", "나",
    "야", "요", "들", "엔", "께", "죠", "지", "네", "다"
  ];
  // Verb/adjective endings that follow a noun to form X하다 / X되다 style words.
  const VERBAL_LEADS = new Set(["하", "해", "했", "할", "한", "합", "함", "되", "돼", "됐", "될", "된", "됨", "시", "적"]);

  // Laughing / crying jamo runs: ㅋㅋㅋ, ㅎㅎ, ㅋㅋㅎㅎ, ㅠㅠ, ㅜㅠ, ㅋㅋㅠㅠ.
  const CHAT_EMOTE = /^(?:[ㅋㅎ]+[ㅠㅜ]*|[ㅠㅜ]+)$/;
  // Initial-consonant abbreviations that are real chat words.
  const CHAT_ABBREVIATIONS = new Set([
    "ㅇㅇ", "ㅇㅋ", "ㄱㄱ", "ㄴㄴ", "ㅂㅂ", "ㄱㅅ", "ㅈㅅ", "ㅁㄹ", "ㅎㅇ", "ㅊㅋ", "ㄷㅇ", "ㅇㄹ",
    "ㅅㄱ", "ㅎㅇㅌ", "ㄱㄷ", "ㅃㅇ", "ㅃㅃ", "ㅇㅈ", "ㄹㅇ", "ㅈㅂ", "ㅁㅊ", "ㅅㅂ", "ㄱㅊ", "ㅈㄹ",
    "ㅇㄷ", "ㅁㅇ", "ㄴㅇㅅ", "ㅇㅈㄹ", "ㅂㅇ", "ㅎㅎㅎ", "ㅋㅋ", "ㄱㅇㄷ", "ㅇㅋㅇㅋ", "ㄱㄱㄱ"
  ]);

  const syllableWeight = new Map();
  const koreanWords = new Set();
  const englishCommon = new Set();
  const englishAll = new Set();
  const ready = { koreanWords: false, englishCommon: false, englishAll: false };

  function addSyllables(text, weight) {
    for (const ch of text) {
      if (!isSyllable(ch)) continue;
      if ((syllableWeight.get(ch) || -Infinity) < weight) syllableWeight.set(ch, weight);
    }
  }

  addSyllables(COMMON_SYLLABLES, 1.0);
  addSyllables(CORE_SYLLABLES, 1.6);

  function isSyllable(ch) {
    const code = ch.charCodeAt(0);
    return code >= 0xac00 && code <= 0xd7a3;
  }

  function isJamo(ch) {
    const code = ch.charCodeAt(0);
    return code >= 0x3131 && code <= 0x318e;
  }

  function isHangulToken(token) {
    return /^[가-힣ㄱ-ㆎ]+$/.test(token);
  }

  function isAllSyllables(token) {
    return /^[가-힣]+$/.test(token);
  }

  function isLatinToken(token) {
    return /^[A-Za-z]+$/.test(token);
  }

  // ---------------------------------------------------------------------------
  // Data loading

  function parseWordList(text) {
    const words = [];
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      trimmed.split(/\s+/).forEach((w) => {
        if (w) words.push(w);
      });
    });
    return words;
  }

  function loadKoreanWords(text) {
    parseWordList(text).forEach((word) => {
      koreanWords.add(word);
      addSyllables(word, 0.6);
    });
    ready.koreanWords = true;
  }

  function loadEnglishCommon(text) {
    parseWordList(text).forEach((word) => englishCommon.add(word.toLowerCase()));
    ready.englishCommon = true;
  }

  function loadEnglishAll(text) {
    text.split(/\r?\n/).forEach((word) => {
      const normalized = word.trim().toLowerCase();
      if (normalized) englishAll.add(normalized);
    });
    ready.englishAll = true;
  }

  async function fetchText(path) {
    if (!root.chrome || !chrome.runtime || !chrome.runtime.getURL) return null;
    try {
      const response = await fetch(chrome.runtime.getURL(path));
      return response.ok ? await response.text() : null;
    } catch (error) {
      return null;
    }
  }

  async function loadAll() {
    const [kw, ec, ea] = await Promise.all([
      fetchText(DATA_FILES.koreanWords),
      fetchText(DATA_FILES.englishCommon),
      fetchText(DATA_FILES.englishAll)
    ]);
    if (kw) loadKoreanWords(kw);
    if (ec) loadEnglishCommon(ec);
    if (ea) loadEnglishAll(ea);
  }

  // ---------------------------------------------------------------------------
  // English evidence

  const ENGLISH_SUFFIXES = [
    ["ies", "y"], ["es", ""], ["s", ""], ["ed", ""], ["ed", "e"], ["ing", ""], ["ing", "e"],
    ["ly", ""], ["er", ""], ["est", ""], ["ness", ""], ["ful", ""], ["less", ""], ["ment", ""]
  ];

  // Matches the word itself or its base form (sounds -> sound, stopped -> stop).
  function hasWordOrBase(set, lower) {
    if (set.has(lower)) return true;
    for (const [suffix, replacement] of ENGLISH_SUFFIXES) {
      if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
        const base = lower.slice(0, -suffix.length) + replacement;
        if (set.has(base)) return true;
        if (/(.)\1$/.test(base) && set.has(base.slice(0, -1))) return true;
      }
    }
    return false;
  }

  function isEnglishWord(word) {
    const lower = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!lower) return false;
    return hasWordOrBase(englishCommon, lower) || hasWordOrBase(englishAll, lower);
  }

  function englishEvidence(word) {
    const lower = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!lower) return -3;

    if (englishCommon.has(lower)) return lower.length <= 2 ? 4 : 5;
    if (hasWordOrBase(englishCommon, lower)) return 4;
    if (hasWordOrBase(englishAll, lower)) {
      // The big list is full of rare words, and short Korean key sequences hit it
      // by accident (gud=형, ro=개, tor=색). From 4 letters on, accidental hits
      // basically never happen (0 of ~1300 Korean words), so trust it more.
      if (lower.length <= 3) return 0.3;
      return lower.length === 4 ? 3 : lower.length === 5 ? 3.5 : 4;
    }

    // Not a dictionary word. Mild penalty, slightly more for long words.
    let score = lower.length >= 5 ? -2.2 : -1.4;
    // A real vowel pattern still looks a bit like an (unknown) English word / name.
    if (/[aeiou]/.test(lower) && !/[^aeiouy]{4,}/.test(lower)) score += 0.6;
    return score;
  }

  // ---------------------------------------------------------------------------
  // Korean evidence

  const RARE_VOWEL = /[ㅒㅖㅙㅞㅢ]/;

  function syllableScore(ch) {
    const weight = syllableWeight.get(ch);
    if (weight !== undefined) return weight;

    // Unknown syllable: penalise, more so when it has an unusual structure.
    const offset = ch.charCodeAt(0) - 0xac00;
    const vowelIndex = Math.floor((offset % 588) / 28);
    const tailIndex = offset % 28;
    let score = -2.0;
    if ([3, 5, 6, 10, 11, 12, 13, 14, 15, 18].includes(tailIndex)) score -= 0.8; // ㄳㄵㄶㄹ-clusters, ㅄ
    if (RARE_VOWEL.test("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"[vowelIndex])) score -= 0.6;
    return score;
  }

  function stripSuffix(token) {
    for (const suffix of SUFFIXES) {
      if (token.length > suffix.length && token.endsWith(suffix)) {
        const stem = token.slice(0, -suffix.length);
        if (koreanWords.has(stem)) return stem;
        // Two-level: 친구들한테 -> 친구들 -> 친구
        for (const inner of SUFFIXES) {
          if (stem.length > inner.length && stem.endsWith(inner) && koreanWords.has(stem.slice(0, -inner.length))) {
            return stem.slice(0, -inner.length);
          }
        }
      }
    }
    return null;
  }

  function lexiconScore(token) {
    const n = token.length;
    if (koreanWords.has(token)) return n === 1 ? 1.2 : n === 2 ? 3.2 : 4.2;

    const stem = stripSuffix(token);
    if (stem) return stem.length === 1 ? 1.6 : 3.4;

    // Known noun + verbal ending: 공부했어, 준비됐다, 확인해주세요
    for (let cut = Math.min(n - 1, 4); cut >= 2; cut -= 1) {
      if (koreanWords.has(token.slice(0, cut)) && VERBAL_LEADS.has(token[cut])) return 3.0;
    }
    // Known word followed by more known material: 같이가자, 집에가고싶다
    for (let cut = Math.min(n - 1, 5); cut >= 2; cut -= 1) {
      const head = token.slice(0, cut);
      const tail = token.slice(cut);
      if ((koreanWords.has(head) || stripSuffix(head)) && (koreanWords.has(tail) || stripSuffix(tail))) {
        return 3.0;
      }
    }
    return 0;
  }

  function koreanEvidence(token) {
    if (!token) return -6;
    if (!isAllSyllables(token)) return -6;

    const chars = Array.from(token);
    const total = chars.reduce((sum, ch) => sum + syllableScore(ch), 0);
    const average = total / chars.length;
    // Longer runs of plausible syllables are more convincing, up to a point.
    const plausibility = average * Math.min(chars.length, 4) * 0.9;
    return plausibility + lexiconScore(token);
  }

  function isChatJamo(token) {
    const chars = Array.from(token);
    if (chars.length < 2 || !chars.every(isJamo)) return false;
    if (CHAT_EMOTE.test(token)) return true;
    if (chars.every((ch) => ch === chars[0])) return true;
    return CHAT_ABBREVIATIONS.has(token);
  }

  // ---------------------------------------------------------------------------
  // Context

  const BEFORE_WEIGHTS = [1, 0.7, 0.5, 0.35, 0.25];
  const AFTER_WEIGHTS = [0.8, 0.4, 0.2];

  function tokenize(text) {
    return text.match(/[A-Za-z]+|[가-힣ㄱ-ㆎ]+/g) || [];
  }

  // +1 = clearly Korean, -1 = clearly English, 0 = unknown.
  function tokenVote(token) {
    if (isHangulToken(token)) {
      if (isChatJamo(token)) return 0.6;
      if (isAllSyllables(token)) {
        const keys = root.hangulToKeys ? root.hangulToKeys(token) : "";
        const english = keys ? englishEvidence(keys) : -3;
        // Hangul that is really English typed in Korean mode ("솓" = the)
        if (koreanEvidence(token) < 0 && english >= 4) return -0.8;
        // Ambiguous: 해 is also "go", 내 is also "so". Weak vote only.
        if (english >= 4) return 0.2;
        return 1;
      }
      const keys = root.hangulToKeys ? root.hangulToKeys(token) : "";
      return keys && englishEvidence(keys) >= 1 ? -0.8 : 0.3;
    }

    if (isLatinToken(token)) {
      const english = englishEvidence(token);
      const converted = root.convertToKorean ? root.convertToKorean(token) : token;
      const korean = isAllSyllables(converted) ? koreanEvidence(converted) : -6;
      if (english >= 3 && english >= korean) return korean >= 2 ? -0.6 : -1;
      if (korean - english >= 3) return 0.8; // Korean typed on an English layout
      if (english >= 1) return -0.4;
      return 0;
    }
    return 0;
  }

  function contextScore(before = "", after = "") {
    let score = 0;
    const prev = tokenize(before).slice(-BEFORE_WEIGHTS.length).reverse();
    prev.forEach((token, i) => {
      score += tokenVote(token) * BEFORE_WEIGHTS[i];
    });
    const next = tokenize(after).slice(0, AFTER_WEIGHTS.length);
    next.forEach((token, i) => {
      score += tokenVote(token) * AFTER_WEIGHTS[i];
    });
    return Math.max(-3, Math.min(3, score));
  }

  // ---------------------------------------------------------------------------
  // Decisions

  const THRESHOLDS = { strict: 3.5, balanced: 1.5, aggressive: 0.2 };
  const CONTEXT_WEIGHT = 1.4;

  // Latin token typed on an English layout -> should it become Korean?
  function judgeLatinToKorean(word, options = {}) {
    const mode = options.mode || "balanced";
    const converted = options.converted || (root.convertToKorean ? root.convertToKorean(word) : word);
    const result = { convert: false, text: converted, score: -Infinity };
    if (!isAllSyllables(converted)) return result;

    const korean = koreanEvidence(converted);
    const english = englishEvidence(word);
    let context = contextScore(options.before, options.after) + (options.prior || 0);
    // Korean on both sides ("안녕 so 이름" -> 내) is much stronger than either alone.
    if (contextScore(options.before, "") >= 0.7 && contextScore("", options.after) >= 0.5) context += 0.6;
    const score = korean - english + CONTEXT_WEIGHT * context;
    result.score = score;

    const syllables = converted.length;
    if (mode === "strict" && english >= 3) return result;
    if (syllables === 1) {
      // One-syllable words are the most ambiguous (go=해, so=내, do=애).
      if (english >= 3 && context < (mode === "aggressive" ? 0.3 : 0.6)) return result;
      if (english > 0 && context <= 0.2) return result;
      if (context <= (mode === "strict" ? 0 : -0.5)) return result;
    }
    // Common English words never flip without some Korean context.
    if (english >= 4 && context <= 0) return result;

    result.convert = score >= (THRESHOLDS[mode] ?? THRESHOLDS.balanced);
    return result;
  }

  // Hangul token typed in Korean IME mode -> should it become English?
  function judgeHangulToEnglish(token, options = {}) {
    const mode = options.mode || "balanced";
    const keys = root.hangulToKeys ? root.hangulToKeys(token) : "";
    const result = { convert: false, text: keys, score: -Infinity };
    if (!isHangulToken(token) || !isLatinToken(keys)) return result;
    if (isChatJamo(token)) return result;

    const english = englishEvidence(keys);
    const korean = koreanEvidence(token);
    // Only convert into words we know. Stray jamo ("효ㅡ") is never Korean, so a
    // rarer dictionary word is enough there.
    if (english < (korean <= -6 ? 0.3 : 1)) return result;

    const context = contextScore(options.before, options.after) + (options.prior || 0);
    const score = english - korean - CONTEXT_WEIGHT * context;
    result.score = score;

    if (Array.from(token).length === 1) {
      if (keys === "i") {
        // A lone ㅑ is never Korean; it's "I" unless we're mid-Korean sentence.
        if (context >= 0.5) return result;
      } else if (korean >= 1) {
        // Plausible syllable (애=do, 새=to, 해=go): needs English around it.
        if (context > (mode === "aggressive" ? -0.3 : -0.6)) return result;
      } else if (context >= (korean <= -6 ? -0.2 : 0.5)) {
        // Rare syllable (솓=the) or lone jamo (ㅁ=a).
        return result;
      }
    }
    // Real-looking Korean words need English context before we touch them.
    if (korean >= 2 && context >= 0) return result;
    if (mode === "strict" && korean > -2 && context > -1) return result;

    result.convert = score >= (THRESHOLDS[mode] ?? THRESHOLDS.balanced);
    if (result.convert && /^i$/i.test(keys)) result.text = "I";
    return result;
  }

  root.LangSwitchDetector = {
    loadAll,
    loadKoreanWords,
    loadEnglishCommon,
    loadEnglishAll,
    ready,
    isEnglishWord,
    englishEvidence,
    koreanEvidence,
    contextScore,
    isHangulToken,
    isChatJamo,
    judgeLatinToKorean,
    judgeHangulToEnglish
  };

  if (root.chrome && root.chrome.runtime && root.chrome.runtime.getURL) {
    loadAll();
  }
})();
