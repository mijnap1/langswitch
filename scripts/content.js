(() => {
  let lastSuggestion = null;
  const TOOLTIP_CLASS = "layout-fix-tooltip";
  const ENGLISH_WORDS_RESOURCE = "data/english-words.txt";

  const DEFAULT_SETTINGS = {
    language: "korean",
    contextMode: "balanced",
    tooltipTheme: "liquid-glass",
    appearance: "auto",
    autoConvert: true,
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
  let settings = { ...DEFAULT_SETTINGS };

  async function loadSettings() {
    if (!window.chrome || !chrome.storage || !chrome.storage.sync) return;
    try {
      const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      settings = { ...DEFAULT_SETTINGS, ...stored };
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
    return contentEditable instanceof HTMLElement ? contentEditable : null;
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

  function looksLikeAlphaWord(word) {
    return /^[a-z]{2,}$/i.test(word);
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
    tooltip.textContent = `Convert to: ${suggestion} (Alt+L)`;

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

  function hasHangulAround(el, start, end) {
    const left = Math.max(0, start - 16);
    const text = getEditableText(el);
    const right = Math.min(text.length, end + 16);
    return /[\uac00-\ud7a3]/i.test(text.slice(left, right));
  }

  function getConvertedWord(word) {
    if (!window.convertWithLanguage) {
      return window.convertToKorean ? window.convertToKorean(word) : word;
    }
    return window.convertWithLanguage(word, settings.language);
  }

  function isGoodKoreanCandidate(el, wordInfo, converted) {
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

  function isSpanishCandidate(input, converted) {
    const mode = settings.contextMode || "balanced";
    if (converted === input) return false;

    const hasAccentMarker = /[ñáéíóúü¡¿]/i.test(converted);
    const explicitTypingHint = /['~;:]/.test(input);

    if (mode === "strict") {
      return hasAccentMarker && (explicitTypingHint || input.length >= 5);
    }
    if (mode === "aggressive") {
      return hasAccentMarker || explicitTypingHint;
    }
    return hasAccentMarker;
  }

  function isFrenchCandidate(input, converted) {
    const mode = settings.contextMode || "balanced";
    if (converted === input) return false;
    const hasAccentMarker = /[àâçéèêëîïôùûüÿœæ]/i.test(converted);

    if (mode === "strict") {
      return hasAccentMarker && input.length >= 4;
    }
    if (mode === "aggressive") {
      return hasAccentMarker || converted !== input;
    }
    return hasAccentMarker;
  }

  function isGoodCandidate(el, wordInfo, converted) {
    switch (settings.language) {
      case "spanish":
        return isSpanishCandidate(wordInfo.word, converted);
      case "french":
        return isFrenchCandidate(wordInfo.word, converted);
      case "korean":
      default:
        return isGoodKoreanCandidate(el, wordInfo, converted);
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

    el.dispatchEvent(new Event("input", { bubbles: true }));
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

    const converted = getConvertedWord(wordInfo.word);
    if (!isGoodCandidate(el, wordInfo, converted)) {
      removeSuggestion();
      return;
    }

    showSuggestion(el, converted);
  }

  document.addEventListener("input", (e) => {
    const el = getEditableTarget(e.target);
    if (!isSupportedInput(el)) return;
    maybeShowSuggestion(el);
  });

  document.addEventListener("keydown", (e) => {
    const el = getEditableTarget(e.target);
    if (!isSupportedInput(el)) return;
    if (e.isComposing) return;
    if (!isEnabledOnCurrentSite()) {
      removeSuggestion();
      return;
    }

    if (e.altKey && e.key.toLowerCase() === "l" && lastSuggestion && lastSuggestion.element === el) {
      const currentWord = getCurrentWordAtCaret(el);
      if (currentWord) {
        replaceRange(el, currentWord.start, currentWord.end, lastSuggestion.suggestion);
      }
      removeSuggestion();
      return;
    }

    if (!settings.autoConvert) return;

    const isBoundaryKey = e.key === " " || e.key === "Enter" || e.key === "Tab";
    if (!isBoundaryKey || e.ctrlKey || e.metaKey || e.altKey) return;

    const wordInfo = getWordBeforeCaret(el);
    if (!wordInfo) return;

    const converted = getConvertedWord(wordInfo.word);
    if (!isGoodCandidate(el, wordInfo, converted)) return;

    replaceRange(el, wordInfo.start, wordInfo.end, converted);
    removeSuggestion();
  });

  document.addEventListener("click", removeSuggestion);

  watchSettings();
  loadSettings().finally(refreshUIAfterSettingsChange);
  loadEnglishWordLibrary();
})();
