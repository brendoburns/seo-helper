import React, { useState, useEffect, useRef } from 'react';

const api = window.electronAPI;

const PLATFORMS = {
  instagram: {
    label: 'Instagram',
    formats: [
      { id: 'square',   label: 'Square',   w: 1080, h: 1080 },
      { id: 'portrait', label: 'Portrait',  w: 1080, h: 1350 },
      { id: 'story',    label: 'Story',     w: 1080, h: 1920 },
    ],
  },
  facebook: {
    label: 'Facebook',
    formats: [
      { id: 'square',    label: 'Square',    w: 1080, h: 1080 },
      { id: 'landscape', label: 'Landscape', w: 1200, h: 628  },
    ],
  },
};

function getFormat(platform, formatId) {
  return PLATFORMS[platform].formats.find((f) => f.id === formatId) || PLATFORMS[platform].formats[0];
}

function renderCrop(ctx, img, tw, th, offset, zoom = 1) {
  const tgtRatio = tw / th;
  // Largest source rect at target ratio
  let sw_base, sh_base;
  if (img.naturalWidth / img.naturalHeight > tgtRatio) {
    sh_base = img.naturalHeight;
    sw_base = sh_base * tgtRatio;
  } else {
    sw_base = img.naturalWidth;
    sh_base = sw_base / tgtRatio;
  }
  // Zoom shrinks the source crop (zoom in = less source area)
  const sw = sw_base / zoom;
  const sh = sh_base / zoom;
  // Pan within available space
  const maxPanX = (img.naturalWidth  - sw) / 2;
  const maxPanY = (img.naturalHeight - sh) / 2;
  const sx = maxPanX + offset.x * maxPanX;
  const sy = maxPanY + offset.y * maxPanY;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

export default function PostsView() {
  const [businesses, setBusinesses] = useState([]);
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [photos, setPhotos] = useState([]);   // [{file, objectURL, caption, cropOffset:{x,y}}]
  const [currentIndex, setCurrentIndex] = useState(0);
  const [platform, setPlatform] = useState('instagram');
  const [formatId, setFormatId] = useState('square');
  const [folderName, setFolderName] = useState('');
  const [outputDir, setOutputDir] = useState(null);
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [applyToAll, setApplyToAll] = useState(false);
  const [baseCaption, setBaseCaption] = useState('');

  const fileInputRef  = useRef(null);
  const canvasRef     = useRef(null);
  const filmstripRef  = useRef(null);
  const loadedImgRef  = useRef(null);  // currently displayed Image object
  const dragRef       = useRef({ active: false, startX: 0, startY: 0, startOffset: { x: 0, y: 0 } });

  const currentPhoto = photos[currentIndex] || null;

  // ── Bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    api.loadBusinesses().then((biz) => {
      setBusinesses(biz);
      setActiveBusiness(biz.find((b) => b.isActive) || biz[0] || null);
    });
    api.getDownloads().then(setOutputDir);
  }, []);

  // ── Reload image when photo / platform / format changes ───────
  useEffect(() => {
    if (!currentPhoto) { loadedImgRef.current = null; return; }
    const fmt = getFormat(platform, formatId);
    loadImage(currentPhoto.objectURL).then((img) => {
      loadedImgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = fmt.w;
      canvas.height = fmt.h;
      renderCrop(canvas.getContext('2d'), img, fmt.w, fmt.h, currentPhoto.cropOffset, currentPhoto.zoom);
    });
  }, [currentIndex, platform, formatId]);

  // ── Redraw when crop offset or zoom changes ───────────────────
  useEffect(() => {
    const img = loadedImgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !currentPhoto) return;
    const fmt = getFormat(platform, formatId);
    renderCrop(canvas.getContext('2d'), img, fmt.w, fmt.h, currentPhoto.cropOffset, currentPhoto.zoom);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhoto?.cropOffset?.x, currentPhoto?.cropOffset?.y, currentPhoto?.zoom]);

  // ── Scroll filmstrip to active thumb ──────────────────────────
  useEffect(() => {
    if (!filmstripRef.current) return;
    const thumb = filmstripRef.current.children[currentIndex];
    if (thumb) thumb.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
  }, [currentIndex]);

  // ── Drag-to-pan on canvas ─────────────────────────────────────
  function onCanvasMouseDown(e) {
    if (!currentPhoto) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: { ...currentPhoto.cropOffset },
    };
    e.preventDefault();
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.active) return;
      const canvas = canvasRef.current;
      const img = loadedImgRef.current;
      if (!canvas || !img) return;

      const rect = canvas.getBoundingClientRect();
      const dx = (e.clientX - dragRef.current.startX) / rect.width;
      const dy = (e.clientY - dragRef.current.startY) / rect.height;

      const fmt = getFormat(platform, formatId);
      const srcRatio = img.naturalWidth / img.naturalHeight;
      const tgtRatio = fmt.w / fmt.h;

      const newOffset = {
        x: Math.max(-1, Math.min(1, dragRef.current.startOffset.x - dx * 2)),
        y: Math.max(-1, Math.min(1, dragRef.current.startOffset.y - dy * 2)),
      };

      setPhotos((prev) =>
        prev.map((p, i) => i === currentIndex ? { ...p, cropOffset: newOffset } : p)
      );
    }
    function onUp() { dragRef.current.active = false; }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [currentIndex, platform, formatId]);

  // ── Photo management ──────────────────────────────────────────
  function addPhotos(fileList) {
    const imgs = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    const next = imgs.map((file) => ({
      file,
      objectURL: URL.createObjectURL(file),
      caption: '',
      cropOffset: { x: 0, y: 0 },
      zoom: 1,
    }));
    setPhotos((prev) => {
      if (prev.length === 0) setCurrentIndex(0);
      return [...prev, ...next];
    });
  }

  function removePhoto(i) {
    URL.revokeObjectURL(photos[i].objectURL);
    setPhotos((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      setCurrentIndex((ci) => Math.min(ci, Math.max(0, next.length - 1)));
      return next;
    });
  }

  function updateCaption(value) {
    if (applyToAll) {
      setBaseCaption(value);
      setPhotos((prev) => prev.map((p, i) => ({ ...p, caption: value ? `${value} ${i + 1}` : '' })));
    } else {
      setPhotos((prev) => prev.map((p, i) => i === currentIndex ? { ...p, caption: value } : p));
    }
  }

  function toggleApplyToAll(checked) {
    setApplyToAll(checked);
    if (checked) {
      // Seed baseCaption from current photo, propagate to all
      const base = currentPhoto?.caption?.replace(/\s+\d+$/, '') || '';
      setBaseCaption(base);
      setPhotos((prev) => prev.map((p, i) => ({ ...p, caption: base ? `${base} ${i + 1}` : '' })));
    }
  }

  function resetCrop() {
    setPhotos((prev) =>
      prev.map((p, i) => i === currentIndex ? { ...p, cropOffset: { x: 0, y: 0 }, zoom: 1 } : p)
    );
  }

  function setZoom(value) {
    setPhotos((prev) =>
      prev.map((p, i) => i === currentIndex ? { ...p, zoom: value } : p)
    );
  }

  // ── Business switcher ─────────────────────────────────────────
  async function switchBusiness(id) {
    await api.setActiveBusiness(Number(id));
    const biz = await api.loadBusinesses();
    setBusinesses(biz);
    setActiveBusiness(biz.find((b) => b.isActive) || null);
  }

  // ── Platform / format ─────────────────────────────────────────
  function selectPlatform(p) {
    setPlatform(p);
    setFormatId(PLATFORMS[p].formats[0].id);
  }

  // ── Export ────────────────────────────────────────────────────
  async function exportPhotos(toExport) {
    if (!toExport.length || !outputDir || !folderName.trim()) return;
    const fmt = getFormat(platform, formatId);
    const exportPath = `${outputDir}/${folderName.trim()}`;

    const items = await Promise.all(toExport.map(async (photo) => {
      const img = await loadImage(photo.objectURL);
      const offscreen = document.createElement('canvas');
      offscreen.width  = fmt.w;
      offscreen.height = fmt.h;
      renderCrop(offscreen.getContext('2d'), img, fmt.w, fmt.h, photo.cropOffset, photo.zoom);
      const imageData = offscreen.toDataURL('image/jpeg', 0.92).split(',')[1];
      const base = photo.file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_\-]/gi, '-');
      return {
        imageData,
        imageFilename:   `${base}-${platform}-${fmt.id}.jpg`,
        caption:         photo.caption,
        captionFilename: `${base}-${platform}-${fmt.id}-caption.txt`,
      };
    }));

    const result = await api.exportPost({ outputDir: exportPath, items });
    if (result.ok) {
      setStatus({ msg: `✓ ${toExport.length} photo${toExport.length !== 1 ? 's' : ''} saved`, type: 'success' });
      setTimeout(() => setStatus({ msg: '', type: '' }), 3000);
    } else {
      setStatus({ msg: `✗ ${result.error}`, type: 'error' });
    }
  }

  // ── Derived ───────────────────────────────────────────────────
  const fmt      = getFormat(platform, formatId);
  const canExport = photos.length > 0 && !!folderName.trim() && !!outputDir;

  return (
    <div className="posts-view">

      {/* Top bar */}
      <div className="posts-topbar">
        <div className="posts-topbar-label">Business</div>
        {businesses.length > 0 ? (
          <select className="biz-switcher" value={activeBusiness?.id ?? ''} onChange={(e) => switchBusiness(e.target.value)}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        ) : (
          <span className="posts-topbar-hint">Add a business in Settings ⚙</span>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn-sm" onClick={() => fileInputRef.current?.click()}>+ Add Photos</button>
      </div>

      <div className="posts-body">

        {/* LEFT: canvas + filmstrip */}
        <div className="posts-preview-col">
          {currentPhoto ? (
            <>
              <div className="posts-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  className="posts-canvas"
                  onMouseDown={onCanvasMouseDown}
                />
                <div className="posts-canvas-meta">
                  <span>{fmt.w} × {fmt.h} — drag to reposition</span>
                  <button className="btn-sm" onClick={resetCrop}>Reset</button>
                </div>
              </div>

              <div className="posts-filmstrip" ref={filmstripRef}>
                {photos.map((p, i) => (
                  <div
                    key={i}
                    className={`posts-thumb${i === currentIndex ? ' active' : ''}`}
                    onClick={() => setCurrentIndex(i)}
                  >
                    <img src={p.objectURL} alt="" />
                    <button
                      className="posts-thumb-remove"
                      onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                    >✕</button>
                    {p.caption && <div className="posts-thumb-dot" />}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              className="posts-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="posts-dropzone-icon">🖼</div>
              <div>Drop photos or click to choose</div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => addPhotos(e.target.files)} />
        </div>

        {/* RIGHT: controls */}
        <div className="posts-controls-col">

          <div className="posts-field">
            <div className="posts-field-label">Platform</div>
            <div className="settings-tone-row">
              {Object.entries(PLATFORMS).map(([key, p]) => (
                <button key={key} className={`tone-btn${platform === key ? ' active' : ''}`} onClick={() => selectPlatform(key)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="posts-field">
            <div className="posts-field-label">Format</div>
            <div className="settings-tone-row">
              {PLATFORMS[platform].formats.map((f) => (
                <button key={f.id} className={`tone-btn${formatId === f.id ? ' active' : ''}`} onClick={() => setFormatId(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="posts-field">
            <div className="posts-field-label">Zoom</div>
            <div className="posts-zoom-row">
              <input
                type="range" min="1" max="4" step="0.05"
                value={currentPhoto?.zoom ?? 1}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="posts-zoom-slider"
                disabled={!currentPhoto}
              />
              <span className="posts-zoom-val">{(currentPhoto?.zoom ?? 1).toFixed(1)}×</span>
            </div>
          </div>

          <div className="posts-field">
            <div className="posts-caption-header">
              <div className="posts-field-label">
                Caption
                {!applyToAll && photos.length > 1 && currentPhoto && (
                  <span style={{ marginLeft: 6, color: 'var(--muted)' }}>
                    — photo {currentIndex + 1} of {photos.length}
                  </span>
                )}
              </div>
              {photos.length > 1 && (
                <label className="posts-apply-all">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => toggleApplyToAll(e.target.checked)}
                  />
                  Apply to all + number
                </label>
              )}
            </div>
            <textarea
              className="posts-caption"
              value={applyToAll ? baseCaption : (currentPhoto?.caption || '')}
              onChange={(e) => updateCaption(e.target.value)}
              placeholder={activeBusiness ? `Caption for ${activeBusiness.name}…` : 'Write a caption…'}
              rows={5}
              disabled={!currentPhoto}
            />
            {applyToAll && baseCaption && (
              <div className="tip" style={{ color: 'var(--muted)' }}>
                Exports as: "{baseCaption} 1", "{baseCaption} 2"…
              </div>
            )}
          </div>

          <div className="posts-field">
            <div className="posts-field-label">Export folder name</div>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Spring Promo"
            />
          </div>

          <div className="posts-field">
            <div className="posts-field-label">Save to</div>
            <div className="folder-row" onClick={() => api.pickFolder().then((d) => d && setOutputDir(d))}>
              <span className="folder-icon">📁</span>
              <span className={`folder-path${outputDir ? ' set' : ''}`}>
                {outputDir ? `${outputDir}/${folderName || '<folder name>'}` : 'Click to choose…'}
              </span>
            </div>
          </div>

          <div className="posts-export-row">
            <button className="btn-sm" disabled={!canExport || !currentPhoto} onClick={() => exportPhotos([currentPhoto])}>
              ⬇ Export Current
            </button>
            <button className="btn btn-accent" disabled={!canExport} onClick={() => exportPhotos(photos)}>
              ⬇ Export All ({photos.length})
            </button>
          </div>

          {status.msg && (
            <div className={`tip${status.type === 'error' ? '' : ' success'}`}>
              {status.msg}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
