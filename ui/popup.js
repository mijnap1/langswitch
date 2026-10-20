(() => {
  const SUPPORTED_LANGUAGES = new Set(["korean", "chinese", "japanese"]);
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
  // The two language-specific switches, and the preview sample, per language.
  const LANGUAGE_UI = {
    korean: {
      options: [
        { key: "reverseConvert", title: "Fix English in Korean mode", sub: "ㅗ디ㅣㅐ → hello" },
        { key: "koreanSlangMode", title: "Chat shorthand", sub: "dd → ㅇㅇ, dz → ㅇㅋ, rr → ㄱㄱ" }
      ],
      text: "dkssudgktpdy",
      tooltip: "Convert to: 안녕하세요"
    },
    chinese: {
      options: [
        { key: "fullWidthPunctuation", title: "Chinese punctuation", sub: "nihao, → 你好，" },
        { key: "chineseUseV", title: "Type ü as v", sub: "nv → 女, lv → 旅" }
      ],
      text: "nihao",
      tooltip: "Convert to: 你好"
    },
    japanese: {
      options: [
        { key: "fullWidthPunctuation", title: "Japanese punctuation", sub: "arigatou. → ありがとう。" },
        { key: "japaneseKanaOnly", title: "Kana only", sub: "watashi → わたし instead of 私" }
      ],
      text: "arigatou",
      tooltip: "Convert to: ありがとう"
    }
  };
  const CONTEXT_MODE_HINTS = {
    strict: "Only converts when it's clearly a mistake.",
    balanced: "Uses the surrounding words to decide.",
    aggressive: "Converts more, even with little context."
  };
  const RADIO_SETTINGS = ["language", "contextMode", "appearance"];

  const themeEl = document.getElementById("tooltipTheme");
  const autoConvertEl = document.getElementById("autoConvert");
  const langOptionEls = ["A", "B"].map((id) => ({
    input: document.getElementById(`langOption${id}`),
    title: document.getElementById(`langOption${id}Title`),
    sub: document.getElementById(`langOption${id}Sub`)
  }));
  const contextModeHintEl = document.getElementById("contextModeHint");
  const learnedListEl = document.getElementById("learnedList");
  const learnedEmptyEl = document.getElementById("learnedEmpty");
  const clearLearnedEl = document.getElementById("clearLearned");
  const siteBarEl = document.getElementById("siteBar");
  const siteEnabledEl = document.getElementById("siteEnabled");
  const siteToggleLabelEl = document.getElementById("siteToggleLabel");
  const statusEl = document.getElementById("status");
  const versionEl = document.getElementById("version");
  const previewEl = document.getElementById("themePreview");
  let currentHost = null;
  let currentFavicon = null;
  let loadedSettings = { ...DEFAULT_SETTINGS };
  let statusTimer = null;

  function getRadio(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : DEFAULT_SETTINGS[name];
  }

  function setRadio(name, value) {
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`)
      || document.querySelector(`input[name="${name}"][value="${DEFAULT_SETTINGS[name]}"]`);
    if (input) input.checked = true;
  }

  function getLanguageUI() {
    return LANGUAGE_UI[getRadio("language")] || LANGUAGE_UI.korean;
  }

  function updateDependentUI() {
    getLanguageUI().options.forEach((option, i) => {
      const el = langOptionEls[i];
      el.input.dataset.key = option.key;
      el.input.checked = Boolean(loadedSettings[option.key]);
      el.title.textContent = option.title;
      el.sub.textContent = option.sub;
    });
    contextModeHintEl.textContent = CONTEXT_MODE_HINTS[getRadio("contextMode")] || "";
    renderPreview();
  }

  function isDarkAppearance() {
    const appearance = getRadio("appearance");
    if (appearance === "dark") return true;
    if (appearance === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // Same tooltip the content script draws, under a sample field in the chosen language.
  function renderPreview() {
    if (!window.LangSwitchThemes) return;
    const dark = isDarkAppearance();
    const sample = getLanguageUI();
    previewEl.classList.toggle("is-dark", dark);
    document.getElementById("previewText").textContent = sample.text;
    const page = previewEl.querySelector(".preview-page");
    const old = page.querySelector(".preview-tooltip");
    if (old) old.remove();

    const tooltip = document.createElement("div");
    tooltip.className = "preview-tooltip";
    tooltip.textContent = sample.tooltip;
    page.appendChild(tooltip);
    window.LangSwitchThemes.apply(tooltip, themeEl.value, dark, { adaptive: getRadio("appearance") === "auto" });
  }

  function showStatus(message) {
    statusEl.textContent = message;
    statusEl.classList.add("is-visible");
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      statusEl.classList.remove("is-visible");
    }, 1400);
  }

  async function getCurrentHost() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url) return null;
    currentFavicon = /^(https?:|data:image\/)/.test(tab.favIconUrl || "") ? tab.favIconUrl : null;
    if (!/^https?:/i.test(tab.url)) return null;

    try {
      return new URL(tab.url).hostname;
    } catch (error) {
      return null;
    }
  }

  // The site's own favicon, or a globe when it has none (or it fails to load).
  function renderSiteIcon() {
    const img = document.getElementById("siteFavicon");
    const globe = document.getElementById("siteGlobe");
    const showGlobe = () => {
      img.hidden = true;
      globe.style.display = "";
    };
    if (!currentFavicon) {
      showGlobe();
      return;
    }
    img.onerror = showGlobe;
    img.onload = () => {
      img.hidden = false;
      globe.style.display = "none";
    };
    img.src = currentFavicon;
  }

  // Keep in sync with OFF_BY_DEFAULT_HOSTS in scripts/content.js.
  const OFF_BY_DEFAULT_HOSTS = ["instagram.com", "discord.com"];

  function isSiteEnabled(host) {
    const rule = (loadedSettings.siteRules || {})[host];
    if (typeof rule === "boolean") return rule;
    return !OFF_BY_DEFAULT_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  function renderSiteToggle() {
    if (!currentHost) {
      siteEnabledEl.disabled = true;
      siteEnabledEl.checked = false;
      siteBarEl.classList.add("is-off");
      siteToggleLabelEl.textContent = "Not available on this page";
      return;
    }

    const enabled = isSiteEnabled(currentHost);
    siteEnabledEl.disabled = false;
    siteEnabledEl.checked = enabled;
    siteBarEl.classList.toggle("is-off", !enabled);
    const host = document.createElement("strong");
    host.textContent = currentHost.replace(/^www\./, "");
    siteToggleLabelEl.replaceChildren(enabled ? "Active on " : "Paused on ", host);
  }

  async function loadSettings() {
    currentHost = await getCurrentHost();
    renderSiteIcon();
    loadedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    if (!SUPPORTED_LANGUAGES.has(loadedSettings.language)) {
      loadedSettings.language = DEFAULT_SETTINGS.language;
      await chrome.storage.sync.set({ language: loadedSettings.language });
    }

    RADIO_SETTINGS.forEach((name) => setRadio(name, loadedSettings[name]));
    themeEl.value = loadedSettings.tooltipTheme;
    autoConvertEl.checked = Boolean(loadedSettings.autoConvert);
    renderSiteToggle();
    updateDependentUI();
  }

  async function saveSettings() {
    loadedSettings = {
      ...loadedSettings,
      language: getRadio("language"),
      contextMode: getRadio("contextMode"),
      tooltipTheme: themeEl.value,
      appearance: getRadio("appearance"),
      autoConvert: autoConvertEl.checked,
      siteRules: loadedSettings.siteRules || {}
    };
    langOptionEls.forEach(({ input }) => {
      if (input.dataset.key) loadedSettings[input.dataset.key] = input.checked;
    });

    await chrome.storage.sync.set(loadedSettings);
    showStatus("Saved");
  }

  async function saveSiteRule() {
    if (!currentHost) return;
    const nextRules = { ...(loadedSettings.siteRules || {}) };
    nextRules[currentHost] = Boolean(siteEnabledEl.checked);
    loadedSettings.siteRules = nextRules;
    await chrome.storage.sync.set({ siteRules: nextRules });
    renderSiteToggle();
    showStatus(siteEnabledEl.checked ? "Enabled on this site" : "Paused on this site");
  }

  function renderLearnedWords(learnedWords) {
    learnedListEl.replaceChildren();
    const words = Object.keys(learnedWords).sort((a, b) => learnedWords[b] - learnedWords[a]);
    words.forEach((word) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = word;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.textContent = "×";
      remove.title = `Allow auto-converting “${word}” again`;
      remove.addEventListener("click", () => removeLearnedWord(word));
      item.append(label, remove);
      learnedListEl.append(item);
    });
    clearLearnedEl.hidden = words.length === 0;
    learnedEmptyEl.hidden = words.length > 0;
  }

  async function loadLearnedWords() {
    const { learnedWords } = await chrome.storage.local.get({ learnedWords: {} });
    renderLearnedWords(learnedWords || {});
  }

  async function removeLearnedWord(word) {
    const { learnedWords, undoCounts } = await chrome.storage.local.get({ learnedWords: {}, undoCounts: {} });
    const next = { ...(learnedWords || {}) };
    const counts = { ...(undoCounts || {}) };
    delete next[word];
    delete counts[word];
    await chrome.storage.local.set({ learnedWords: next, undoCounts: counts });
    renderLearnedWords(next);
    showStatus(`“${word}” can convert again`);
  }

  clearLearnedEl.addEventListener("click", async () => {
    await chrome.storage.local.set({ learnedWords: {}, undoCounts: {} });
    renderLearnedWords({});
    showStatus("Cleared");
  });

  RADIO_SETTINGS.forEach((name) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.addEventListener("change", () => {
        updateDependentUI();
        saveSettings();
      });
    });
  });
  [themeEl, autoConvertEl, ...langOptionEls.map(({ input }) => input)].forEach((el) => {
    el.addEventListener("change", saveSettings);
  });
  themeEl.addEventListener("change", renderPreview);
  siteEnabledEl.addEventListener("change", saveSiteRule);

  try {
    versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  } catch (error) {
    versionEl.textContent = "";
  }

  loadSettings().catch(() => {
    showStatus("Could not load settings");
  });
  loadLearnedWords().catch(() => {});
})();
