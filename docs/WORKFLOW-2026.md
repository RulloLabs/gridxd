# GridXD Workflow 2026

## Core product flow

**Upload → Detect → Extract → Style → Generate → Preview → Download ZIP**

### Extract
- Input: JPG/PNG/mockup/sprite.
- Detect multiple independent visual regions.
- Allow optional manual correction/selection before extraction.
- Extract real image assets locally in the browser.
- Produce PNG + SVG where vectorization succeeds.
- Auto-name results; manual renaming is optional and never blocks export.
- Preview each result and download the complete set as ZIP.

### Style
Create a visual DNA profile from the reference when available: stroke, palette, fill/outline, corners, proportions, grid, padding, weight and visual language.

### Generate
Use the reference Style DNA to create a coherent icon family. Target pack sizes are 12, 24 and 36 icons. Users may specify desired icon concepts or use a standard system list. The generated collection must be previewable before export.

### Preview
Show the complete collection and each asset independently. The user may rename, inspect, download and, when supported by the generator backend, regenerate individual assets. Naming must never be a blocking dependency.

### Export
MVP output:
- PNG
- SVG
- ZIP
- manifest/metadata

Suggested ZIP layout:

```text
GRIDXD_EXPORT/
├── png/
├── svg/
├── metadata/
│   └── manifest.json
└── README.md
```

## Product rule

Extract and Generate are two modes of the same GridXD application. API REST, Figma Plugin and CLI remain secondary ecosystem integrations and should only be surfaced as active capabilities once they are actually validated.
