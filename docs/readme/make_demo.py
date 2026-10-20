"""Generates docs/readme/demo.svg: an animated typing demo for the README.

Pure SVG + SMIL so it plays inside GitHub's <img> rendering (no scripts,
no web fonts). Run: python3 docs/readme/make_demo.py
"""
from pathlib import Path

W, H = 880, 290
SCENE = 4.0            # seconds per scene
FONT = ("-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, "
        "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'PingFang SC', "
        "'Hiragino Sans', 'Noto Sans JP', sans-serif")
MONO = "'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"

SCENES = [
    # label, typed, typed step (px), converted, converted step (px), tooltip
    ("KOREAN", "dkssudgktpdy", 17.5, "안녕하세요", 28, "Convert to: 안녕하세요"),
    ("ENGLISH TYPED IN KOREAN MODE", "ㅗ디ㅣㅐ", 28, "hello", 17.5, "Convert to: hello"),
    ("CHINESE", "nihao", 17.5, "你好", 28, "Convert to: 你好"),
    ("JAPANESE", "arigatou", 17.5, "ありがとう", 28, "Convert to: ありがとう"),
]
TOTAL = SCENE * len(SCENES)

FIELD_X, FIELD_Y, FIELD_W, FIELD_H = 64, 88, 752, 84
TEXT_X, TEXT_Y = FIELD_X + 30, FIELD_Y + 53


def kt(t):
    return f"{max(0.0, min(1.0, t / TOTAL)):.4f}"


def show(on, off):
    """Discrete visibility between on and off (seconds in the global cycle)."""
    return (f'<animate attributeName="opacity" calcMode="discrete" dur="{TOTAL}s" '
            f'repeatCount="indefinite" values="0;1;0" keyTimes="0;{kt(on)};{kt(off)}"/>')


def fade(on, off, ramp=0.25):
    times = [0, on, on + ramp, off - ramp, off, TOTAL]
    return (f'<animate attributeName="opacity" dur="{TOTAL}s" repeatCount="indefinite" '
            f'values="0;0;1;1;0;0" keyTimes="{";".join(kt(t) for t in times)}"/>')


def chars(text, x0, step, family, start, end, typing=None):
    out = []
    for i, ch in enumerate(text):
        on = start if typing is None else typing[0] + (typing[1] - typing[0]) * i / max(1, len(text) - 1)
        out.append(f'<text x="{x0 + i * step:.1f}" y="{TEXT_Y}" font-family="{family}" '
                   f'font-size="28" fill="#0f172a" opacity="0">{ch}{show(on, end)}</text>')
    return "\n".join(out)


parts = []
for n, (label, typed, tstep, conv, cstep, tip) in enumerate(SCENES):
    s = n * SCENE
    type_start, type_end = s + 0.35, s + 1.85
    convert = s + 2.55
    end = s + SCENE - 0.15
    typed_family = MONO if typed.isascii() else FONT
    conv_family = MONO if conv.isascii() else FONT

    caret_typed = TEXT_X + len(typed) * tstep + 3
    caret_conv = TEXT_X + len(conv) * cstep + 3
    tip_w = 26 + len(tip.encode("utf-16-le")) // 2 * 9.6 + sum(8 for c in tip if not c.isascii())

    parts.append(f'''
  <g>
    <text x="{FIELD_X}" y="{FIELD_Y - 22}" font-family="{FONT}" font-size="13" font-weight="600"
          letter-spacing="1.6" fill="#64748b" opacity="0">{label}{fade(s + 0.1, end)}</text>
    {chars(typed, TEXT_X, tstep, typed_family, 0, convert, typing=(type_start, type_end))}
    {chars(conv, TEXT_X, cstep, conv_family, convert, end) if conv.isascii() else
     f'<text x="{TEXT_X}" y="{TEXT_Y}" font-family="{FONT}" font-size="28" fill="#0f172a" opacity="0">{conv}<tspan dx="3" font-weight="200">|</tspan>{show(convert, end)}</text>'}
    <rect x="{caret_typed}" y="{TEXT_Y - 26}" width="2" height="32" rx="1" fill="#0f172a" opacity="0">{show(type_end + 0.05, convert)}</rect>
    {f'<rect x="{caret_conv}" y="{TEXT_Y - 26}" width="2" height="32" rx="1" fill="#0f172a" opacity="0">{show(convert, end)}</rect>' if conv.isascii() else ""}
    <g opacity="0" filter="url(#shadow)">{fade(s + 1.35, convert, 0.2)}
      <rect x="{FIELD_X}" y="{FIELD_Y + FIELD_H + 14}" width="{tip_w:.0f}" height="44" rx="22" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.9"/>
      <text x="{FIELD_X + 22}" y="{FIELD_Y + FIELD_H + 42}" font-family="{FONT}" font-size="16" font-weight="700" fill="#0b1220">{tip}</text>
    </g>
    <g opacity="0" filter="url(#shadow)">{fade(convert, end, 0.2)}
      <rect x="{FIELD_X}" y="{FIELD_Y + FIELD_H + 14}" width="196" height="44" rx="22" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.9"/>
      <text x="{FIELD_X + 22}" y="{FIELD_Y + FIELD_H + 42}" font-family="{FONT}" font-size="15" font-weight="600" fill="#334155">Converted · ⌫ to undo</text>
    </g>
    <g opacity="0">{show(convert - 0.3, convert + 0.25)}
      <rect x="{FIELD_X + FIELD_W - 120}" y="{FIELD_Y + FIELD_H + 16}" width="120" height="40" rx="10" fill="#0f172a"/>
      <text x="{FIELD_X + FIELD_W - 60}" y="{FIELD_Y + FIELD_H + 41}" text-anchor="middle" font-family="{FONT}" font-size="14" font-weight="600" fill="#ffffff">space</text>
    </g>
  </g>''')

keycap_idle = f'''
  <g>
    <rect x="{FIELD_X + FIELD_W - 120}" y="{FIELD_Y + FIELD_H + 16}" width="120" height="40" rx="10" fill="#ffffff" stroke="#d5dbe5"/>
    <rect x="{FIELD_X + FIELD_W - 120}" y="{FIELD_Y + FIELD_H + 52}" width="120" height="4" rx="2" fill="#d5dbe5"/>
    <text x="{FIELD_X + FIELD_W - 60}" y="{FIELD_Y + FIELD_H + 41}" text-anchor="middle" font-family="{FONT}" font-size="14" font-weight="600" fill="#64748b">space</text>
  </g>'''

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="LangSwitch converting dkssudgktpdy to 안녕하세요, ㅗ디ㅣㅐ to hello, nihao to 你好 and arigatou to ありがとう">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#eef2f7"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.96"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.78"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.9"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-50%" width="140%" height="220%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="24" fill="url(#bg)" stroke="#e2e8f0"/>
  <rect x="{FIELD_X}" y="{FIELD_Y}" width="{FIELD_W}" height="{FIELD_H}" rx="14" fill="#ffffff" stroke="#dbe1ea"/>
{keycap_idle}
{"".join(parts)}
</svg>
'''

out = Path(__file__).with_name("demo.svg")
out.write_text(svg, encoding="utf-8")
print(f"wrote {out} ({len(svg) // 1024} KB)")
