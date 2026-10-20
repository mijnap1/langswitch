// Precision harness for the Korean/English detector.
// Run: node tests/detector.test.js [--verbose]
//
// Simulates typing sentences word by word, in both directions:
//   forward: keyboard on English layout, Korean words come out as Latin keys
//   reverse: keyboard on Korean IME, English words come out as Hangul jamo
// and checks every word ends up in the language the writer intended.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const verbose = process.argv.includes("--verbose");

global.window = globalThis;
eval(fs.readFileSync(path.join(ROOT, "scripts/converter.js"), "utf8"));
eval(fs.readFileSync(path.join(ROOT, "scripts/detector.js"), "utf8"));

const detector = window.LangSwitchDetector;
detector.loadKoreanWords(fs.readFileSync(path.join(ROOT, "data/korean-words.txt"), "utf8"));
detector.loadEnglishCommon(fs.readFileSync(path.join(ROOT, "data/english-common.txt"), "utf8"));
detector.loadEnglishAll(fs.readFileSync(path.join(ROOT, "data/english-words.txt"), "utf8"));
// Korean runtime dictionary (data/korean-dict.tsv) is only loaded in the browser; that's fine here.

// Sentences are written the way the writer *meant* them.
const KOREAN = [
  "안녕하세요 반갑습니다",
  "오늘 뭐해",
  "지금 어디야",
  "나 지금 집에 가는 중",
  "밥 먹었어",
  "내일 몇 시에 만날래",
  "진짜 너무 피곤하다",
  "그래서 내가 말했잖아",
  "오늘 날씨 진짜 좋다",
  "이거 얼마예요",
  "고마워 다음에 또 보자",
  "미안해 늦어서",
  "숙제 다 했어",
  "시험 언제야",
  "나도 그렇게 생각해",
  "잘 자 내일 봐",
  "우리 같이 영화 볼래",
  "배고파 뭐 먹을까",
  "회의 몇 시에 시작해요",
  "확인했습니다 감사합니다",
  "그거 진짜 웃기다",
  "엄마한테 전화했어",
  "친구들이랑 놀러 갔어",
  "학교 끝나고 학원 가야 돼",
  "주말에 뭐 할 거야",
  "너 요즘 바빠",
  "아니 괜찮아",
  "응 알겠어",
  "그럼 이따 연락할게",
  "저는 학생입니다",
  "한국어 공부하고 있어요",
  "커피 한 잔 할래",
  "어제 너무 많이 먹었어",
  "이번 주 금요일에 시간 있어",
  "사진 보내줘",
  "와 대박 진짜 잘했다",
  "집에 가고 싶다",
  "선생님 질문 있습니다",
  "도와주셔서 감사해요",
  "버스 놓쳤어 조금 늦을 것 같아",
  "생일 축하해",
  "같이 가자",
  "이따가 카톡 할게",
  "오늘 수업 몇 시에 끝나",
  "물 좀 줘",
  "왜 이렇게 늦었어",
  "나 지금 회사야",
  "점심 뭐 먹었어",
  "다음 주에 여행 가",
  "그냥 집에 있을래",
  "안녕 내 이름은 지민이야",
  "오늘 내 생일이야"
];

const ENGLISH = [
  "hello how are you",
  "what are you doing tonight",
  "i think so too",
  "do you want to go home",
  "see you later",
  "thanks for the help",
  "i will be there soon",
  "can you send me the file",
  "the meeting is at three",
  "let me know when you are free",
  "this is so good",
  "no worries at all",
  "i am going to the store",
  "did you eat lunch",
  "we should go to the beach",
  "that sounds great",
  "i love this song",
  "where is the station",
  "good morning everyone",
  "please check the new version",
  "my phone is dead",
  "the dog is so cute",
  "i do not know",
  "go to sleep",
  "she said no",
  "an apple a day",
  "he is at the office",
  "it was a long day",
  "so what do you think",
  "lol that is funny",
  "ok see you soon",
  "the bus is late again",
  "i need more coffee",
  "happy birthday to you",
  "do it now",
  "to be or not to be",
  "what time is it",
  "how much is this",
  "call me when you get home",
  "this code has a bug",
  "the test failed again",
  "is it raining outside",
  "i got the job",
  "we won the game",
  "can we talk later",
  "turn off the light",
  "she is my best friend",
  "the city is very big",
  "he likes to cook",
  "check the github link"
];

