const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom"); // used to create mock web interface (which excalidraw-utils depends on)
const subsetFont = require("subset-font");

/**
 * Mapping of Excalidraw font family names to their .ttf file names
 * in @excalidraw/utils dist/prod/assets directory.
 */
const FONT_FILE_MAP = {
  Excalifont: "Excalifont.ttf",
  Virgil: "Virgil.ttf",
  Cascadia: "Cascadia Code.ttf",
  "Comic Shanns": "Comic Shanns Regular.ttf",
  "Liberation Sans": "Liberation Sans.ttf",
  "Lilita One": "Lilita One.ttf",
  Nunito: "Nunito ExtraLight Medium.ttf",
};

/**
 * Resolves the path to the @excalidraw/utils font assets directory.
 */
const getFontAssetsDir = () => {
  const utilsDir = path.dirname(require.resolve("@excalidraw/utils"));
  return path.join(utilsDir, "assets");
};

/**
 * Reads a font file and returns its Buffer.
 * @param {string} fontFileName - Name of the font file (e.g., "Excalifont.ttf")
 * @returns {Buffer|null} Font file buffer or null if the file doesn't exist
 */
const readFontFile = (fontFileName) => {
  try {
    const fontPath = path.join(getFontAssetsDir(), fontFileName);
    return fs.readFileSync(fontPath);
  } catch {
    return null;
  }
};

/**
 * Collects all characters used per font family from the SVG's text elements.
 * @param {SVGElement} svg - The SVG element to scan
 * @returns {Map<string, Set<string>>} Map of font family name to set of characters
 */
const collectUsedCharsPerFont = (svg) => {
  const fontCharsMap = new Map();

  const addChars = (fontFamily, text) => {
    if (!text) return;
    const families = fontFamily.split(",").map((f) => f.trim());
    for (const family of families) {
      if (FONT_FILE_MAP[family]) {
        if (!fontCharsMap.has(family)) fontCharsMap.set(family, new Set());
        const charSet = fontCharsMap.get(family);
        for (const ch of text) charSet.add(ch);
      }
    }
  };

  // Scan <text> elements for font-family attribute + text content
  const textElements = svg.querySelectorAll("text");
  for (const textEl of textElements) {
    const fontFamily = textEl.getAttribute("font-family") || "";
    const text = textEl.textContent || "";
    addChars(fontFamily, text);
  }

  // Also scan elements with style-based font-family
  const svgHTML = svg.outerHTML;
  const styleFontMatches = svgHTML.matchAll(
    /font-family:\s*([^;"]+)[^>]*>([^<]*)</g,
  );
  for (const match of styleFontMatches) {
    addChars(match[1], match[2]);
  }

  return fontCharsMap;
};

/**
 * Scans an SVG element for font-family references and generates @font-face CSS
 * with embedded base64 font data. Fonts are subsetted to include only the
 * characters actually used in the SVG, drastically reducing file size.
 * @param {SVGElement} svg - The SVG element to scan
 * @returns {Promise<string>} CSS string containing @font-face declarations
 */
const generateFontFaceCSS = async (svg) => {
  const fontCharsMap = collectUsedCharsPerFont(svg);

  if (fontCharsMap.size === 0) return "";

  // Generate @font-face rules for each used font (subsetted)
  const fontFaceRules = [];
  for (const [fontName, chars] of fontCharsMap) {
    const fileName = FONT_FILE_MAP[fontName];
    const fontBuffer = readFontFile(fileName);
    if (!fontBuffer) continue;

    try {
      const charString = [...chars].join("");
      const subsetBuffer = await subsetFont(fontBuffer, charString, {
        targetFormat: "sfnt",
      });
      const dataUri = `data:font/ttf;base64,${Buffer.from(subsetBuffer).toString("base64")}`;
      fontFaceRules.push(
        `@font-face { font-family: "${fontName}"; src: url("${dataUri}") format("truetype"); }`,
      );
    } catch {
      // Fallback: embed full font if subsetting fails
      const dataUri = `data:font/ttf;base64,${fontBuffer.toString("base64")}`;
      fontFaceRules.push(
        `@font-face { font-family: "${fontName}"; src: url("${dataUri}") format("truetype"); }`,
      );
    }
  }

  return fontFaceRules.join("\n");
};

/**
 * Injects @font-face CSS rules into the SVG's <style> element.
 * Fonts are subsetted to include only characters used in the SVG.
 * @param {SVGElement} svg - The SVG element to modify
 */
const embedFontsInSvg = async (svg) => {
  const fontCSS = await generateFontFaceCSS(svg);
  if (!fontCSS) return;

  // Find the existing <style> element or create one
  let styleEl = svg.querySelector("style.style-fonts");
  if (!styleEl) {
    styleEl = svg.querySelector("style");
  }
  if (!styleEl) {
    const defs =
      svg.querySelector("defs") || svg.insertBefore(
        svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "defs"),
        svg.firstChild,
      );
    styleEl = svg.ownerDocument.createElementNS(
      "http://www.w3.org/2000/svg",
      "style",
    );
    defs.appendChild(styleEl);
  }

  // Prepend font-face rules to existing style content
  styleEl.textContent = fontCSS + "\n" + (styleEl.textContent || "");
};

/**
 * Sets up browser-like global polyfills required by @excalidraw/utils
 * in a Node.js environment using JSDOM.
 */
const setupBrowserGlobals = () => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });

  // Core DOM globals
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.DOMParser = dom.window.DOMParser;
  global.XMLSerializer = dom.window.XMLSerializer;

  // Element types
  global.Element = dom.window.Element;
  global.HTMLElement = dom.window.HTMLElement;
  global.SVGElement = dom.window.SVGElement;
  global.Image = dom.window.Image;
  global.HTMLImageElement = dom.window.HTMLImageElement;
  global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

  // Browser APIs
  global.devicePixelRatio = 1;
  global.fetch = dom.window.fetch || (() => Promise.resolve({ ok: false }));
  global.URL = dom.window.URL;
  global.Blob = dom.window.Blob;
  global.FileReader = dom.window.FileReader;
  global.atob = dom.window.atob;
  global.btoa = dom.window.btoa;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);

  // Stubs for APIs not available in JSDOM
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ClipboardEvent = class ClipboardEvent {};
  global.FontFace = class FontFace {
    constructor() {}
    load() {
      return Promise.resolve(this);
    }
  };
  global.CanvasRenderingContext2D = class CanvasRenderingContext2D {};
  global.Path2D = class Path2D {
    constructor() {}
    addPath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    rect() {}
    ellipse() {}
    closePath() {}
  };

  // Mock canvas 2D context for text measurement and rendering
  const origCreateElement = document.createElement.bind(document);
  document.createElement = function (tag) {
    const el = origCreateElement(tag);
    if (tag === "canvas") {
      el.getContext = function (type) {
        if (type === "2d") {
          return {
            measureText: () => ({ width: 0 }),
            fillRect: () => {},
            clearRect: () => {},
            drawImage: () => {},
            getImageData: () => ({ data: [] }),
            putImageData: () => {},
            createImageData: () => ({}),
            setTransform: () => {},
            resetTransform: () => {},
            scale: () => {},
            rotate: () => {},
            translate: () => {},
            transform: () => {},
            beginPath: () => {},
            closePath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            bezierCurveTo: () => {},
            quadraticCurveTo: () => {},
            arc: () => {},
            arcTo: () => {},
            rect: () => {},
            fill: () => {},
            stroke: () => {},
            clip: () => {},
            save: () => {},
            restore: () => {},
            canvas: el,
            fillStyle: "",
            strokeStyle: "",
            lineWidth: 1,
            font: "",
            textAlign: "",
            textBaseline: "",
            globalAlpha: 1,
            globalCompositeOperation: "source-over",
          };
        }
        return null;
      };
      el.toBlob = (cb) => cb(new Blob());
      el.toDataURL = () => "";
    }
    return el;
  };

  return dom;
};

