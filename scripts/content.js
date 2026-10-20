(() => {
  const SUPPORTED_LANGUAGES = new Set(["korean", "chinese", "japanese"]);
  let lastSuggestion = null;
  let lastAutoConversion = null;
  let isAutoConverting = false;
  let hintTimer = null;
  // localStorage.langswitchDebug = "1" in a page's console, then reload,
  // to log what LangSwitch does there.
  const DEBUG = (() => {
    try {
      return window.localStorage.getItem("langswitchDebug") === "1";
    } catch (error) {
      return false;
    }
  })();
  // Word finished by a Space in a rich editor, converted once the space lands.
  let pendingBoundary = null;
  const TOOLTIP_CLASS = "layout-fix-tooltip";
  const HINT_CLASS = "layout-fix-hint";
  // When a word converts, re-check up to this many unconverted words before it.
  const LOOKBACK_WORDS = 2;
  const MAX_LEARNED_WORDS = 500;
  const LATIN_WORD_END = /[A-Za-z';~]{2,}$/;
  const HANGUL_WORD_END = /[가-힣ㄱ-ㆎ]+$/;

  const DEFAULT_SETTINGS = {
    language: "korean",
    contextMode: "balanced",
    tooltipTheme: "liquid-glass",
    appearance: "auto",
    autoConvert: true,
    reverseConvert: true,
    koreanSlangMode: true,
    fullWidthPunctuation: true,
    chineseUseV: true,
    japaneseKanaOnly: false,
    siteRules: {}
  };

  // Words undone twice; never auto-converted again. { word: timestamp }
  let learnedWords = {};
  // How often each word was undone, across sessions. { word: count }
  let undoCounts = {};
  // Words undone once on this page: left alone until the page reloads.
  const sessionSkips = new Set();
  const UNDOS_TO_LEARN = 2;
  // Language of recently committed words on this page (+1 Korean, -1 English).
  // Gives the first word of a fresh chat box some context.
  const recentLanguages = [];

  const COMMON_ENGLISH_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
    "can", "could", "did", "do", "does", "done", "for", "from", "had", "has",
    "have", "he", "her", "here", "hers", "him", "his", "how", "however", "i",
    "if", "in", "into", "is", "it", "its", "just", "like", "me", "more", "my",
    "not", "of", "on", "or", "our", "out", "really", "she", "should", "so",
    "some", "than", "that", "the", "their", "them", "then", "there", "they",
    "this", "to", "too", "up", "very", "was", "we", "were", "what", "when",
    "where", "which", "who", "why", "will", "with", "would", "you", "your"
  ]);

  const CHINESE_AMBIGUOUS_SYLLABLES = new Set([
    "a", "ai", "an", "ang", "ba", "da", "de", "di", "do", "he", "in", "is", "it",
    "la", "li", "ma", "me", "na", "ne", "no", "on", "ou", "qi", "so", "ta", "to",
    "we", "wo", "ya", "yo", "you"
  ]);
  const JAPANESE_AMBIGUOUS_ROMAJI = new Set([
    "a", "an", "as", "at", "do", "go", "ha", "he", "hi", "i", "in", "is", "it",
    "ka", "me", "mi", "na", "ne", "no", "on", "to", "we", "yo", "so"
  ]);
  const KOREAN_SLANG_BY_KEY = new Map([
    ["dd", "ㅇㅇ"],
    ["ddd", "ㅇㅇㅇ"],
    ["dddd", "ㅇㅇㅇㅇ"],
    ["dz", "ㅇㅋ"],
    ["dzdz", "ㅇㅋㅇㅋ"],
    ["rr", "ㄱㄱ"],
    ["rrr", "ㄱㄱㄱ"],
    ["ss", "ㄴㄴ"],
    ["sss", "ㄴㄴㄴ"],
    ["qq", "ㅂㅂ"],
    ["qqq", "ㅂㅂㅂ"],
    ["rt", "ㄱㅅ"],
    ["wt", "ㅈㅅ"],
    ["af", "ㅁㄹ"],
    ["gd", "ㅎㅇ"],
    ["cv", "ㅊㅋ"],
    ["eo", "ㄷㅇ"],
    ["df", "ㅇㄹ"]
  ]);
  let settings = { ...DEFAULT_SETTINGS };

  async function loadSettings() {
    if (!window.chrome || !chrome.storage || !chrome.storage.sync) return;
    try {
      const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      settings = { ...DEFAULT_SETTINGS, ...stored };
      if (!SUPPORTED_LANGUAGES.has(settings.language)) {
        settings.language = DEFAULT_SETTINGS.language;
        await chrome.storage.sync.set({ language: settings.language });
      }
    } catch (error) {
      settings = { ...DEFAULT_SETTINGS };
    }
  }

  function watchSettings() {
    if (!window.chrome || !chrome.storage || !chrome.storage.onChanged) return;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        if (changes.learnedWords) learnedWords = changes.learnedWords.newValue || {};
        if (changes.undoCounts) undoCounts = changes.undoCounts.newValue || {};
        return;
      }
      if (areaName !== "sync") return;

      Object.keys(DEFAULT_SETTINGS).forEach((key) => {
        if (changes[key]) {
          settings[key] = changes[key].newValue;
        }
      });
      refreshUIAfterSettingsChange();
    });
  }

  function refreshUIAfterSettingsChange() {
    removeSuggestion();
    const active = document.activeElement;
    if (isSupportedInput(active)) {
      maybeShowSuggestion(active);
    }
  }

  async function loadLearnedWords() {
    if (!window.chrome || !chrome.storage || !chrome.storage.local) return;
    try {
      const stored = await chrome.storage.local.get({ learnedWords: {}, undoCounts: {} });
      learnedWords = stored.learnedWords || {};
      undoCounts = stored.undoCounts || {};
    } catch (error) {
      learnedWords = {};
    }
  }

  function learnedKey(word) {
    return /[A-Za-z]/.test(word) ? word.toLowerCase() : word;
  }

  function isLearnedException(word) {
    const key = learnedKey(word);
    return sessionSkips.has(key) || Object.prototype.hasOwnProperty.call(learnedWords, key);
  }

  // A single Backspace right after a conversion is common (fixing a typo), so
  // the first undo only applies to this page; the second one is remembered.
  // Returns true when the word is now permanently learned.
  function noteUndo(word) {
    const key = learnedKey(word);
    sessionSkips.add(key);
    const count = (undoCounts[key] || 0) + 1;
    const next = { ...undoCounts, [key]: count };
    const keys = Object.keys(next);
    if (keys.length > MAX_LEARNED_WORDS) delete next[keys[0]];
    undoCounts = next;
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ undoCounts: next }).catch(() => {});
    }
    if (count < UNDOS_TO_LEARN) return false;
    learnException(word);
    return true;
  }

  function learnException(word) {
    const key = learnedKey(word);
    const next = { ...learnedWords, [key]: Date.now() };
    const keys = Object.keys(next);
    if (keys.length > MAX_LEARNED_WORDS) {
      keys.sort((a, b) => next[a] - next[b]).slice(0, keys.length - MAX_LEARNED_WORDS).forEach((k) => {
        delete next[k];
      });
    }
    learnedWords = next;
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ learnedWords: next }).catch(() => {});
    }
  }

  function debugLog(...args) {
    if (DEBUG) console.log("[LangSwitch]", ...args);
  }

  function getDetector() {
    return window.LangSwitchDetector || null;
  }

  function recordLanguage(word) {
    const detector = getDetector();
    if (!word || !detector) return;
    let vote = 0;
    if (/^[가-힣]+$/.test(word)) vote = 1;
    else if (/^[A-Za-z]+$/.test(word) && detector.englishEvidence(word) >= 3) vote = -1;
    if (!vote) return;
    recentLanguages.push(vote);
    if (recentLanguages.length > 12) recentLanguages.shift();
  }

  function getSessionPrior() {
    let sum = 0;
    let weight = 1;
    for (let i = recentLanguages.length - 1; i >= 0; i -= 1) {
      sum += recentLanguages[i] * weight;
      weight *= 0.8;
    }
    return Math.max(-0.5, Math.min(0.5, sum * 0.12));
  }

  function getContext(el, start, end) {
    const text = getEditableText(el);
    return {
      before: text.slice(Math.max(0, start - 80), start),
      after: text.slice(end, end + 40)
    };
  }

  function isPlainInput(el) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      return false;
    }

    if (el instanceof HTMLTextAreaElement) {
      return true;
    }

    const supportedTypes = new Set(["", "text", "search", "url", "tel", "email"]);
    return supportedTypes.has(el.type);
  }

  function getEditableTarget(target) {
    if (isPlainInput(target)) return target;
    if (!(target instanceof Element)) return null;

    const contentEditable = target.closest("[contenteditable='true'], [contenteditable='plaintext-only']");
    if (contentEditable instanceof HTMLElement) return contentEditable;

    const root = target.getRootNode ? target.getRootNode() : null;
    if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
      if (isPlainInput(root.host)) return root.host;
      if (root.host.isContentEditable) return root.host;
    }

    return null;
  }

  function getSelectionEditableTarget() {
    const active = document.activeElement;
    if (isPlainInput(active)) return active;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const node = sel.anchorNode;
    if (!node) return null;

    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!(el instanceof Element)) return null;

    return getEditableTarget(el);
  }

  function resolveEditableTargetFromEventTarget(target) {
    return getEditableTarget(target) || getSelectionEditableTarget() || getEditableTarget(document.activeElement);
  }

  function isSupportedInput(target) {
    return Boolean(getEditableTarget(target));
  }

  // Rich editors on these sites don't take conversions reliably yet, so they
  // start paused. The popup's site toggle (siteRules) still overrides this.
  const OFF_BY_DEFAULT_HOSTS = ["instagram.com", "discord.com"];

  function isOffByDefault(host) {
    return OFF_BY_DEFAULT_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  function isEnabledOnCurrentSite() {
    const host = window.location.hostname;
    if (!host) return true;

    const rule = (settings.siteRules || {})[host];
    if (typeof rule === "boolean") return rule;
    return !isOffByDefault(host);
  }

  function looksLikeAlphaWord(word) {
    return /^[a-z]{2,}$/i.test(word);
  }

  function normalizeLatinWord(word) {
    return word.toLowerCase().replace(/[^a-z]/g, "");
  }

  function isLikelyEnglishWord(word) {
    const lower = word.toLowerCase();
    if (COMMON_ENGLISH_WORDS.has(lower)) return true;
    const detector = getDetector();
    if (detector && detector.isEnglishWord(lower)) return true;

    const hasVowel = /[aeiou]/.test(lower);
    if (!hasVowel || lower.length < 4) return false;

    const commonEndings = [
      "ing", "ed", "ly", "tion", "ment", "ness", "able", "ible", "ous", "ive", "ful", "less"
    ];
    return commonEndings.some((ending) => lower.endsWith(ending));
  }

  function isDarkAppearance() {
    if (settings.appearance === "dark") return true;
    if (settings.appearance === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function removeSuggestion() {
    const existing = document.querySelector(`.${TOOLTIP_CLASS}`);
    if (existing) existing.remove();
    lastSuggestion = null;
  }

  function clearLastAutoConversion() {
    lastAutoConversion = null;
  }

  // Theme styles live in scripts/themes.js (shared with the popup preview).
  // Applied after the element is in the DOM, since Liquid Glass measures it.
  function applyTooltipTheme(tooltip) {
    if (window.LangSwitchThemes) {
      window.LangSwitchThemes.apply(tooltip, settings.tooltipTheme, isDarkAppearance(), {
        adaptive: (settings.appearance || "auto") === "auto"
      });
    }
  }

  function showSuggestion(element, suggestion) {
    removeSuggestion();

    const tooltip = document.createElement("div");
    tooltip.className = TOOLTIP_CLASS;
    tooltip.textContent = `Convert to: ${suggestion}`;

    tooltip.style.position = "absolute";
    tooltip.style.padding = "8px 12px";
    tooltip.style.fontSize = "12px";
    tooltip.style.fontWeight = "700";
    tooltip.style.fontFamily = "'Poppins', 'Inter', 'Segoe UI', sans-serif";
    tooltip.style.letterSpacing = "0.15px";
    tooltip.style.lineHeight = "1.2";
    tooltip.style.zIndex = "999999";
    const rect = getTooltipAnchorRect(element);
    tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(tooltip);
    applyTooltipTheme(tooltip);
    lastSuggestion = { element, suggestion };
  }

  function removeHint() {
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    const existing = document.querySelector(`.${HINT_CLASS}`);
    if (existing) existing.remove();
  }

  // Small, short-lived note after an auto-conversion or undo.
  function showHint(element, message, duration = 2400) {
    removeHint();
    if (!document.body) return;

    const hint = document.createElement("div");
    hint.className = HINT_CLASS;
    hint.textContent = message;
    hint.style.position = "absolute";
    hint.style.padding = "5px 10px";
    hint.style.fontSize = "11px";
    hint.style.fontWeight = "600";
    hint.style.fontFamily = "'Poppins', 'Inter', 'Segoe UI', sans-serif";
    hint.style.lineHeight = "1.2";
    hint.style.zIndex = "999999";
    hint.style.pointerEvents = "none";
    hint.style.opacity = "0.92";
    const rect = getTooltipAnchorRect(element);
    hint.style.top = `${rect.bottom + window.scrollY + 6}px`;
    hint.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(hint);
    applyTooltipTheme(hint);
    hintTimer = setTimeout(removeHint, duration);
  }

  function showConvertedHint(element, original, converted) {
    showHint(element, `${original} → ${converted}  ·  ⌫ undo`);
  }

  function getTooltipAnchorRect(el) {
    if (isPlainInput(el)) {
      return el.getBoundingClientRect();
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) {
        return rect;
      }
    }

    return el.getBoundingClientRect();
  }

  function getEditableText(el) {
    if (isPlainInput(el)) return el.value;
    return el.textContent || "";
  }

  function getCaretOffset(el) {
    if (isPlainInput(el)) {
      return typeof el.selectionStart === "number" ? el.selectionStart : null;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.endContainer)) return null;

    const preCaret = range.cloneRange();
    preCaret.selectNodeContents(el);
    preCaret.setEnd(range.endContainer, range.endOffset);
    return preCaret.toString().length;
  }

  function isReverseEnabled() {
    return settings.language === "korean" && settings.reverseConvert !== false;
  }

  // Latin word (forward) or, with reverse conversion on, a Hangul word ending at `text`'s end.
  function matchWordAtEnd(text) {
    const latin = text.match(LATIN_WORD_END);
    if (latin) return { word: latin[0], script: "latin" };
    if (isReverseEnabled()) {
      const hangul = text.match(HANGUL_WORD_END);
      if (hangul) return { word: hangul[0], script: "hangul" };
    }
    return null;
  }

  function getWordBeforeCaret(el) {
    const caret = getCaretOffset(el);
    if (caret === null || caret === undefined) return null;

    const text = getEditableText(el);
    const match = matchWordAtEnd(text.slice(0, caret));
    if (!match) return null;

    return {
      word: match.word,
      script: match.script,
      start: caret - match.word.length,
      end: caret
    };
  }

  function getCurrentWordAtCaret(el) {
    const caret = getCaretOffset(el);
    if (caret === null || caret === undefined) return null;

    const value = getEditableText(el);
    const left = value.slice(0, caret);
    const right = value.slice(caret);

    const leftLatin = (left.match(/[A-Za-z';~]{0,}$/) || [""])[0];
    const rightLatin = (right.match(/^[A-Za-z';~]{0,}/) || [""])[0];
    const latinWord = leftLatin + rightLatin;
    if (looksLikeAlphaWord(latinWord.replace(/[^A-Za-z]/g, ""))) {
      return {
        word: latinWord,
        script: "latin",
        start: caret - leftLatin.length,
        end: caret + rightLatin.length
      };
    }

    if (!isReverseEnabled()) return null;
    const leftHangul = (left.match(/[가-힣ㄱ-ㆎ]*$/) || [""])[0];
    const rightHangul = (right.match(/^[가-힣ㄱ-ㆎ]*/) || [""])[0];
    const hangulWord = leftHangul + rightHangul;
    if (!hangulWord) return null;
    return {
      word: hangulWord,
      script: "hangul",
      start: caret - leftHangul.length,
      end: caret + rightHangul.length
    };
  }

  function getSpaceBoundaryLength(text, offset) {
    const char = text[offset];
    return char === " " || char === "\u00A0" || char === "\n" ? 1 : 0;
  }

  // `trigger` is the word the user just finished; it's what gets learned on undo.
  function rememberAutoConversion(el, start, original, converted, trigger = original) {
    if (!el || original === converted) {
      clearLastAutoConversion();
      return;
    }

    lastAutoConversion = {
      el,
      start,
      original,
      converted,
      trigger
    };
  }

  function canUndoLastAutoConversion(el) {
    if (!lastAutoConversion || lastAutoConversion.el !== el) return null;

    const caret = getCaretOffset(el);
    if (caret === null || caret === undefined) return null;

    const text = getEditableText(el);
    const { start, original, converted } = lastAutoConversion;
    const convertedEnd = start + converted.length;
    const boundaryLength = getSpaceBoundaryLength(text, convertedEnd);
    if (!boundaryLength) return null;
    if (caret !== convertedEnd + boundaryLength) return null;
    if (text.slice(start, convertedEnd) !== converted) return null;

    return {
      start,
      end: convertedEnd + boundaryLength,
      replacement: original
    };
  }

  function undoLastAutoConversion(el) {
    const undoRange = canUndoLastAutoConversion(el);
    if (!undoRange) return false;

    const { trigger } = lastAutoConversion;
    replaceRange(el, undoRange.start, undoRange.end, undoRange.replacement);
    clearLastAutoConversion();
    removeSuggestion();
    const learned = noteUndo(trigger);
    showHint(el, learned
      ? `Kept \u201c${trigger}\u201d \u00b7 won't auto-convert it again`
      : `Kept \u201c${trigger}\u201d`, 2800);
    return true;
  }

  function hasScriptAround(el, start, end, pattern) {
    const left = Math.max(0, start - 24);
    const text = getEditableText(el);
    const right = Math.min(text.length, end + 24);
    return pattern.test(text.slice(left, right));
  }

  // Returns { text, approvedSlang } when the word should be converted, else null.
  // `context` overrides the surrounding text (used when re-checking earlier words).
  function evaluateWord(el, wordInfo, context = getContext(el, wordInfo.start, wordInfo.end)) {
    if (isLearnedException(wordInfo.word)) return null;

    if (wordInfo.script === "hangul") {
      const detector = getDetector();
      if (!isReverseEnabled() || !detector) return null;
      const verdict = detector.judgeHangulToEnglish(wordInfo.word, {
        mode: settings.contextMode,
        before: context.before,
        after: context.after,
        prior: getSessionPrior()
      });
      return verdict.convert ? { text: verdict.text, approvedSlang: false } : null;
    }

    const candidate = getConvertedWord(wordInfo.word, context);
    return isGoodCandidate(el, wordInfo, candidate, context) ? candidate : null;
  }

  function getConvertedWord(word, context) {
    const slang = getKoreanSlangConversion(word, context);
    if (slang) return slang;

    if (!window.convertWithLanguage) {
      const text = window.convertToKorean ? window.convertToKorean(word) : word;
      return { text, approvedSlang: false };
    }
    return {
      text: window.convertWithLanguage(word, settings.language, { kanaOnly: Boolean(settings.japaneseKanaOnly) }),
      approvedSlang: false
    };
  }

  function getKoreanSlangConversion(word, context) {
    if (settings.language !== "korean" || !settings.koreanSlangMode) return null;
    if (!/^[A-Za-z]{2,8}$/.test(word)) return null;

    const normalized = normalizeLatinWord(word);
    const slang = KOREAN_SLANG_BY_KEY.get(normalized);
    if (!slang) return null;

    // "rt", "gd", "cv" are also English shorthand: skip inside English sentences.
    const detector = getDetector();
    if (detector && context && detector.contextScore(context.before, context.after) < -0.3) return null;

    return { text: slang, approvedSlang: true };
  }

  function isGoodKoreanCandidate(el, wordInfo, converted, options = {}, context) {
    if (converted === wordInfo.word) return false;
    const isChatJamo = /^[\u3131-\u318e]{2,}$/.test(converted);
    const allowedChatChars = new Set(["ㅋ", "ㅎ", "ㅠ", "ㅜ", "ㄷ"]);

    // Allow informal Korean chat patterns only for repeated allowed chars:
    // ㅋㅋㅋㅋ, ㅎㅎㅎ, ㅠㅠ, ㅜㅜ, ㄷㄷ.
    if (isChatJamo) {
      if (options.approvedSlang) return true;
      const chars = Array.from(converted);
      if (chars.length < 2) return false;
      if (chars.every((ch) => ch === chars[0] && allowedChatChars.has(ch))) {
        return true;
      }
      return false;
    }

    const detector = getDetector();
    if (!detector) return false;
    const { before, after } = context || getContext(el, wordInfo.start, wordInfo.end);
    return detector.judgeLatinToKorean(wordInfo.word, {
      mode: settings.contextMode || "balanced",
      converted,
      before,
      after,
      prior: getSessionPrior()
    }).convert;
  }

  function isChineseCandidate(el, wordInfo, input, converted) {
    const mode = settings.contextMode || "balanced";
    const normalized = normalizeLatinWord(input);
    if (converted === input) return false;

    const hasCjk = /[\u4e00-\u9fff]/.test(converted);
    if (!hasCjk) return false;
    if (settings.chineseUseV === false && normalized.includes("v")) return false;
    if (!/^[a-z]+$/i.test(input)) return false;

    const hasChineseContext = hasScriptAround(el, wordInfo.start, wordInfo.end, /[\u4e00-\u9fff]/);
    const englishLike = isLikelyEnglishWord(normalized);
    const ambiguous = CHINESE_AMBIGUOUS_SYLLABLES.has(normalized);

    if (mode === "strict") {
      if (normalized.length < 4) return false;
      if (englishLike) return false;
      if (ambiguous && !hasChineseContext) return false;
      return true;
    }
    if (mode === "aggressive") {
      if (normalized.length < 2) return false;
      if (ambiguous && !hasChineseContext) return false;
      return true;
    }
    if (normalized.length < 3) return false;
    if (englishLike && !hasChineseContext) return false;
    if (ambiguous && !hasChineseContext) return false;
    return true;
  }

  function isJapaneseCandidate(el, wordInfo, input, converted) {
    const mode = settings.contextMode || "balanced";
    const normalized = normalizeLatinWord(input);
    if (converted === input) return false;

    const hasJp = /[\u3040-\u30ff\u4e00-\u9fff]/.test(converted);
    if (!hasJp) return false;
    if (!/^[a-z]+$/i.test(input)) return false;
    if (/[bcdfghjklmpqrstvwxyz]$/.test(normalized) && !normalized.endsWith("n")) return false;

    const hasJapaneseContext = hasScriptAround(el, wordInfo.start, wordInfo.end, /[\u3040-\u30ff\u4e00-\u9fff]/);
    const englishLike = isLikelyEnglishWord(normalized);
    const ambiguous = JAPANESE_AMBIGUOUS_ROMAJI.has(normalized);

    if (mode === "strict") {
      if (normalized.length < 4) return false;
      if (englishLike) return false;
      if (ambiguous && !hasJapaneseContext) return false;
      return true;
    }
    if (mode === "aggressive") {
      if (normalized.length < 2) return false;
      if (ambiguous && !hasJapaneseContext) return false;
      return true;
    }
    if (normalized.length < 3) return false;
    if (englishLike && !hasJapaneseContext) return false;
    if (ambiguous && !hasJapaneseContext) return false;
    return true;
  }

  function isGoodCandidate(el, wordInfo, candidate, context) {
    const converted = candidate.text;
    switch (settings.language) {
      case "japanese":
        return isJapaneseCandidate(el, wordInfo, wordInfo.word, converted);
      case "chinese":
        return isChineseCandidate(el, wordInfo, wordInfo.word, converted);
      case "korean":
      default:
        return isGoodKoreanCandidate(el, wordInfo, converted, candidate, context);
    }
  }

  // The word just converted, plus any earlier words that only now have enough
  // context to convert ("sk wlrma" -> "나 지금"). Returns one contiguous edit.
  function planConversion(el, wordInfo, candidate) {
    const text = getEditableText(el);
    let start = wordInfo.start;
    let replacement = candidate.text;

    if (settings.language === "korean") {
      const wordPattern = wordInfo.script === "hangul"
        ? /([가-힣ㄱ-ㆎ]+)([  ]+)$/
        : /([A-Za-z';~]{2,})([  ]+)$/;
      let after = candidate.text + text.slice(wordInfo.end, wordInfo.end + 40);

      for (let i = 0; i < LOOKBACK_WORDS; i += 1) {
        const match = text.slice(0, start).match(wordPattern);
        if (!match) break;
        const [whole, prevWord, gap] = match;
        const prevStart = start - whole.length;
        const prevInfo = { word: prevWord, script: wordInfo.script, start: prevStart, end: prevStart + prevWord.length };
        const prevContext = { before: text.slice(Math.max(0, prevStart - 80), prevStart), after: gap + after };
        const prev = evaluateWord(el, prevInfo, prevContext);
        if (!prev || prev.approvedSlang) break;

        replacement = prev.text + gap + replacement;
        after = prev.text + gap + after;
        start = prevStart;
      }
    }

    return {
      start,
      end: wordInfo.end,
      original: text.slice(start, wordInfo.end),
      replacement
    };
  }

  function replaceRange(el, start, end, replacement) {
    if (isPlainInput(el)) {
      el.focus();
      el.setSelectionRange(start, end);
      el.setRangeText(replacement, start, end, "end");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    // Rich editors (Lexical on Instagram, Slate on Discord, ProseMirror...) keep
    // their own model and redraw from it, so edit through input they understand
    // instead of touching the DOM. Asynchronous: resolves true once applied.
    return replaceInRichEditor(el, start, end, replacement);
  }

  function getTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    return nodes;
  }

  function resolveTextPosition(root, offset) {
    const nodes = getTextNodes(root);
    if (nodes.length === 0) {
      return { node: root, offset: 0 };
    }

    let remaining = offset;
    for (const node of nodes) {
      const len = node.textContent ? node.textContent.length : 0;
      if (remaining <= len) {
        return { node, offset: remaining };
      }
      remaining -= len;
    }

    const last = nodes[nodes.length - 1];
    const lastLen = last.textContent ? last.textContent.length : 0;
    return { node: last, offset: lastLen };
  }

  function replaceRangeInContentEditable(el, start, end, replacement) {
    const text = getEditableText(el);
    const boundedStart = Math.max(0, Math.min(start, text.length));
    const boundedEnd = Math.max(boundedStart, Math.min(end, text.length));
    const startPos = resolveTextPosition(el, boundedStart);
    const endPos = resolveTextPosition(el, boundedEnd);

    try {
      const range = document.createRange();
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      range.deleteContents();

      const inserted = document.createTextNode(replacement);
      range.insertNode(inserted);

      const caret = document.createRange();
      caret.setStart(inserted, inserted.textContent ? inserted.textContent.length : 0);
      caret.collapse(true);

      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(caret);
      }
    } catch (error) {
      // Fallback for editors with strict DOM handling.
      if (document.queryCommandSupported && document.queryCommandSupported("insertText")) {
        document.execCommand("insertText", false, replacement);
      }
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function replaceWordBeforeCaretBySelection(el, replacementWithBoundary) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const caret = sel.getRangeAt(0);
    if (!caret.collapsed) return false;
    if (!el.contains(caret.endContainer)) return false;

    const preCaret = caret.cloneRange();
    preCaret.selectNodeContents(el);
    preCaret.setEnd(caret.endContainer, caret.endOffset);
    const textBeforeCaret = preCaret.toString();
    const match = textBeforeCaret.match(/[A-Za-z';~]{2,}$/);
    if (!match) return false;

    const start = textBeforeCaret.length - match[0].length;
    const end = textBeforeCaret.length;
    const startPos = resolveTextPosition(el, start);
    const endPos = resolveTextPosition(el, end);

    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    sel.removeAllRanges();
    sel.addRange(range);

    if (document.queryCommandSupported && document.queryCommandSupported("insertText")) {
      document.execCommand("insertText", false, replacementWithBoundary);
      return true;
    }

    range.deleteContents();
    const inserted = document.createTextNode(replacementWithBoundary);
    range.insertNode(inserted);

    const caretAfter = document.createRange();
    caretAfter.setStart(inserted, inserted.textContent ? inserted.textContent.length : 0);
    caretAfter.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caretAfter);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function isCjkCommitLanguage() {
    return settings.language === "chinese" || settings.language === "japanese";
  }

  const CJK_PUNCTUATION = {
    chinese: { ",": "，", ".": "。", "?": "？", "!": "！", ":": "：", ";": "；" },
    japanese: { ",": "、", ".": "。", "?": "？", "!": "！" }
  };

  // Chinese/Japanese: punctuation commits the word and comes out full-width
  // ("nihao," -> "你好，"), and after CJK text it is swapped in directly.
  function handleCjkPunctuation(el, e) {
    if (!settings.fullWidthPunctuation || e.ctrlKey || e.metaKey || e.altKey) return false;
    const punctuation = (CJK_PUNCTUATION[settings.language] || {})[e.key];
    if (!punctuation) return false;
    const caret = getCaretOffset(el);
    if (caret === null || caret === undefined) return false;

    const wordInfo = getWordBeforeCaret(el);
    if (wordInfo && wordInfo.script === "latin") {
      const candidate = evaluateWord(el, wordInfo);
      if (!candidate) return false;
      e.preventDefault();
      replaceRange(el, wordInfo.start, wordInfo.end, candidate.text + punctuation);
      clearLastAutoConversion();
      removeSuggestion();
      return true;
    }

    // "你好 " + "," -> "你好，" (the space came from Space-to-convert).
    const before = getEditableText(el).slice(0, caret);
    const cjkEnd = before.match(/[\u3040-\u30ff\u4e00-\u9fff]( ?)$/);
    if (!cjkEnd) return false;
    e.preventDefault();
    replaceRange(el, caret - cjkEnd[1].length, caret, punctuation);
    clearLastAutoConversion();
    return true;
  }

  function isBoundaryCommitKey(e) {
    return e.key === " " || e.key === "Enter" || e.key === "Tab" || e.key === "NumpadEnter";
  }

  function shouldPreserveAutoConversionForKey(e) {
    return e.key === "Shift"
      || e.key === "Control"
      || e.key === "Alt"
      || e.key === "Meta"
      || e.key === "CapsLock";
  }

  function maybeShowSuggestion(el) {
    if (!isEnabledOnCurrentSite()) {
      removeSuggestion();
      return;
    }

    const wordInfo = getCurrentWordAtCaret(el);
    if (!wordInfo) {
      removeSuggestion();
      return;
    }

    const candidate = evaluateWord(el, wordInfo);
    if (!candidate) {
      removeSuggestion();
      return;
    }

    showSuggestion(el, candidate.text);
  }

  // Replace text the way a user edit would, so rich editors (Lexical, Draft,
  // ProseMirror) keep their model in sync.
  async function replaceInRichEditor(el, start, end, replacement) {
    const original = getEditableText(el).slice(start, end);
    debugLog("replace", { start, end, original, replacement, text: getEditableText(el) });
    el.focus();

    // Editors pick up a new selection (and Slate settles keystrokes it is still
    // applying) on the next selectionchange; editing before that lands at the
    // old caret.
    if (!(await selectAndSettle(() => selectTextRange(el, start, end)))) return false;
    if (getEditableText(el).slice(start, end) !== original) return false;

    // Slate (Discord) applies beforeinput itself and reads the target range
    // from the event. Other editors (Instagram's) may swallow untrusted events,
    // so only Slate gets one.
    if (isSlateEditor(el)) {
      const from = resolveTextPosition(el, start);
      const to = resolveTextPosition(el, end);
      if (dispatchSlateInsert(el, from, to, replacement)) return true;
    }

    if (!document.execCommand("insertText", false, replacement)) {
      replaceRangeInContentEditable(el, start, end, replacement);
    }
    if (await landed(el, start, replacement)) return true;
    debugLog("insert did not land", { text: getEditableText(el) });

    // Some editors (Instagram DMs) ignore a range edit that spans the whole
    // field. Retry once through select-all, if nothing changed meanwhile.
    const text = getEditableText(el);
    if (start !== 0 || text !== original) return false;
    if (!(await selectAndSettle(() => document.execCommand("selectAll")))) return false;
    document.execCommand("insertText", false, replacement);
    const ok = await landed(el, start, replacement);
    debugLog("select-all retry", { ok, text: getEditableText(el) });
    return ok;
  }

  function selectTextRange(el, start, end) {
    const sel = window.getSelection();
    if (!sel) return;
    const startPos = resolveTextPosition(el, start);
    const endPos = resolveTextPosition(el, end);
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Runs `select`, waits for the editor to take the selection, and makes sure
  // no keystroke types over the selected text meanwhile: if one arrives, the
  // selection is collapsed first and this resolves false.
  async function selectAndSettle(select) {
    let interrupted = false;
    const guard = () => {
      interrupted = true;
      const current = window.getSelection();
      if (current && current.rangeCount) current.collapseToEnd();
    };
    document.addEventListener("keydown", guard, true);
    try {
      select();
      await nextSelectionChange();
    } finally {
      document.removeEventListener("keydown", guard, true);
    }
    return !interrupted;
  }

  // Did the editor keep the edit? Lexical commits asynchronously, so give it a
  // moment; a failed insert may leave the word selected, so guard keystrokes.
  async function landed(el, start, replacement) {
    const check = () => getEditableText(el).slice(start, start + replacement.length) === replacement;
    if (check()) return true;
    const guard = () => {
      const current = window.getSelection();
      if (current && current.rangeCount && !current.isCollapsed) current.collapseToEnd();
    };
    document.addEventListener("keydown", guard, true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 40));
    } finally {
      document.removeEventListener("keydown", guard, true);
    }
    return check();
  }

  // Resolves right after the editor's own selectionchange handlers (registered
  // earlier, so they run first). The awaiting code continues in a microtask,
  // before any queued keystroke could type over the selected word.
  function nextSelectionChange() {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        document.removeEventListener("selectionchange", done);
        resolve();
      };
      const timer = setTimeout(done, 50);
      document.addEventListener("selectionchange", done);
    });
  }

  function isSlateEditor(el) {
    return Boolean(el.closest && el.closest("[data-slate-editor]"));
  }

  function dispatchSlateInsert(el, startPos, endPos, replacement) {
    const beforeInput = new InputEvent("beforeinput", {
      inputType: "insertText",
      data: replacement,
      bubbles: true,
      cancelable: true,
      targetRanges: [new StaticRange({
        startContainer: startPos.node,
        startOffset: startPos.offset,
        endContainer: endPos.node,
        endOffset: endPos.offset
      })]
    });
    el.dispatchEvent(beforeInput);
    return beforeInput.defaultPrevented;
  }

  // Converts the word right before an already-typed space. Used for rich
  // editors (Instagram, Discord: converting while the space is still in flight
  // races their redraw) and for Korean IME commits (reverse conversion).
  async function convertAfterBoundary(el) {
    if (isAutoConverting || !settings.autoConvert || !isEnabledOnCurrentSite()) return;

    const text = getEditableText(el);
    const caretOffset = getCaretOffset(el);
    const caret = caretOffset === null || caretOffset === undefined ? text.length : caretOffset;

    // Prefer the word remembered at Space keydown: the user may already be
    // typing the next word by the time the editor has rendered the space.
    let wordInfo = null;
    const pending = pendingBoundary;
    pendingBoundary = null;
    if (pending && pending.el === el
      && text.slice(pending.start, pending.end) === pending.word
      && getSpaceBoundaryLength(text, pending.end)
      && caret > pending.end) {
      wordInfo = { word: pending.word, script: pending.script, start: pending.start, end: pending.end };
    } else {
      if (!caret || caret < 2 || !getSpaceBoundaryLength(text, caret - 1)) return;
      const match = matchWordAtEnd(text.slice(0, caret - 1));
      // Plain inputs convert Latin words at keydown already.
      if (!match || (isPlainInput(el) && match.script !== "hangul")) return;
      wordInfo = {
        word: match.word,
        script: match.script,
        start: caret - 1 - match.word.length,
        end: caret - 1
      };
    }
    const boundary = text[wordInfo.end];
    const candidate = evaluateWord(el, wordInfo);
    debugLog("after space", { text, caret, word: wordInfo.word, start: wordInfo.start, candidate: candidate && candidate.text });
    if (!candidate) {
      recordLanguage(wordInfo.word);
      return;
    }

    const plan = planConversion(el, wordInfo, candidate);
    const typedAhead = caret > wordInfo.end + 1;
    // Slate only re-reads the caret every ~100ms, so moving it back while the
    // user keeps typing scrambles text. Leave the word; the look-back on the
    // next conversion picks it up.
    if (typedAhead && isSlateEditor(el)) return;
    // Caret position counted from the end survives the length change.
    const fromEnd = text.length - caret;
    isAutoConverting = true;
    try {
      const applied = await replaceRange(el, plan.start, wordInfo.end + 1, plan.replacement + boundary);
      if (applied === false) return;
      if (typedAhead) {
        // Put the caret back after what was typed in the meantime.
        setCaret(el, getEditableText(el).length - fromEnd);
        clearLastAutoConversion();
      } else {
        rememberAutoConversion(el, plan.start, plan.original, plan.replacement, wordInfo.word);
      }
      recordLanguage(candidate.text);
      removeSuggestion();
      showConvertedHint(el, plan.original, plan.replacement);
    } finally {
      isAutoConverting = false;
    }
    confirmConversion(el, plan.start, plan.replacement);
  }

  // Some editors silently drop programmatic edits. If the text didn't actually
  // change, take back the hint and the undo state instead of claiming success.
  function confirmConversion(el, start, replacement) {
    setTimeout(() => {
      if (getEditableText(el).slice(start, start + replacement.length) === replacement) return;
      removeHint();
      clearLastAutoConversion();
    }, 80);
  }

  function setCaret(el, offset) {
    const pos = resolveTextPosition(el, offset);
    const range = document.createRange();
    range.setStart(pos.node, pos.offset);
    range.collapse(true);
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function scheduleBoundaryCheck() {
    const run = () => {
      const el = getEditableTarget(document.activeElement) || getSelectionEditableTarget();
      if (el) convertAfterBoundary(el);
    };
    // The IME may commit after keydown; the check is idempotent, so run it twice.
    setTimeout(run, 0);
    setTimeout(run, 60);
  }

  function isWhitespaceInsert(e) {
    if (e.inputType === "insertText") return typeof e.data === "string" && /^[  ]$/.test(e.data);
    return e.inputType === "insertLineBreak";
  }

  document.addEventListener("input", (e) => {
    const el = resolveEditableTargetFromEventTarget(e.target);
    if (!isSupportedInput(el)) return;
    if (!e.isComposing && !isAutoConverting && isWhitespaceInsert(e) && isReverseEnabled()) {
      scheduleBoundaryCheck();
    }
    maybeShowSuggestion(el);
  }, true);

  document.addEventListener("keydown", (e) => {
    const el = resolveEditableTargetFromEventTarget(e.target);
    if (!isSupportedInput(el)) return;
    if (e.code === "Space" && (e.isComposing || e.keyCode === 229)) {
      // Space that commits a Korean IME syllable: check once it lands.
      if (isReverseEnabled() && settings.autoConvert) {
        scheduleBoundaryCheck();
      }
      return;
    }
    if (e.isComposing) return;

    if (e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (undoLastAutoConversion(el)) {
        e.preventDefault();
        // Lexical deletes on its own keydown handler even when prevented.
        e.stopImmediatePropagation();
      } else {
        removeHint();
      }
      return;
    }
    if (!shouldPreserveAutoConversionForKey(e)) removeHint();

    if (!isEnabledOnCurrentSite()) {
      removeSuggestion();
      clearLastAutoConversion();
      return;
    }

    if (lastAutoConversion && !shouldPreserveAutoConversionForKey(e)) {
      clearLastAutoConversion();
    }

    if (!settings.autoConvert) return;

    if (isCjkCommitLanguage() && handleCjkPunctuation(el, e)) return;

    if (!isPlainInput(el)) {
      // Rich editors redraw from their own model: let the space land, then
      // convert through the editor (convertAfterBoundary). Enter usually sends
      // the message there, so it's left alone.
      if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const wordInfo = getWordBeforeCaret(el);
        pendingBoundary = wordInfo ? { el, ...wordInfo } : null;
        scheduleBoundaryCheck();
      }
      return;
    }

    const isBoundaryKey = isBoundaryCommitKey(e);
    if (!isBoundaryKey || e.ctrlKey || e.metaKey || e.altKey) return;

    const wordInfo = getWordBeforeCaret(el);
    if (!wordInfo) return;

    const candidate = evaluateWord(el, wordInfo);
    if (!candidate) {
      recordLanguage(wordInfo.word);
      return;
    }

    if (isCjkCommitLanguage() && (e.key === "Enter" || e.key === "NumpadEnter")) {
      e.preventDefault();
    }

    const plan = planConversion(el, wordInfo, candidate);
    replaceRange(el, plan.start, plan.end, plan.replacement);
    recordLanguage(candidate.text);
    removeSuggestion();
    if (e.key === " " || (e.key === "Enter" && el instanceof HTMLTextAreaElement)) {
      rememberAutoConversion(el, plan.start, plan.original, plan.replacement, wordInfo.word);
      showConvertedHint(el, plan.original, plan.replacement);
    } else {
      clearLastAutoConversion();
    }
  }, true);

  document.addEventListener("click", () => {
    removeSuggestion();
    removeHint();
    clearLastAutoConversion();
  });

  watchSettings();
  loadSettings().finally(refreshUIAfterSettingsChange);
  loadLearnedWords();
})();