// Held-out sets: vocabulary deliberately outside data/korean-words.txt and
// data/english-common.txt, to check the model generalises instead of memorising.
const KOREAN_HELD_OUT = [
  "택배 도착했대",
  "설거지 끝내고 빨래 개야지",
  "냉장고에 반찬 넣어놨어",
  "어떡해 지갑 잃어버렸나 봐",
  "짜증나 와이파이 또 끊겼어",
  "환불 신청은 어디서 해요",
  "주차장 자리 없더라",
  "할머니댁 다녀올게",
  "등산 가자고 했잖아",
  "까먹고 우산 안 챙겼다",
  "사진 좀 찍어줄래",
  "맞춤법 틀렸네",
  "출장 언제 끝나",
  "세탁기 고장났어",
  "졸업식 때 꽃 사갈게",
  "떡볶이 시켜 먹을까",
  "기차표 예매했어",
  "머리 자르러 미용실 가",
  "편의점 들렀다 갈게",
  "목요일까지 제출해야 돼",
  "벌써 퇴근했어",
  "강아지 산책 시키고 올게",
  "오늘따라 길이 막히네",
  "혹시 충전기 있어",
  "생각보다 괜찮던데"
];

const ENGLISH_HELD_OUT = [
  "the package arrived downtown",
  "please fill out this form",
  "my duty ends at noon",
  "the disk is almost full",
  "a duck swam across the pond",
  "the dorm wifi is down again",
  "she wrote a formal letter",
  "curl the request and check the response",
  "the auto save feature broke",
  "we need to refactor the parser",
  "grab some groceries on the way",
  "the forecast says thunderstorms",
  "this entity has no owner",
  "the anthem played before kickoff",
  "dusk is my favorite time",
  "he forked the repo yesterday",
  "the soldier saluted the general",
  "our quarterly revenue doubled",
  "dinosaurs went extinct long ago",
  "the violin solo was gorgeous"
];

// Mixed sentences: Hangul tokens are meant Korean, Latin tokens meant English.
const MIXED = [
  "오늘 meeting 몇 시야",
  "나 지금 zoom 들어가",
  "이거 github 에 올려줘",
  "내일 exam 있어",
  "lol 진짜 웃기다",
  "ok 알겠어",
  "그 movie 봤어",
  "카톡 말고 email 로 보내줘",
  "이번 project 진짜 힘들다",
  "나 coffee 마시러 갈래",
  "오늘 gym 갔어",
  "아 so cute",
  "너 instagram 해",
  "이거 bug 있는 것 같아",
  "deadline 언제야",
  "이 song 너무 좋아",
  "omg 대박",
  "그 app 이름 뭐야",
  "test 다 끝났어",
  "우리 team 진짜 최고"
];

function lettersOnly(word) {
  return word.replace(/[^A-Za-z가-힣ㄱ-ㆎ]/g, "");
}

// Typing a Korean word on an English layout.
function typeOnEnglishLayout(word) {
  return /[가-힣]/.test(word) ? window.hangulToKeys(word) : word;
}

// Typing an English word with the Korean IME on.
function typeOnKoreanIme(word) {
  if (/[가-힣]/.test(word)) return word;
  // IME composes exactly what composeFromJamo does (skip the runtime dict).
  return window.convertToKorean(word);
}

