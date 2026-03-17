(() => {
  const SUPPORTED_LANGUAGES = new Set(["korean", "chinese", "japanese"]);
  let lastSuggestion = null;
  let lastAutoConversion = null;
  let isAutoConverting = false;
  const TOOLTIP_CLASS = "layout-fix-tooltip";
  const ENGLISH_WORDS_RESOURCE = "data/english-words.txt";

  const DEFAULT_SETTINGS = {
    language: "korean",
    contextMode: "balanced",
    tooltipTheme: "liquid-glass",
    appearance: "auto",
    autoConvert: true,
    koreanSlangMode: true,
    siteRules: {}
  };

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

  const ENGLISH_WORD_SET = new Set(COMMON_ENGLISH_WORDS);
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

  async function loadEnglishWordLibrary() {
    if (!window.chrome || !chrome.runtime || !chrome.runtime.getURL) return;

    try {
      const resourceUrl = chrome.runtime.getURL(ENGLISH_WORDS_RESOURCE);
      const response = await fetch(resourceUrl);
      if (!response.ok) return;

      const text = await response.text();
      text.split(/\r?\n/).forEach((word) => {
        const normalized = word.trim().toLowerCase();
        if (normalized) ENGLISH_WORD_SET.add(normalized);
      });
    } catch (error) {
      // Continue with built-in list only.
    }
  }

  function isPlainInput(el) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      return false;
    }

    if (el instanceof HTMLTextAreaElement) {
      return true;
    }

    const supportedTypes = new Set(["", "text", "search", "url", "tel", "email", "password"]);
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

  function isEnabledOnCurrentSite() {
    const host = window.location.hostname;
    if (!host) return true;

    const rules = settings.siteRules || {};
    return rules[host] !== false;
  }

  function isInstagramHost() {
    const host = window.location.hostname || "";
    return host === "instagram.com" || host.endsWith(".instagram.com");
  }

  function looksLikeAlphaWord(word) {
    return /^[a-z]{2,}$/i.test(word);
  }

  function normalizeLatinWord(word) {
    return word.toLowerCase().replace(/[^a-z]/g, "");
  }

  function isLikelyEnglishWord(word) {
    const lower = word.toLowerCase();
    if (ENGLISH_WORD_SET.has(lower)) return true;

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

  function getTooltipThemeStyles(themeName, darkMode) {
    const themes = {
      "liquid-glass": {
        light: {
          background: "linear-gradient(135deg, rgba(255,255,255,0.82), rgba(247,250,255,0.64))",
          color: "#0f172a",
          border: "1px solid rgba(148, 163, 184, 0.48)",
          borderRadius: "14px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255,255,255,0.65)",
          backdropFilter: "blur(12px) saturate(160%)",
          webkitBackdropFilter: "blur(12px) saturate(160%)"
        },
        dark: {
          background: "linear-gradient(135deg, rgba(30,41,59,0.78), rgba(15,23,42,0.62))",
          color: "#e2e8f0",
          border: "1px solid rgba(148, 163, 184, 0.32)",
          borderRadius: "14px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255,255,255,0.12)",
          backdropFilter: "blur(12px) saturate(160%)",
          webkitBackdropFilter: "blur(12px) saturate(160%)"
        }
      },
      "soft-minimal": {
        light: {
          background: "#ffffff",
          color: "#0f172a",
          border: "1px solid #dbe3ef",
          borderRadius: "12px",
          boxShadow: "0 8px 22px rgba(15, 23, 42, 0.1)"
        },
        dark: {
          background: "#111827",
          color: "#e5e7eb",
          border: "1px solid #334155",
          borderRadius: "12px",
          boxShadow: "0 10px 26px rgba(0, 0, 0, 0.4)"
        }
      },
      "arctic-frost": {
        light: {
          background: "linear-gradient(140deg, #f8fbff, #eef5ff)",
          color: "#10213a",
          border: "1px solid #c6d6ef",
          borderRadius: "14px",
          boxShadow: "0 10px 24px rgba(24, 66, 134, 0.14)"
        },
        dark: {
          background: "linear-gradient(140deg, #132238, #0f1a2a)",
          color: "#dceeff",
          border: "1px solid #35507a",
          borderRadius: "14px",
          boxShadow: "0 12px 26px rgba(0, 0, 0, 0.45)"
        }
      },
      "obsidian-edge": {
        light: {
          background: "linear-gradient(150deg, #1f2937, #0f172a)",
          color: "#f8fafc",
          border: "1px solid #334155",
          borderRadius: "12px",
          boxShadow: "0 12px 26px rgba(15, 23, 42, 0.4)"
        },
        dark: {
          background: "linear-gradient(150deg, #0a0f1b, #030712)",
          color: "#e2e8f0",
          border: "1px solid #1f2a3c",
          borderRadius: "12px",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.55)"
        }
      },
      "neon-pulse": {
        light: {
          background: "linear-gradient(135deg, #0e1225, #151a34)",
          color: "#d9f7ff",
          border: "1px solid #20e3ff",
          borderRadius: "10px",
          boxShadow: "0 0 0 1px rgba(32,227,255,0.25), 0 0 18px rgba(32,227,255,0.45), 0 0 38px rgba(76,0,255,0.25)"
        },
        dark: {
          background: "linear-gradient(135deg, #070b18, #0e1430)",
          color: "#b9f3ff",
          border: "1px solid #20e3ff",
          borderRadius: "10px",
          boxShadow: "0 0 0 1px rgba(32,227,255,0.3), 0 0 22px rgba(32,227,255,0.5), 0 0 42px rgba(76,0,255,0.32)"
        }
      },
      "warm-paper": {
        light: {
          background: "linear-gradient(135deg, #fff8ea, #f7ecd5)",
          color: "#3b2b1a",
          border: "1px solid #e2cda3",
          borderRadius: "12px",
          boxShadow: "0 6px 20px rgba(80, 50, 20, 0.16)"
        },
        dark: {
          background: "linear-gradient(135deg, #3a2c1a, #2c2216)",
          color: "#f6e7c7",
          border: "1px solid #74552e",
          borderRadius: "12px",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)"
        }
      },
      "moss-satin": {
        light: {
          background: "linear-gradient(140deg, #f4fbf2, #e8f4e5)",
          color: "#1d3b2a",
          border: "1px solid #bbd7c4",
          borderRadius: "12px",
          boxShadow: "0 10px 24px rgba(31, 74, 42, 0.16)"
        },
        dark: {
          background: "linear-gradient(140deg, #10241a, #0b1a13)",
          color: "#ccf2d5",
          border: "1px solid #2a4b39",
          borderRadius: "12px",
          boxShadow: "0 12px 24px rgba(0, 0, 0, 0.48)"
        }
      },
      "sunset-clay": {
        light: {
          background: "linear-gradient(145deg, #fff1e8, #ffe4d2)",
          color: "#472617",
          border: "1px solid #f3c3a7",
          borderRadius: "13px",
          boxShadow: "0 10px 24px rgba(122, 59, 20, 0.2)"
        },
        dark: {
          background: "linear-gradient(145deg, #3d2116, #2c180f)",
          color: "#ffd9c6",
          border: "1px solid #7a4a33",
          borderRadius: "13px",
          boxShadow: "0 12px 26px rgba(0, 0, 0, 0.5)"
        }
      },
      "mono-ink": {
        light: {
          background: "#ffffff",
          color: "#0a0a0a",
          border: "1px solid #111111",
          borderRadius: "8px",
          boxShadow: "0 6px 16px rgba(0, 0, 0, 0.18)"
        },
        dark: {
          background: "#000000",
          color: "#f8f8f8",
          border: "1px solid #7a7a7a",
          borderRadius: "8px",
          boxShadow: "0 8px 22px rgba(0, 0, 0, 0.55)"
        }
      },
      terminal: {
        light: {
          background: "#0a0f0a",
          color: "#98f59a",
          border: "1px solid #2c7d33",
          borderRadius: "6px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)"
        },
        dark: {
          background: "#040804",
          color: "#8ff793",
          border: "1px solid #2c7d33",
          borderRadius: "6px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)"
        }
      }
    };

    const theme = themes[themeName] || themes["liquid-glass"];
    return darkMode ? theme.dark : theme.light;
  }

  function applyTooltipTheme(tooltip) {
    const style = getTooltipThemeStyles(settings.tooltipTheme, isDarkAppearance());
    Object.entries(style).forEach(([prop, value]) => {
      tooltip.style[prop] = value;
    });
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
    applyTooltipTheme(tooltip);

    const rect = getTooltipAnchorRect(element);
    tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(tooltip);
    lastSuggestion = { element, suggestion };
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

  function getWordBeforeCaret(el) {
    const caret = getCaretOffset(el);
    if (caret === null || caret === undefined) return null;

    const text = getEditableText(el);
    const beforeCaret = text.slice(0, caret);
    const match = beforeCaret.match(/[A-Za-z';~]{2,}$/);
    if (!match) return null;

    const word = match[0];
    return {
      word,
      start: caret - word.length,
      end: caret
    };
  }

  function getCurrentWordAtCaret(el) {
    const caret = getCaretOffset(el);
    if (caret === null || caret === undefined) return null;

    const value = getEditableText(el);
    const left = value.slice(0, caret);
    const right = value.slice(caret);

    const leftMatch = left.match(/[A-Za-z';~]{0,}$/);
    const rightMatch = right.match(/^[A-Za-z';~]{0,}/);

    const leftPart = leftMatch ? leftMatch[0] : "";
    const rightPart = rightMatch ? rightMatch[0] : "";
    const word = leftPart + rightPart;

    if (!looksLikeAlphaWord(word.replace(/[^A-Za-z]/g, ""))) return null;

    return {
      word,
      start: caret - leftPart.length,
      end: caret + rightPart.length
    };
  }

  function countMatches(text, pattern) {
    const match = text.match(pattern);
    return match ? match.length : 0;
  }

  function getSpaceBoundaryLength(text, offset) {
    const char = text[offset];
    return char === " " || char === "\u00A0" ? 1 : 0;
  }

  function rememberAutoConversion(el, start, original, converted) {
    if (!el || original === converted) {
      clearLastAutoConversion();
      return;
    }

    lastAutoConversion = {
      el,
      start,
      original,
      converted
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

    replaceRange(el, undoRange.start, undoRange.end, undoRange.replacement);
    clearLastAutoConversion();
    removeSuggestion();
    return true;
  }

  function hasHangulAround(el, start, end) {
    const left = Math.max(0, start - 16);
    const text = getEditableText(el);
    const right = Math.min(text.length, end + 16);
    return /[\uac00-\ud7a3]/i.test(text.slice(left, right));
  }

  function hasScriptAround(el, start, end, pattern) {
    const left = Math.max(0, start - 24);
    const text = getEditableText(el);
    const right = Math.min(text.length, end + 24);
    return pattern.test(text.slice(left, right));
  }

  function getConvertedWord(word) {
    const slang = getKoreanSlangConversion(word);
    if (slang) return slang;

    if (!window.convertWithLanguage) {
      const text = window.convertToKorean ? window.convertToKorean(word) : word;
      return { text, approvedSlang: false };
    }
    return {
      text: window.convertWithLanguage(word, settings.language),
      approvedSlang: false
    };
  }

  function getKoreanSlangConversion(word) {
    if (settings.language !== "korean" || !settings.koreanSlangMode) return null;
    if (!/^[A-Za-z]{2,8}$/.test(word)) return null;

    const normalized = normalizeLatinWord(word);
    const slang = KOREAN_SLANG_BY_KEY.get(normalized);
    if (!slang) return null;

    return { text: slang, approvedSlang: true };
  }

  function isGoodKoreanCandidate(el, wordInfo, converted, options = {}) {
    const mode = settings.contextMode || "balanced";
    const plainWord = wordInfo.word.replace(/[^A-Za-z]/g, "");
    if (converted === wordInfo.word) return false;

    const syllableCount = countMatches(converted, /[\uac00-\ud7a3]/g);
    const jamoCount = countMatches(converted, /[\u3131-\u318e]/g);
    const convertedLength = converted.length || 1;
    const syllableRatio = syllableCount / convertedLength;
    const hasContextHangul = hasHangulAround(el, wordInfo.start, wordInfo.end);
    const isShortWord = plainWord.length <= 2;
    const englishLike = isLikelyEnglishWord(plainWord);
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

    if (mode === "strict") {
      if (englishLike) return false;
      if (syllableRatio < 0.95) return false;
      if (isShortWord && !hasContextHangul) return false;
    } else if (mode === "balanced") {
      // Context override for ambiguous short words like "so" in Hangul sentences.
      if (englishLike && !(isShortWord && hasContextHangul)) return false;
      if (syllableRatio < 0.8) return false;
      if (isShortWord && !hasContextHangul) return false;
    } else {
      // Aggressive mode: keep some English protection for short isolated words.
      if (englishLike && !hasContextHangul && plainWord.length <= 3) return false;
      if (syllableRatio < 0.65) return false;
      if (isShortWord && !hasContextHangul) return false;
    }

    if (syllableCount === 0) return false;
    if (jamoCount > 0) return false;

    return true;
  }

  function isChineseCandidate(el, wordInfo, input, converted) {
    const mode = settings.contextMode || "balanced";
    const normalized = normalizeLatinWord(input);
    if (converted === input) return false;

    const hasCjk = /[\u4e00-\u9fff]/.test(converted);
    if (!hasCjk) return false;
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

  function isGoodCandidate(el, wordInfo, candidate) {
    const converted = candidate.text;
    switch (settings.language) {
      case "japanese":
        return isJapaneseCandidate(el, wordInfo, wordInfo.word, converted);
      case "chinese":
        return isChineseCandidate(el, wordInfo, wordInfo.word, converted);
      case "korean":
      default:
        return isGoodKoreanCandidate(el, wordInfo, converted, candidate);
    }
  }

  function replaceRange(el, start, end, replacement) {
    if (isPlainInput(el)) {
      el.focus();
      el.setSelectionRange(start, end);
      el.setRangeText(replacement, start, end, "end");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    replaceRangeInContentEditable(el, start, end, replacement);
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

    const candidate = getConvertedWord(wordInfo.word);
    if (!isGoodCandidate(el, wordInfo, candidate)) {
      removeSuggestion();
      return;
    }

    showSuggestion(el, candidate.text);
  }

  // Instagram auto-convert: runs after the space is naturally typed (React stays in sync).
  function tryInstagramAutoConvert(el) {
    const text = getEditableText(el);
    if (!text) return;
    // Always check from end of text — Instagram users type at the end,
    // and getCaretOffset is unreliable on the first input in a fresh field.
    const lastChar = text[text.length - 1];
    if (lastChar !== " " && lastChar !== "\u00A0") return;

    const beforeSpace = text.slice(0, -1);
    const match = beforeSpace.match(/[A-Za-z';~]{2,}$/);
    if (!match) return;

    const word = match[0];
    const wordStart = text.length - word.length - 1;
    const wordEnd = text.length;  // includes the trailing space
    const wordInfo = { word, start: wordStart, end: text.length - 1 };

    const candidate = getConvertedWord(word);
    if (!isGoodCandidate(el, wordInfo, candidate)) return;

    el.focus();
    isAutoConverting = true;
    try {
      if (wordStart === 0) {
        // Replacing the entire content — use selectAll so Lexical's editor
        // processes it through its standard "replace all" code path.
        document.execCommand("selectAll");
        document.execCommand("insertText", false, candidate.text + " ");
      } else {
        const startPos = resolveTextPosition(el, wordStart);
        const endPos = resolveTextPosition(el, wordEnd);
        const range = document.createRange();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("insertText", false, candidate.text + " ");
      }
      rememberAutoConversion(el, wordStart, word, candidate.text);
      removeSuggestion();
    } finally {
      isAutoConverting = false;
    }
  }

  document.addEventListener("input", (e) => {
    const el = resolveEditableTargetFromEventTarget(e.target);
    if (!isSupportedInput(el)) return;
    maybeShowSuggestion(el);
  }, true);

  document.addEventListener("keydown", (e) => {
    const el = resolveEditableTargetFromEventTarget(e.target);
    if (!isSupportedInput(el)) return;
    if (e.isComposing) return;

    if (e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (undoLastAutoConversion(el)) {
        e.preventDefault();
      }
      return;
    }

    if (!isEnabledOnCurrentSite()) {
      removeSuggestion();
      clearLastAutoConversion();
      return;
    }

    if (lastAutoConversion && !shouldPreserveAutoConversionForKey(e)) {
      clearLastAutoConversion();
    }

    if (!settings.autoConvert) return;

    if (isInstagramHost() && !isPlainInput(el)) {
      // Schedule conversion via setTimeout(0) from keydown so it fires after
      // the space input event AND Lexical's full async render have both finished.
      if (settings.autoConvert && !isAutoConverting && e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setTimeout(() => {
          if (isAutoConverting) return;
          const freshEl = getEditableTarget(document.activeElement) || getSelectionEditableTarget();
          if (freshEl && !isPlainInput(freshEl)) tryInstagramAutoConvert(freshEl);
        }, 0);
      }
      return;
    }

    const isBoundaryKey = isBoundaryCommitKey(e);
    if (!isBoundaryKey || e.ctrlKey || e.metaKey || e.altKey) return;

    const wordInfo = getWordBeforeCaret(el);
    if (!wordInfo) return;

    const candidate = getConvertedWord(wordInfo.word);
    if (!isGoodCandidate(el, wordInfo, candidate)) return;

    if (isCjkCommitLanguage() && (e.key === "Enter" || e.key === "NumpadEnter")) {
      e.preventDefault();
    }

    replaceRange(el, wordInfo.start, wordInfo.end, candidate.text);
    if (e.key === " ") {
      rememberAutoConversion(el, wordInfo.start, wordInfo.word, candidate.text);
    } else {
      clearLastAutoConversion();
    }
    removeSuggestion();
  }, true);

  document.addEventListener("click", () => {
    removeSuggestion();
    clearLastAutoConversion();
  });

  watchSettings();
  loadSettings().finally(refreshUIAfterSettingsChange);
  loadEnglishWordLibrary();
})();
