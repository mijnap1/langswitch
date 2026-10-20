(() => {
  // Tooltip themes, shared by the content script and the popup preview.

  const root = typeof window !== "undefined" ? window : globalThis;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const FILTER_HOST_ID = "langswitch-glass-filters";

  // Liquid Glass: a clear, saturated lens with a bright rim. On Chrome the
  // backdrop is also refracted near the edges (see addRefraction).
  const LIQUID_GLASS = {
    light: {
      background: "linear-gradient(135deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.26) 100%)",
      color: "#0b1220",
      border: "1px solid rgba(255,255,255,0.62)",
      borderRadius: "999px",
      boxShadow: [
        "inset 0 1px 0.5px rgba(255,255,255,0.95)",
        "inset 0 -1px 1px rgba(255,255,255,0.4)",
        "inset 0 0 14px rgba(255,255,255,0.22)",
        "0 8px 28px rgba(15,23,42,0.16)",
        "0 1px 3px rgba(15,23,42,0.1)"
      ].join(", "),
      textShadow: "0 0.5px 0 rgba(255,255,255,0.7)",
      backdropFilter: "blur(8px) saturate(190%) brightness(1.08)",
      webkitBackdropFilter: "blur(8px) saturate(190%) brightness(1.08)"
    },
    dark: {
      background: "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.11) 100%)",
      color: "#f5f7fb",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "999px",
      boxShadow: [
        "inset 0 1px 0.5px rgba(255,255,255,0.5)",
        "inset 0 -1px 1px rgba(255,255,255,0.12)",
        "inset 0 0 14px rgba(255,255,255,0.07)",
        "0 10px 30px rgba(0,0,0,0.45)",
        "0 1px 3px rgba(0,0,0,0.3)"
      ].join(", "),
      textShadow: "0 1px 2px rgba(0,0,0,0.45)",
      backdropFilter: "blur(8px) saturate(175%) brightness(0.82)",
      webkitBackdropFilter: "blur(8px) saturate(175%) brightness(0.82)"
    }
  };

  const THEMES = {
    "liquid-glass": LIQUID_GLASS,
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


  // Displacement map for a rounded rect: pixels near the edge sample the
  // backdrop from further inside, like light bending through a thick lens.
  function buildLensMap(width, height, radius, edge) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const image = ctx.createImageData(width, height);
    const r = Math.min(radius, width / 2, height / 2);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const dx = Math.min(Math.max(px, r), width - r) - px;
        const dy = Math.min(Math.max(py, r), height - r) - py;
        const dist = Math.hypot(dx, dy);
        const fromEdge = r - dist;
        let vx = 0;
        let vy = 0;
        if (dist > 0 && fromEdge >= 0 && fromEdge < edge) {
          const strength = (1 - fromEdge / edge) ** 2;
          vx = (dx / dist) * strength;
          vy = (dy / dist) * strength;
        }
        const i = (y * width + x) * 4;
        image.data[i] = 128 + vx * 127;
        image.data[i + 1] = 128 + vy * 127;
        image.data[i + 2] = 128;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }

  function getFilterHost() {
    let host = document.getElementById(FILTER_HOST_ID);
    if (host) return host;
    host = document.createElementNS(SVG_NS, "svg");
    host.id = FILTER_HOST_ID;
    host.setAttribute("aria-hidden", "true");
    host.setAttribute("width", "0");
    host.setAttribute("height", "0");
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  function supportsRefraction() {
    return Boolean(root.CSS && CSS.supports && CSS.supports("backdrop-filter", "url(#x)"))
      && /Chrome\//.test(navigator.userAgent);
  }

  function addRefraction(el, dark) {
    const rect = el.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (!width || !height || width > 1200 || height > 400) return;

    const map = buildLensMap(width, height, height / 2, Math.min(height / 2, 22));
    if (!map) return;

    const id = `langswitch-glass-${(el.className || "el").toString().replace(/[^\w-]/g, "")}`;
    const host = getFilterHost();
    let filter = host.querySelector(`#${id}`);
    if (!filter) {
      filter = document.createElementNS(SVG_NS, "filter");
      filter.id = id;
      filter.setAttribute("filterUnits", "objectBoundingBox");
      filter.setAttribute("x", "0");
      filter.setAttribute("y", "0");
      filter.setAttribute("width", "1");
      filter.setAttribute("height", "1");
      filter.setAttribute("primitiveUnits", "userSpaceOnUse");
      filter.setAttribute("color-interpolation-filters", "sRGB");
      const feImage = document.createElementNS(SVG_NS, "feImage");
      feImage.setAttribute("x", "0");
      feImage.setAttribute("y", "0");
      feImage.setAttribute("preserveAspectRatio", "none");
      feImage.setAttribute("result", "map");
      const displace = document.createElementNS(SVG_NS, "feDisplacementMap");
      displace.setAttribute("in", "SourceGraphic");
      displace.setAttribute("in2", "map");
      displace.setAttribute("xChannelSelector", "R");
      displace.setAttribute("yChannelSelector", "G");
      displace.setAttribute("result", "bent");
      // The unbent backdrop underneath: if any sample misses (or the map
      // fails to load), it shows the plain backdrop instead of going dark.
      const merge = document.createElementNS(SVG_NS, "feMerge");
      ["SourceGraphic", "bent"].forEach((input) => {
        const node = document.createElementNS(SVG_NS, "feMergeNode");
        node.setAttribute("in", input);
        merge.appendChild(node);
      });
      filter.append(feImage, displace, merge);
      host.appendChild(filter);
    }

    const feImage = filter.querySelector("feImage");
    feImage.setAttribute("width", String(width));
    feImage.setAttribute("height", String(height));
    feImage.setAttribute("href", map);
    filter.querySelector("feDisplacementMap").setAttribute("scale", String(Math.min(40, height * 1.3)));

    // Clearer centre than the fallback: the refraction carries the effect.
    const tone = dark ? "saturate(170%) brightness(0.9)" : "saturate(190%) brightness(1.1)";
    el.style.backdropFilter = `url(#${id}) blur(1.5px) ${tone}`;
  }

  function parseColor(value) {
    const parts = (value || "").match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    const [r, g, b, a = 1] = parts.map(Number);
    return { r, g, b, a: /^rgba?\(/.test(value) ? a : 1 };
  }

  // Is the page right behind `el` dark? Glass should match its backdrop,
  // not the OS theme (a dark-mode Mac still visits white pages).
  function isBackdropDark(el) {
    const rect = el.getBoundingClientRect();
    const stack = document.elementsFromPoint
      ? document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      : [];
    const below = stack.find((node) => node !== el && !el.contains(node));
    for (let node = below; node && node.nodeType === 1; node = node.parentElement) {
      const color = parseColor(getComputedStyle(node).backgroundColor);
      if (color && color.a > 0.5) {
        const luminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
        return luminance < 0.45;
      }
    }
    const scheme = getComputedStyle(document.documentElement).colorScheme || "";
    return scheme.includes("dark") && !scheme.includes("light");
  }

  function getStyles(themeName, dark) {
    const theme = THEMES[themeName] || THEMES["liquid-glass"];
    return dark ? theme.dark : theme.light;
  }

  // Call once the element is in the DOM, so Liquid Glass can measure it.
  // `adaptive`: pick light/dark from the page behind it (Appearance: Auto).
  function apply(el, themeName, dark, { adaptive = false } = {}) {
    const isGlass = themeName === "liquid-glass" || !THEMES[themeName];
    let useDark = dark;
    if (isGlass && adaptive && el.isConnected) {
      try {
        useDark = isBackdropDark(el);
      } catch (error) {
        useDark = dark;
      }
    }

    Object.entries(getStyles(themeName, useDark)).forEach(([prop, value]) => {
      el.style[prop] = value;
    });
    if (isGlass && el.isConnected && supportsRefraction()) {
      try {
        addRefraction(el, useDark);
      } catch (error) {
        // Keep the plain frosted version.
      }
    }
  }

  root.LangSwitchThemes = { apply, getStyles, names: Object.keys(THEMES) };
})();
