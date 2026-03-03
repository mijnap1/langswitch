# LangSwitch

LangSwitch is a Chrome extension that fixes mistyped keyboard-layout input directly in text fields.

It is built for multilingual typing and works fully locally in the browser.

## Features

- Korean layout correction (English-key -> Hangul, Dubeolsik)
- French accent restoration
- Spanish accent restoration
- Suggestion tooltip + quick apply shortcut (`Alt + L`)
- Optional auto-convert on `Space` / `Enter` / `Tab`
- Context modes: `Strict`, `Balanced`, `Aggressive`
- Per-site enable/disable rules
- Theme and appearance settings (Light / Dark / Auto)

## Privacy

- 100% local processing
- No cloud translation
- No remote AI calls
- No typing content sent to external servers

## Project Structure

```text
LangSwitch/
├── manifest.json
├── assets/
│   └── logo.png
├── scripts/
│   ├── converter.js
│   └── content.js
├── ui/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── data/
│   └── english-words.txt
└── dev/
    └── test.html
```

## Local Setup

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `/Users/jamieryu/Desktop/workshop/Websites/LangSwitch`

## Quick Test

1. Open any page with an `input` or `textarea`
2. Type `dkssudgktpdy`
3. Confirm suggestion appears
4. Press `Alt + L` to apply conversion

## Settings

Click the extension icon to configure:

- Language: Korean / French / Spanish
- Context mode: Strict / Balanced / Aggressive
- Auto-convert toggle
- Per-site enable/disable for current domain
- Tooltip theme and appearance

## Permissions (Why)

- `storage`: save user settings
- `tabs` + `activeTab`: get current domain for per-site toggle in popup
- Host access via content scripts: detect/convert in editable fields on pages

## Publishing Notes

- Category: **Tools**
- Keep a public privacy policy URL in the store listing
- If using `<all_urls>`, Chrome Web Store review can take longer due to broad host permissions

## License

Add a license file (`LICENSE`) before release (MIT is a common choice).
