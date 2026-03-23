# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install           # Install dependencies
npm start             # Run in development mode
npm run dev           # Run with --dev flag
npm test              # Run Jest unit tests
npm run lint          # ESLint (src/ and tests/)
npm run format        # Prettier (src/ and tests/)
npm run build:mac     # Build macOS .dmg
npm run build:win     # Build Windows .exe
npm run build:all     # Build both platforms
```

## Architecture

Three-layer Electron app with no frontend framework or build step.

### File structure

```
src/
  main.js              Main process: window, IPC handlers
  preload.js           contextBridge → window.electronAPI
  store.js             JSON file persistence (app.getPath('userData'))
  lib/
    filename.js        Pure functions: buildFilename, getExt
                       Uses typeof module guard — works as browser global and Node CJS export
  renderer/
    index.html         Markup only (no inline styles or scripts)
    styles.css         All styles; system fonts (ui-monospace, system-ui)
    renderer.js        All UI logic; calls window.electronAPI
tests/
  filename.test.js     Jest tests for src/lib/filename.js
```

### IPC surface (preload.js → main.js)

| Method | Description |
|--------|-------------|
| `pickFolder()` | Opens native folder picker |
| `saveFiles({ srcPath, filenames, outputDir })` | Copies source file to each filename in outputDir |
| `openFolder(dir)` | Opens folder in Finder/Explorer |
| `getDownloads()` | Returns user's Downloads path |
| `loadLocations()` | Reads saved locations from store |
| `saveLocations(locations)` | Persists locations array to store |

### Key design decisions

- **File copy over base64**: renderer sends `file.path` (available on Electron `File` objects); main process calls `fs.promises.copyFile` once per location — avoids sending image data through IPC
- **Path traversal guard**: `save-files` validates each resolved destination stays within `outputDir`
- **Persistence**: `store.js` is a plain JSON file; `init(userDataPath)` must be called before first use (done in `app.whenReady`)
- **Shared pure functions**: `src/lib/filename.js` is loaded as a `<script>` tag in the renderer (globals) and `require()`'d in tests (CJS)
- **CSP**: `default-src 'self'; style-src 'self'; img-src 'self' blob:` — no unsafe-inline, blob: needed for `URL.createObjectURL` preview