function judge(typed, direction, mode, before, after) {
  if (direction === "forward" && /^[A-Za-z]+$/.test(typed) && typed.length >= 2) {
    return detector.judgeLatinToKorean(typed, { mode, before, after });
  }
  if (direction === "reverse" && detector.isHangulToken(typed)) {
    return detector.judgeHangulToEnglish(typed, { mode, before, after });
  }
  return { convert: false };
}

// Mirrors content.js: convert on Space, and when a word converts, re-check up to
// LOOKBACK_WORDS unconverted words before it now that there is context on both sides.
const LOOKBACK_WORDS = 2;

function simulate(sentence, direction, mode) {
  const intended = sentence.split(/\s+/).filter(Boolean);
  const typed = intended.map((w) => (direction === "forward" ? typeOnEnglishLayout(w) : typeOnKoreanIme(w)));
  const output = [];

  typed.forEach((word, i) => {
    const before = output.join(" ");
    const verdict = judge(word, direction, mode, before, "");
    output.push(verdict.convert ? verdict.text : word);
    if (!verdict.convert) return;

    for (let j = i - 1; j >= Math.max(0, i - LOOKBACK_WORDS); j -= 1) {
      if (output[j] !== typed[j]) break;
      const prev = judge(typed[j], direction, mode, output.slice(0, j).join(" "), output.slice(j + 1).join(" "));
      if (!prev.convert) break;
      output[j] = prev.text;
    }
  });

  const errors = [];
  intended.forEach((target, i) => {
    if (output[i].toLowerCase() !== target.toLowerCase()) {
      errors.push({ target, typed: typed[i], output: output[i] });
    }
  });
  return { total: intended.length, errors, text: output.join(" ") };
}

function run(label, sentences, direction, mode) {
  let total = 0;
  const errors = [];
  sentences.forEach((s) => {
    const r = simulate(s, direction, mode);
    total += r.total;
    r.errors.forEach((e) => errors.push({ sentence: s, ...e }));
  });
  const accuracy = ((total - errors.length) / total) * 100;
  console.log(`${label.padEnd(34)} ${accuracy.toFixed(1).padStart(5)}%  (${errors.length} wrong / ${total} words)`);
  if (verbose) {
    errors.forEach((e) => {
      console.log(`    "${e.sentence}": meant ${e.target}, typed ${e.typed}, got ${e.output}`);
    });
  }
  return { total, errors: errors.length };
}

const MODES = process.argv.includes("--all-modes") ? ["strict", "balanced", "aggressive"] : ["balanced"];
let failures = 0;
MODES.forEach((mode) => {
  console.log(`\n[${mode}]`);
  const results = [
    run("Korean typed on English layout", KOREAN, "forward", mode),
    run("English stays English", ENGLISH, "forward", mode),
    run("Mixed, English layout", MIXED, "forward", mode),
    run("English typed in Korean IME", ENGLISH, "reverse", mode),
    run("Korean stays Korean (IME on)", KOREAN, "reverse", mode),
    run("Mixed, Korean IME", MIXED, "reverse", mode),
    run("Held-out Korean, English layout", KOREAN_HELD_OUT, "forward", mode),
    run("Held-out English stays English", ENGLISH_HELD_OUT, "forward", mode),
    run("Held-out English in Korean IME", ENGLISH_HELD_OUT, "reverse", mode),
    run("Held-out Korean stays (IME on)", KOREAN_HELD_OUT, "reverse", mode)
  ];
  failures += results.reduce((sum, r) => sum + r.errors, 0);
});

// Unit checks
const assert = require("assert");
assert.strictEqual(window.hangulToKeys("ㅗ디ㅣㅐ"), "hello");
assert.strictEqual(window.hangulToKeys("안녕하세요"), "dkssudgktpdy");
assert.strictEqual(window.hangulToKeys("왜"), "dho");
assert.strictEqual(window.hangulToKeys("없어"), "djqtdj");
assert.strictEqual(window.hangulToKeys("있다"), "dlTek");
console.log("\nunit checks passed");

if (process.argv.includes("--ci") && failures > 0) process.exit(1);
