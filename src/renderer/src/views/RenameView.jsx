import React, { useState, useEffect, useRef } from 'react';
import { buildFilename, getExt } from '@lib/filename.esm.js';
import { analyzeImageForKeywords as analyzeWithGemini } from '../gemini.js';
import { analyzeImageForKeywords as analyzeWithGrok } from '../grok.js';

const api = window.electronAPI;

export default function RenameView() {
  const [photos, setPhotos] = useState([]); // [{file, keywords, objectURL, checked}]
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outputDir, setOutputDir] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locInput, setLocInput] = useState('');
  const [exportState, setExportState] = useState({
    running: false,
    progress: 0,
    message: '',
    type: 'idle',
  });
  const [lastExportDir, setLastExportDir] = useState(null);
  const [aiProvider, setAiProvider] = useState('grok');
  const [grokKey, setGrokKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [baseKeywords, setBaseKeywords] = useState('');

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const keywordsInputRef = useRef(null);

  // Init: load locations, output dir, settings, active business
  useEffect(() => {
    api.loadLocations().then((saved) => {
      if (saved.length > 0) setLocations(saved);
    });
    api.getDownloads().then((dl) => setOutputDir(dl));
    api.loadSettings().then((s) => {
      const grok = s.grokKey || '';
      const gemini = s.geminiKey || '';
      // If no provider saved yet, pick whichever key exists (gemini takes precedence for existing users)
      const provider = s.aiProvider || (gemini ? 'gemini' : 'grok');
      setAiProvider(provider);
      setGrokKey(grok);
      setGeminiKey(gemini);
      setGeminiModel(s.geminiModel || 'gemini-2.0-flash');
    });
    api.loadBusinesses().then((biz) => {
      const active = biz.find((b) => b.isActive) || biz[0] || null;
      setActiveBusiness(active);
    });
  }, []);

  // Keyboard navigation (arrow keys)
  useEffect(() => {
    const handler = (e) => {
      if (document.activeElement === keywordsInputRef.current) return;
      if (e.key === 'ArrowLeft') setCurrentIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight')
        setCurrentIndex((i) => Math.min(photos.length - 1, i + 1));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [photos.length]);

  // ── File loading ──────────────────────────────────────────────
  function addFiles(fileList) {
    const imgs = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;

    const newPhotos = imgs.map((file) => ({
      file,
      keywords: '',
      objectURL: URL.createObjectURL(file),
      checked: false,
    }));

    setPhotos((prev) => {
      if (prev.length === 0) setCurrentIndex(0);
      return [...prev, ...newPhotos];
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }

  function clearAll() {
    photos.forEach((p) => URL.revokeObjectURL(p.objectURL));
    setPhotos([]);
    setCurrentIndex(0);
    setExportState({ running: false, progress: 0, message: '', type: 'idle' });
    setLastExportDir(null);
  }

  // ── AI Analyze ────────────────────────────────────────────────
  async function analyzeCurrentPhoto() {
    const photo = photos[currentIndex];
    const activeKey = aiProvider === 'grok' ? grokKey : geminiKey;
    if (!photo || !activeKey || !activeBusiness) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const analyze = aiProvider === 'grok' ? analyzeWithGrok : analyzeWithGemini;
      const result = await analyze(photo.file, activeBusiness, activeKey, geminiModel);
      updateKeywords(result.keywords);
    } catch (err) {
      setAnalyzeError(err.message);
      setTimeout(() => setAnalyzeError(''), 6000);
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Keywords ──────────────────────────────────────────────────
  function updateKeywords(value) {
    if (applyToAll) {
      setBaseKeywords(value);
      setPhotos((prev) =>
        prev.map((p, i) => {
          const kw = value.trim() ? `${value} ${i + 1}` : '';
          return { ...p, keywords: kw, checked: !!kw };
        })
      );
    } else {
      setPhotos((prev) =>
        prev.map((p, i) => {
          if (i !== currentIndex) return p;
          const hadKw = !!p.keywords.trim();
          const hasKw = !!value.trim();
          return { ...p, keywords: value, checked: hasKw ? (hadKw ? p.checked : true) : false };
        })
      );
    }
  }

  function toggleApplyToAll(checked) {
    setApplyToAll(checked);
    if (checked) {
      const base = photos[currentIndex]?.keywords?.replace(/\s+\d+$/, '') || '';
      setBaseKeywords(base);
      setPhotos((prev) =>
        prev.map((p, i) => {
          const kw = base ? `${base} ${i + 1}` : '';
          return { ...p, keywords: kw, checked: !!kw };
        })
      );
    }
  }

  // ── Filmstrip ─────────────────────────────────────────────────
  function toggleChecked(index) {
    setPhotos((prev) =>
      prev.map((p, i) => {
        if (i !== index || !p.keywords.trim()) return p;
        return { ...p, checked: !p.checked };
      })
    );
  }

  // ── Locations ─────────────────────────────────────────────────
  function addLocation() {
    const v = locInput.trim();
    if (!v) return;
    const next = [...locations, v];
    setLocations(next);
    setLocInput('');
    api.saveLocations(next);
  }

  function removeLocation(index) {
    const next = locations.filter((_, i) => i !== index);
    setLocations(next);
    api.saveLocations(next);
  }

  // ── Output folder ─────────────────────────────────────────────
  async function pickFolder() {
    const dir = await api.pickFolder();
    if (dir) setOutputDir(dir);
  }

  // ── Export ────────────────────────────────────────────────────
  async function runExport(toExport) {
    if (!toExport.length || !locations.length) return;

    setExportState({
      running: true,
      progress: 0,
      message: `Exporting ${toExport.length} photo${toExport.length !== 1 ? 's' : ''}…`,
      type: 'running',
    });
    setLastExportDir(null);

    let totalSaved = 0;
    let lastDir = outputDir;

    try {
      for (let i = 0; i < toExport.length; i++) {
        const photo = toExport[i];
        const ext = getExt(photo.file.name);
        const filenames = locations.map((loc) => buildFilename(photo.keywords, loc, ext));
        const result = await api.saveFiles({ srcPath: photo.file.path, filenames, outputDir });
        if (!result.ok) throw new Error(result.error);
        totalSaved += result.count;
        lastDir = result.dir;
        setExportState((s) => ({
          ...s,
          progress: Math.round(((i + 1) / toExport.length) * 100),
        }));
      }

      setLastExportDir(lastDir);
      setExportState({
        running: false,
        progress: 100,
        message: `✓ ${totalSaved} file${totalSaved !== 1 ? 's' : ''} saved`,
        type: 'success',
      });
    } catch (err) {
      setExportState({
        running: false,
        progress: 100,
        message: `✗ ${err.message}`,
        type: 'error',
      });
    }

    setTimeout(() => {
      setExportState((s) => ({ ...s, progress: 0 }));
    }, 1000);
  }

  // ── Derived state ─────────────────────────────────────────────
  const currentPhoto = photos[currentIndex] || null;
  const checkedCount = photos.filter((p) => p.checked).length;
  const currentHasKw = currentPhoto && !!currentPhoto.keywords.trim();
  const exporting = exportState.running;

  const kwHint =
    photos.length === 0
      ? ''
      : photos.filter((p) => p.keywords.trim()).length === photos.length
        ? `✓ all ${photos.length} done`
        : `${photos.filter((p) => p.keywords.trim()).length} / ${photos.length} set`;

  const previewFilenames =
    currentPhoto && currentPhoto.keywords.trim() && locations.length
      ? locations.map((loc) =>
          buildFilename(currentPhoto.keywords.trim(), loc, getExt(currentPhoto.file.name))
        )
      : [];

  const showViewer = photos.length > 0;

  return (
    <>
      <div className="main">
        {/* LEFT COL */}
        <div className="col-main">
          {!showViewer ? (
            <LoadZone
              onFiles={addFiles}
              onPickFiles={() => fileInputRef.current?.click()}
              onPickFolder={() => folderInputRef.current?.click()}
            />
          ) : (
            <Viewer
              photos={photos}
              currentIndex={currentIndex}
              currentPhoto={currentPhoto}
              kwHint={kwHint}
              onNav={(i) => setCurrentIndex(Math.max(0, Math.min(i, photos.length - 1)))}
              onClear={clearAll}
              onAddMore={() => fileInputRef.current?.click()}
              onKeywordsChange={updateKeywords}
              onToggleChecked={toggleChecked}
              keywordsInputRef={keywordsInputRef}
              canAnalyze={!!(aiProvider === 'grok' ? grokKey : geminiKey) && !!activeBusiness}
              analyzing={analyzing}
              analyzeError={analyzeError}
              onAnalyze={analyzeCurrentPhoto}
              applyToAll={applyToAll}
              baseKeywords={baseKeywords}
              onToggleApplyToAll={toggleApplyToAll}
            />
          )}
        </div>

        {/* SIDEBAR */}
        <div className="col-sidebar">
          {/* 01 Locations */}
          <div className="input-section">
            <div className="section-label">01 — Locations</div>
            <div className="locations-list">
              {locations.map((loc, i) => (
                <div key={i} className="loc-item">
                  <span className="loc-dot" />
                  <span className="loc-text">{loc}</span>
                  <button
                    className="loc-remove"
                    onClick={() => removeLocation(i)}
                    aria-label={`Remove ${loc}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="add-loc-row">
              <input
                type="text"
                value={locInput}
                onChange={(e) => setLocInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLocation()}
                placeholder="e.g. Elkhart, IN"
              />
              <button className="btn-sm" onClick={addLocation}>
                + Add
              </button>
            </div>
          </div>

          {/* 02 Output Folder */}
          <div className="input-section">
            <div className="section-label">02 — Output Folder</div>
            <div className="folder-row" onClick={pickFolder}>
              <span className="folder-icon">📁</span>
              <span className={`folder-path${outputDir ? ' set' : ''}`}>
                {outputDir || 'Click to choose…'}
              </span>
            </div>
            <div className="tip">Defaults to Downloads.</div>
          </div>

          {/* 03 Output Preview */}
          <div className="input-section preview-section">
            <div className="preview-header-row">
              <div className="section-label" style={{ marginBottom: 0 }}>
                03 — Output Preview
              </div>
              {previewFilenames.length > 0 && (
                <span className="output-count">
                  <span>{previewFilenames.length}</span> file
                  {previewFilenames.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="preview-list">
              {previewFilenames.length === 0 ? (
                <div className="empty-state">
                  Add keywords &amp; a location
                  <br />
                  to preview filenames.
                </div>
              ) : (
                previewFilenames.map((name, i) => (
                  <div key={i} className="output-item">
                    {name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="footer">
        <button
          className="btn-sm"
          disabled={!currentHasKw || !locations.length || exporting}
          onClick={() => currentPhoto && runExport([currentPhoto])}
        >
          ⬇ Export Single
        </button>
        <button
          className="btn btn-accent"
          disabled={!checkedCount || !locations.length || exporting}
          onClick={() => runExport(photos.filter((p) => p.checked))}
        >
          {checkedCount ? `⬇ Export Selected (${checkedCount})` : '⬇ Export Selected'}
        </button>
        <div
          className={`progress-wrap${exportState.progress > 0 || exportState.running ? ' visible' : ''}`}
        >
          <div className="progress-bar" style={{ width: `${exportState.progress}%` }} />
        </div>
        {exportState.message && (
          <span
            className={`status visible${exportState.type !== 'running' ? ` ${exportState.type}` : ''}`}
          >
            {exportState.message}
          </span>
        )}
        {exportState.type === 'success' && lastExportDir && (
          <span className="open-link visible" onClick={() => api.openFolder(lastExportDir)}>
            Open folder →
          </span>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => addFiles(e.target.files)}
        webkitdirectory=""
      />
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function LoadZone({ onFiles, onPickFiles, onPickFolder }) {
  const [dragover, setDragover] = useState(false);

  return (
    <div
      className={`load-zone${dragover ? ' dragover' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragover(true);
      }}
      onDragLeave={() => setDragover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragover(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <div className="load-zone-icon">🖼</div>
      <div className="load-zone-title">Drop images here</div>
      <div className="load-zone-sub">or choose below</div>
      <div className="load-zone-btns">
        <button className="btn btn-accent" onClick={onPickFiles}>
          Choose Images
        </button>
        <button className="btn-sm" onClick={onPickFolder}>
          Choose Folder
        </button>
      </div>
    </div>
  );
}

function Viewer({
  photos,
  currentIndex,
  currentPhoto,
  kwHint,
  onNav,
  onClear,
  onAddMore,
  onKeywordsChange,
  onToggleChecked,
  keywordsInputRef,
  canAnalyze,
  analyzing,
  analyzeError,
  onAnalyze,
  applyToAll,
  baseKeywords,
  onToggleApplyToAll,
}) {
  const filmstripRef = useRef(null);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!filmstripRef.current) return;
    const thumb = filmstripRef.current.children[currentIndex];
    if (thumb) thumb.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
  }, [currentIndex]);

  return (
    <div className="viewer">
      {/* Nav bar */}
      <div className="viewer-nav">
        <button
          className="nav-btn"
          onClick={() => onNav(currentIndex - 1)}
          disabled={currentIndex === 0}
          title="Previous (←)"
        >
          ←
        </button>
        <span className="nav-counter">
          {currentIndex + 1} / {photos.length}
        </span>
        <button
          className="nav-btn"
          onClick={() => onNav(currentIndex + 1)}
          disabled={currentIndex === photos.length - 1}
          title="Next (→)"
        >
          →
        </button>
        <div className="nav-spacer" />
        <button className="btn-sm" onClick={onAddMore}>
          + Add More
        </button>
        <button className="nav-clear" onClick={onClear}>
          ✕ Clear all
        </button>
      </div>

      {/* Image */}
      <div className="viewer-image">
        {currentPhoto && <img src={currentPhoto.objectURL} alt="" />}
      </div>

      {/* Keywords */}
      <div className="viewer-keywords">
        <div className="kw-label-row">
          <div className="section-label" style={{ marginBottom: 0 }}>
            Keywords <span className="kw-hint">{kwHint}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {photos.length > 1 && (
              <label className="posts-apply-all">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => onToggleApplyToAll(e.target.checked)}
                />
                Apply to all + number
              </label>
            )}
            {canAnalyze && (
              <button
                className={`analyze-btn${analyzing ? ' loading' : ''}`}
                onClick={onAnalyze}
                disabled={analyzing || !currentPhoto}
                title="Analyze image with AI"
              >
                {analyzing ? '⏳ Analyzing…' : '✨ Analyze'}
              </button>
            )}
          </div>
        </div>
        <input
          ref={keywordsInputRef}
          type="text"
          value={applyToAll ? baseKeywords : (currentPhoto?.keywords || '')}
          onChange={(e) => onKeywordsChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && currentIndex < photos.length - 1) onNav(currentIndex + 1);
          }}
          placeholder="e.g. 30 ft rollout dumpster"
        />
        {analyzeError
          ? <div className="tip" style={{ color: 'var(--danger)' }}>✗ {analyzeError}</div>
          : <div className="tip">Output: <span className="accent2">keywords-City-State.jpg</span></div>
        }
      </div>

      {/* Filmstrip */}
      <div className="filmstrip-wrap">
        <div className="filmstrip" ref={filmstripRef}>
          {photos.map((photo, i) => (
            <div
              key={i}
              className={[
                'filmstrip-thumb',
                i === currentIndex ? 'active' : '',
                photo.keywords.trim() ? 'has-kw' : '',
                photo.checked ? 'checked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onNav(i)}
            >
              <img src={photo.objectURL} alt="" />
              <div
                className="thumb-check"
                title={photo.checked ? 'Uncheck' : 'Check'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChecked(i);
                }}
              >
                ✓
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