// Initialize browser globals once when the module is loaded
setupBrowserGlobals();

// Cache the dynamic import promise so we only load the module once
let utilsPromise = null;
const getExcalidrawUtils = () => {
  if (!utilsPromise) {
    utilsPromise = import("@excalidraw/utils");
  }
  return utilsPromise;
};

/**
 * Function to convert an excalidraw JSON file to an SVG
 * @param {string | object} diagram excalidraw diagram to convert
 * @returns {Promise<SVGElement>} SVG XML Node
 */
const excalidrawToSvg = async (diagram) => {
  // if the diagram is a string, parse it
  const diagramObj =
    typeof diagram === "string" ? JSON.parse(diagram) : diagram;

  const { exportToSvg } = await getExcalidrawUtils();

  // Suppress non-critical font-face warnings from @excalidraw/utils
  // in the Node.js environment where font loading is not supported
  const origConsoleError = console.error;
  console.error = (...args) => {
    const msg = args[0];
    if (typeof msg === "string" && msg.includes("font-face")) return;
    origConsoleError.apply(console, args);
  };

  try {
    const svg = await exportToSvg({
      elements: diagramObj.elements || [],
      appState: diagramObj.appState || {},
      files: diagramObj.files || null,
      skipInliningFonts: true,
    });

    // Embed Excalidraw fonts directly into the SVG as base64 @font-face rules
    // Fonts are subsetted to only include glyphs for characters used in the SVG
    await embedFontsInSvg(svg);

    return svg;
  } finally {
    console.error = origConsoleError;
  }
};

module.exports = excalidrawToSvg;
