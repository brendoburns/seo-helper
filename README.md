# FileRenamer

Batch rename photos by location and export copies — desktop app built with Electron.

## Development (running locally)

You need [Node.js](https://nodejs.org) installed (v18+).

```bash
# Install dependencies
npm install

# Run the app
npm start
```

## Building a distributable

This produces a standalone installer your friend can just double-click — no Node.js required on their machine.

```bash
# Install dependencies first
npm install

# Build for Windows (.exe installer)
npm run build:win

# Build for Mac (.dmg)
npm run build:mac

# Build for both
npm run build:all
```

Output files will be in the `dist/` folder:
- **Windows**: `dist/FileRenamer Setup 1.0.0.exe`
- **Mac**: `dist/FileRenamer-1.0.0.dmg`

## Notes on building

- **Building for Mac** must be done on a Mac (Apple requirement).
- **Building for Windows** can be done on Windows or Mac.
- If you want to build for both platforms, the easiest approach is to build each on its respective OS, or use a CI service like GitHub Actions.

## Adding an icon

Place your icon files in the `assets/` folder:
- `assets/icon.ico` — Windows (256x256 recommended)
- `assets/icon.icns` — Mac
- `assets/icon.png` — fallback (512x512)

Free tools: [icoconvert.com](https://icoconvert.com) for .ico, [Image2icon](https://img2icnsapp.com) for .icns.

## How it works

1. Drop in a photo
2. Type keywords (e.g. `30 ft rollout dumpster`)
3. Add locations (e.g. `Elkhart, IN`)
4. Choose an output folder (defaults to Downloads)
5. Click Export — one renamed copy is saved per location
