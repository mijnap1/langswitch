// Renders the Chrome Web Store screenshots (1280x800 JPG) from store.html.
// Serve the repo first:  python3 -m http.server 8791
// Then:                  node assets/screenshots/render.js
// macOS only (uses Google Chrome headless + sips).

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE_URL || "http://localhost:8791";
const OUT_DIR = __dirname;
const SCENES = [
  { name: "korean", file: "store-1-korean.jpg" },
  { name: "chinese", file: "store-2-chinese.jpg" },
  { name: "japanese", file: "store-3-japanese.jpg" },
  // The popup reads best in its dark theme.
  { name: "popup", file: "store-4-settings.jpg", dark: true }
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "langswitch-shots-"));

SCENES.forEach(({ name, file, dark }) => {
  const png = path.join(tmp, `${name}.png`);
  const args = [
    "--headless=new",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    "--window-size=1280,800",
    "--virtual-time-budget=6000",
    `--screenshot=${png}`
  ];
  if (dark) args.push("--blink-settings=preferredColorScheme=0");
  args.push(`${BASE}/assets/screenshots/store.html?scene=${name}`);
  execFileSync(CHROME, args, { stdio: "ignore" });

  const jpg = path.join(OUT_DIR, file);
  // Downscale the 2x render to exactly 1280x800 and drop alpha via JPEG.
  execFileSync("sips", ["-z", "800", "1280", "-s", "format", "jpeg", "-s", "formatOptions", "92", png, "--out", jpg], { stdio: "ignore" });
  console.log(`wrote ${path.relative(process.cwd(), jpg)}`);
});
