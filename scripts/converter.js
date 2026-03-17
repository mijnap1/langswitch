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

  const CHINESE_PINYIN_MAP = {
    ni: "你", hao: "好", ma: "吗", wo: "我", ai: "爱", ta: "他", men: "们",
    shi: "是", de: "的", bu: "不", zai: "在", you: "有", hen: "很", xiang: "想",
    yao: "要", qu: "去", lai: "来", hui: "会", kan: "看", ting: "听", shuo: "说",
    xie: "谢", qing: "请", dui: "对", cuo: "错", zhong: "中", guo: "国", ren: "人",
    tian: "天", qi: "气", jin: "今", ming: "明", zuo: "昨", wan: "晚", zao: "早",
    shang: "上", xia: "下", dian: "点", nian: "年", yue: "月", ri: "日", sheng: "生",
    gong: "工", xue: "学", xi: "习", jia: "家", peng: "朋",
    lao: "老", tong: "同", xiao: "小", da: "大", duo: "多",
    shao: "少", mei: "没", zhen: "真", piao: "漂", liang: "亮", gao: "高", xing: "兴",
    nihao: "你好", xiexie: "谢谢", zaijian: "再见", duibuqi: "对不起", meiguanxi: "没关系",
    woaini: "我爱你", zhongguo: "中国", zhongguoren: "中国人", wojia: "我家", women: "我们",
    pengyou: "朋友", laoshi: "老师", xuesheng: "学生", daxue: "大学", gongzuo: "工作",
    shijian: "时间", xianzai: "现在", jintianwan: "今晚", zaoshanghao: "早上好",
    qingwen: "请问", zenme: "怎么", shenme: "什么", weishenme: "为什么", yinwei: "因为",
    suoyi: "所以", keyi: "可以", buneng: "不能", xiangyao: "想要", xihuan: "喜欢",
    kaixin: "开心", nanshou: "难受", gaoxing: "高兴", meitian: "每天", dou: "都",
    tamen: "他们", jintian: "今天", mingtian: "明天", zuotian: "昨天", zaoan: "早安", wanan: "晚安",
    nihaoma: "你好吗", nihaoa: "你好啊", wohao: "我好", wohenhao: "我很好", womenhao: "我们好",
    nihaozaijian: "你好再见", xiexieni: "谢谢你", qingni: "请你", qingbangwo: "请帮我",
    qingdengyixia: "请等一下", qingzaishuo: "请再说", qingwenyixia: "请问一下",
    duoshaoqian: "多少钱", zhegeshaoqian: "这个多少钱", taiguile: "太贵了", pianyiyidian: "便宜一点",
    wobudong: "我不懂", wotingbudong: "我听不懂", wokanbudong: "我看不懂",
    nihuishuoyingyuma: "你会说英语吗", nikeyimanyidianma: "你可以慢一点吗",
    ceshi: "测试", wenti: "问题", daan: "答案", mingzi: "名字", shenfenzheng: "身份证",
    zheli: "这里", nali: "那里", nar: "哪儿", shei: "谁", nashenme: "拿什么", zenmeyang: "怎么样",
    haochi: "好吃", haokan: "好看", haoting: "好听", kuaile: "快乐", xingfu: "幸福",
    pengyoumen: "朋友们", laoshimen: "老师们", xueshengmen: "学生们", tongxue: "同学",
    chifan: "吃饭", heshui: "喝水", shuijiao: "睡觉", qichuang: "起床",
    shangban: "上班", xiaban: "下班", huijia: "回家", chumen: "出门", jinmen: "进门",
    kaihui: "开会", kaishi: "开始", jieshu: "结束", xianzaikaishi: "现在开始",
    keyima: "可以吗", haoma: "好吗", bukeyi: "不可以", meiwenti: "没问题",
    wozhidao: "我知道", wobuzhidao: "我不知道", womingbai: "我明白", wobumingbai: "我不明白",
    xuexiao: "学校", yiyuan: "医院", fandian: "饭店", jiudian: "酒店", jichang: "机场",
    ditie: "地铁", gonggongqiche: "公共汽车", huoche: "火车", chuzuche: "出租车",
    beijing: "北京", shanghai: "上海", guangzhou: "广州", shenzhen: "深圳",
    qinggeiwo: "请给我", woyaozhege: "我要这个", woyaonage: "我要那个",
    nv: "女", lv: "旅", lve: "略", nve: "虐",
    nvren: "女人", nvhai: "女孩", nvsheng: "女生",
    lvse: "绿色", lvshu: "绿树"
  };
  const CHINESE_PINYIN_KEYS = Object.keys(CHINESE_PINYIN_MAP).sort((a, b) => b.length - a.length);
  const JAPANESE_ROMAJI_MAP = {
    watashi: "私", anata: "あなた", kare: "彼", kanojo: "彼女", watashitachi: "私たち",
    arigatou: "ありがとう", ohayou: "おはよう", konnichiwa: "こんにちは", konbanwa: "こんばんは",
    sayonara: "さようなら", sumimasen: "すみません", gomen: "ごめん", gomenasai: "ごめんなさい",
    hai: "はい", iie: "いいえ", yoroshiku: "よろしく",
    nihon: "日本", nihongo: "日本語", sensei: "先生", tomodachi: "友達", daigaku: "大学",
    gakusei: "学生", kaisha: "会社", shigoto: "仕事", denwa: "電話", jikan: "時間",
    ima: "今", kyou: "今日", ashita: "明日", kinou: "昨日", asa: "朝", yoru: "夜",
    taberu: "食べる", nomu: "飲む", iku: "行く", kuru: "来る", miru: "見る", kiku: "聞く",
    hanasu: "話す", yomu: "読む", kaku: "書く", kau: "買う", uru: "売る",
    desu: "です", masu: "ます", dewa: "では", mata: "また", ne: "ね", yo: "よ",
    daijoubu: "大丈夫", suki: "好き", kirai: "嫌い", kawaii: "かわいい", oishii: "おいしい",
    itadakimasu: "いただきます", gochisousama: "ごちそうさま", otsukaresama: "お疲れ様",
    doumo: "どうも", doumoarigatou: "どうもありがとう", yoroshikuonegaishimasu: "よろしくお願いします",
    onegaishimasu: "お願いします", genki: "元気", ogenki: "お元気", genkidesu: "元気です",

    doko: "どこ", nani: "なに", nande: "なんで", doushite: "どうして", ikura: "いくら",
    nanji: "何時", kyouwa: "今日は", ashitawa: "明日は", kinouwa: "昨日は",
    kore: "これ", sore: "それ", are: "あれ", dore: "どれ", koko: "ここ", soko: "そこ", asoko: "あそこ",
    chotto: "ちょっと", matte: "待って", mattekudasai: "待ってください", kudasai: "ください",
    wakarimasu: "わかります", wakarimasen: "わかりません", shitteimasu: "知っています",
    shirimasen: "知りません", daijoubudesu: "大丈夫です", mondainai: "問題ない",
    sugoi: "すごい", kawaiidesu: "かわいいです", oishiidesu: "おいしいです",
    tabemasu: "食べます", nomimasu: "飲みます", ikimasu: "行きます", kimasu: "来ます",
    mimasu: "見ます", kikimasu: "聞きます", yomimasu: "読みます", kakimasu: "書きます",
    kaimasu: "買います", urimasu: "売ります", benkyou: "勉強", benkyoushimasu: "勉強します",
    kaigi: "会議", jisho: "辞書", hon: "本",
    tokyo: "東京", osaka: "大阪", kyoto: "京都", hokkaido: "北海道",
    nihonjin: "日本人", gaikokujin: "外国人", tomodachitachi: "友達たち", kazoku: "家族",
    okaasan: "お母さん", otousan: "お父さん", oniisan: "お兄さん", oneesan: "お姉さん",
    kono: "この", sono: "その", ano: "あの", dono: "どの", takai: "高い", yasui: "安い",
    atsui: "暑い", samui: "寒い", isogashii: "忙しい", tanoshii: "楽しい", ureshii: "嬉しい",
    kanashii: "悲しい", muzukashii: "難しい", kantan: "簡単", jouzu: "上手", heta: "下手",
    oyasumi: "おやすみ", oyasuminasai: "おやすみなさい"
  };
  const JAPANESE_ROMAJI_KEYS = Object.keys(JAPANESE_ROMAJI_MAP).sort((a, b) => b.length - a.length);
  const ROMAJI_TO_HIRAGANA = {
    kya: "きゃ", kyu: "きゅ", kyo: "きょ", sha: "しゃ", shu: "しゅ", sho: "しょ",
    cha: "ちゃ", chu: "ちゅ", cho: "ちょ", nya: "にゃ", nyu: "にゅ", nyo: "にょ",
    hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ", mya: "みゃ", myu: "みゅ", myo: "みょ",
    rya: "りゃ", ryu: "りゅ", ryo: "りょ", gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
    ja: "じゃ", ju: "じゅ", jo: "じょ", bya: "びゃ", byu: "びゅ", byo: "びょ",
    pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
    tsu: "つ", shi: "し", chi: "ち", fu: "ふ", ji: "じ",
    si: "し", ti: "ち", tu: "つ", hu: "ふ", zi: "じ", di: "ぢ", du: "づ",
    ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
    sa: "さ", su: "す", se: "せ", so: "そ",
    ta: "た", te: "て", to: "と",
    na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
    ha: "は", hi: "ひ", he: "へ", ho: "ほ",
    ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
    ya: "や", yu: "ゆ", yo: "よ",
    ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
    wa: "わ", wo: "を",
    ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
    za: "ざ", zu: "ず", ze: "ぜ", zo: "ぞ",
    da: "だ", de: "で", do: "ど",
    ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
    pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
    a: "あ", i: "い", u: "う", e: "え", o: "お",
    n: "ん"
  };
  const ROMAJI_KEYS = Object.keys(ROMAJI_TO_HIRAGANA).sort((a, b) => b.length - a.length);
  const DICT_FILES = {
    korean: "data/korean-dict.tsv",
    chinese: "data/chinese-dict.tsv",
    japanese: "data/japanese-dict.tsv"
  };
  const MIN_RUNTIME_SCORE = {
    korean: 10,
    chinese: 20,
    japanese: 20
  };
  const RUNTIME_DICT = {
    korean: new Map(),
    chinese: new Map(),
    japanese: new Map()
  };
  const DICT_READY = {
    korean: false,
    chinese: false,
    japanese: false
  };

  function addRuntimeCandidate(language, key, value, score = 1) {
    if (!key || !value) return;
    const map = RUNTIME_DICT[language];
    if (!map) return;

    const existing = map.get(key) || [];
    existing.push({ value, score: Number(score) || 1 });
    existing.sort((a, b) => b.score - a.score);
    map.set(key, existing);
  }

  function getTopRuntimeCandidate(language, key) {
    const map = RUNTIME_DICT[language];
    if (!map) return null;
    const list = map.get(key);
    if (!list || list.length === 0) return null;
    return list[0].value;
  }

  function getRuntimeKeysSorted(language, fallbackKeys) {
    const map = RUNTIME_DICT[language];
    const runtimeKeys = map ? Array.from(map.keys()) : [];
    if (runtimeKeys.length === 0) return fallbackKeys;
    return runtimeKeys.sort((a, b) => b.length - a.length);
  }

  function parseDictTsv(language, text) {
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const parts = trimmed.split("\t");
      if (parts.length < 2) return;
      const key = parts[0].trim().toLowerCase();
      const value = parts[1].trim();
      const score = parts[2] ? Number(parts[2].trim()) : 1;
      const normalizedScore = Number.isFinite(score) ? score : 1;
      const minScore = MIN_RUNTIME_SCORE[language] || 1;
      if (normalizedScore < minScore) return;
      addRuntimeCandidate(language, key, value, normalizedScore);
    });
  }

  async function loadRuntimeDictionary(language, path) {
    if (!window.chrome || !chrome.runtime || !chrome.runtime.getURL) return;
    try {
      const url = chrome.runtime.getURL(path);
      const response = await fetch(url);
      if (!response.ok) return;
      const text = await response.text();
      parseDictTsv(language, text);
      DICT_READY[language] = true;
    } catch (error) {
      // Keep fallback conversion behavior if dictionary loading fails.
    }
  }

  function preloadBuiltInRuntimeDictionary() {
    Object.entries(CHINESE_PINYIN_MAP).forEach(([key, value]) => {
      addRuntimeCandidate("chinese", key, value, key.length);
    });
    Object.entries(JAPANESE_ROMAJI_MAP).forEach(([key, value]) => {
      addRuntimeCandidate("japanese", key, value, key.length);
    });
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
    const normalized = input.toLowerCase().replace(/[^a-z]/g, "");
    if (normalized) {
      const dictMatch = getTopRuntimeCandidate("korean", normalized);
      if (dictMatch) return dictMatch;
    }
    return composeFromJamo(keysToJamo(input));
  }

  function normalizePinyin(input) {
    // 'v' is kept as-is (falls within a-z) since it substitutes ü in many input methods (nv→女, lv→旅)
    return input.toLowerCase().replace(/[^a-z]/g, "");
  }

  function convertToChinese(input) {
    const normalized = normalizePinyin(input);
    if (!normalized) return input;

    const direct = getTopRuntimeCandidate("chinese", normalized);
    if (direct) {
      return direct;
    }

    const cjkKeys = getRuntimeKeysSorted("chinese", CHINESE_PINYIN_KEYS);
    let i = 0;
    let out = "";
    while (i < normalized.length) {
      let matched = false;
      for (const key of cjkKeys) {
        if (normalized.startsWith(key, i)) {
          const candidate = getTopRuntimeCandidate("chinese", key) || CHINESE_PINYIN_MAP[key];
          if (!candidate) continue;
          out += candidate;
          i += key.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        return input;
      }
    }

    return out || input;
  }

  function normalizeRomaji(input) {
    return input.toLowerCase().replace(/[^a-z]/g, "");
  }

  function convertToJapanese(input) {
    const normalized = normalizeRomaji(input);
    if (!normalized) return input;

    const direct = getTopRuntimeCandidate("japanese", normalized);
    if (direct) {
      return direct;
    }

    const jpKeys = getRuntimeKeysSorted("japanese", JAPANESE_ROMAJI_KEYS);
    let i = 0;
    let out = "";
    while (i < normalized.length) {
      let matched = false;

      for (const key of jpKeys) {
        if (normalized.startsWith(key, i)) {
          const candidate = getTopRuntimeCandidate("japanese", key) || JAPANESE_ROMAJI_MAP[key];
          if (!candidate) continue;
          out += candidate;
          i += key.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // small tsu for doubled consonants (except n)
      if (
        i + 1 < normalized.length &&
        normalized[i] === normalized[i + 1] &&
        /[bcdfghjklmpqrstvwxyz]/.test(normalized[i]) &&
        normalized[i] !== "n"
      ) {
        out += "っ";
        i += 1;
        continue;
      }

      for (const key of ROMAJI_KEYS) {
        if (normalized.startsWith(key, i)) {
          out += ROMAJI_TO_HIRAGANA[key];
          i += key.length;
          matched = true;
          break;
        }
      }

      if (!matched) return input;
    }

    return out || input;
  }

  function convertWithLanguage(input, language) {
    switch (language) {
      case "japanese":
        return convertToJapanese(input);
      case "chinese":
        return convertToChinese(input);
      case "korean":
      default:
        return convertToKorean(input);
    }
  }

  preloadBuiltInRuntimeDictionary();
  loadRuntimeDictionary("korean", DICT_FILES.korean);
  loadRuntimeDictionary("chinese", DICT_FILES.chinese);
  loadRuntimeDictionary("japanese", DICT_FILES.japanese);

  window.convertToKorean = convertToKorean;
  window.convertWithLanguage = convertWithLanguage;
})();
