(() => {
  const SUPPORTED_LANGUAGES = new Set(["korean", "chinese", "japanese"]);
  const DEFAULT_SETTINGS = {
    language: "korean",
    contextMode: "balanced",
    tooltipTheme: "liquid-glass",
    appearance: "auto",
    autoConvert: true,
    koreanSlangMode: true,
    siteRules: {}
  };

  const languageEl = document.getElementById("language");
  const contextModeEl = document.getElementById("contextMode");
  const themeEl = document.getElementById("tooltipTheme");
  const appearanceEl = document.getElementById("appearance");
  const autoConvertEl = document.getElementById("autoConvert");
  const koreanSlangModeEl = document.getElementById("koreanSlangMode");
  const koreanSlangRowEl = document.getElementById("koreanSlangRow");
  const siteEnabledEl = document.getElementById("siteEnabled");
  const siteToggleLabelEl = document.getElementById("siteToggleLabel");
  const statusEl = document.getElementById("status");
  let currentHost = null;
  let loadedSettings = { ...DEFAULT_SETTINGS };

  function updateLanguageDependentUI() {
    const isKorean = languageEl.value === "korean";
    koreanSlangRowEl.style.display = isKorean ? "" : "none";
  }

  function showStatus(message) {
    statusEl.textContent = message;
    window.setTimeout(() => {
      statusEl.textContent = "";
    }, 1000);
  }

  async function getCurrentHost() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url) return null;
    if (!/^https?:/i.test(tab.url)) return null;

    try {
      return new URL(tab.url).hostname;
    } catch (error) {
      return null;
    }
  }

  function renderSiteToggle() {
    if (!currentHost) {
      siteEnabledEl.disabled = true;
      siteEnabledEl.checked = true;
      siteToggleLabelEl.textContent = "Enable on this site (unavailable on this page)";
      return;
    }

    siteEnabledEl.disabled = false;
    const rule = loadedSettings.siteRules[currentHost];
    siteEnabledEl.checked = rule !== false;
    siteToggleLabelEl.textContent = `Enable on ${currentHost}`;
  }

  async function loadSettings() {
    currentHost = await getCurrentHost();
    loadedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    if (!SUPPORTED_LANGUAGES.has(loadedSettings.language)) {
      loadedSettings.language = DEFAULT_SETTINGS.language;
      await chrome.storage.sync.set({ language: loadedSettings.language });
    }

    languageEl.value = loadedSettings.language;
    contextModeEl.value = loadedSettings.contextMode;
    themeEl.value = loadedSettings.tooltipTheme;
    appearanceEl.value = loadedSettings.appearance;
    autoConvertEl.checked = Boolean(loadedSettings.autoConvert);
    koreanSlangModeEl.checked = Boolean(loadedSettings.koreanSlangMode);
    renderSiteToggle();
    updateLanguageDependentUI();
  }

  async function saveSettings() {
    loadedSettings = {
      language: languageEl.value,
      contextMode: contextModeEl.value,
      tooltipTheme: themeEl.value,
      appearance: appearanceEl.value,
      autoConvert: autoConvertEl.checked,
      koreanSlangMode: koreanSlangModeEl.checked,
      siteRules: loadedSettings.siteRules || {}
    };

    await chrome.storage.sync.set(loadedSettings);
    showStatus("Saved");
  }

  async function saveSiteRule() {
    if (!currentHost) return;
    const nextRules = { ...(loadedSettings.siteRules || {}) };
    nextRules[currentHost] = Boolean(siteEnabledEl.checked);
    loadedSettings.siteRules = nextRules;
    await chrome.storage.sync.set({ siteRules: nextRules });
    showStatus("Site rule saved");
  }

  languageEl.addEventListener("change", () => {
    updateLanguageDependentUI();
    saveSettings();
  });

  [contextModeEl, themeEl, appearanceEl, autoConvertEl, koreanSlangModeEl].forEach((el) => {
    el.addEventListener("change", saveSettings);
  });
  siteEnabledEl.addEventListener("change", saveSiteRule);

  loadSettings().catch(() => {
    showStatus("Could not load settings");
  });
})();
