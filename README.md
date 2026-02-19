# Excalidraw to SVG

Node.js library to convert Excalidraw diagrams into standalone SVGs with embedded fonts.
Useful if you are storing Excalidraw diagrams in repos and want a pipeline to export them, or need server-side SVG rendering.

> **Note:** This is a Node.js library. If you want to export SVGs in a web app, use the [@excalidraw/utils](https://www.npmjs.com/package/@excalidraw/utils) library directly.

## Features

- **CLI & API** — Use from the command line or as a library in your Node.js project.
- **Embedded fonts** — Excalidraw's custom fonts (Excalifont, Virgil, Cascadia, Comic Shanns, Liberation Sans, Lilita One, Nunito) are automatically detected and embedded as base64 `@font-face` rules, so SVGs render correctly without external font dependencies.
- **JSDOM-based** — Sets up a browser-like environment under the hood using JSDOM, so `@excalidraw/utils` works seamlessly in Node.js.
- **String or Object input** — Pass in a raw JSON string or a parsed JavaScript object.

## Installation

```bash
npm install @aldinokemal2104/excalidraw-to-svg
```

## Usage

### CLI

You can run this package as a CLI tool via `npx` (or as a locally installed dependency). It takes two arguments: the path to the `.excalidraw` file and an optional output path (file or directory).

```bash
# Output to the same directory as the input (replaces .excalidraw with .svg)
npx @aldinokemal2104/excalidraw-to-svg ./diagrams/example.excalidraw

# Output to a specific directory
npx @aldinokemal2104/excalidraw-to-svg ./diagrams/example.excalidraw ./output

# Output to a specific file
npx @aldinokemal2104/excalidraw-to-svg ./diagrams/example.excalidraw ./output/my-diagram.svg
```

### API

Install the package as a dependency and call the exported function with an Excalidraw JSON object or string. The function returns a **DOM `SVGElement`** — use `.outerHTML` to get the string representation.

```javascript
const excalidrawToSvg = require("@aldinokemal2104/excalidraw-to-svg");

const diagram = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [
    {
      id: "vWrqOAfkind2qcm7LDAGZ",
      type: "ellipse",
      x: 414,
      y: 237,
      width: 214,
      height: 214,
      angle: 0,
      strokeColor: "#000000",
      backgroundColor: "#15aabf",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      strokeSharpness: "sharp",
      seed: 1041657908,
      version: 120,
      versionNonce: 1188004276,
      isDeleted: false,
      boundElementIds: null,
    },
  ],
  appState: {
    viewBackgroundColor: "#ffffff",
    gridSize: null,
  },
};

const svgElement = await excalidrawToSvg(diagram);
console.log(svgElement.outerHTML);
```

You can also pass a raw JSON string:

```javascript
const fs = require("fs");
const excalidrawToSvg = require("@aldinokemal2104/excalidraw-to-svg");

const json = fs.readFileSync("./diagrams/example.excalidraw", "utf8");
const svgElement = await excalidrawToSvg(json);
console.log(svgElement.outerHTML);
```

## How It Works

1. **Browser environment simulation** — On module load, JSDOM is used to set up global browser APIs (`window`, `document`, `DOMParser`, `Canvas`, etc.) that `@excalidraw/utils` expects.
2. **SVG export** — The diagram is passed to `@excalidraw/utils`' `exportToSvg()` with `skipInliningFonts: true`.
3. **Font embedding** — The generated SVG is scanned for `font-family` references. For each Excalidraw font found, the corresponding `.ttf` file is read from `@excalidraw/utils`' assets, base64-encoded, and injected as `@font-face` CSS rules into the SVG's `<style>` element.

## Development

### Prerequisites

- Node.js (with `--experimental-vm-modules` support for tests)

### Running Tests

```bash
npm test
```

### Project Structure

```
src/
├── excalidraw-to-svg.js      # Core conversion logic + font embedding
├── build-svg-path.js          # Output path resolution for CLI
├── build-svg-path.test.js     # Tests for path resolution
├── excalidraw-to-svg.test.js  # Tests for SVG conversion
├── cli.js                     # CLI entry point
└── index.js                   # Package entry point (re-exports core)
diagrams/                      # Example .excalidraw files
```

## Dependencies

- [`@excalidraw/utils`](https://www.npmjs.com/package/@excalidraw/utils) — Excalidraw's official export utilities
- [`jsdom`](https://www.npmjs.com/package/jsdom) — Browser environment simulation for Node.js

## License

MIT
