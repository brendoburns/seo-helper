const api = window.electronAPI;

// ── State ──────────────────────────────────────────────────────
let photos = []; // [{file, keywords, objectURL, checked}]
let currentIndex = 0;
let outputDir = null;
const locations = [];

// ── DOM ────────────────────────────────────────────────────────
const fileInput     = document.getElementById('fileInput');
const folderInput   = document.getElementById('folderInput');
const loadZone      = document.getElementById('loadZone');
const viewer        = document.getElementById('viewer');
const viewerImg     = document.getElementById('viewerImg');
const navCounter    = document.getElementById('navCounter');
const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');
const addMoreBtn    = document.getElementById('addMoreBtn');
const clearBtn      = document.getElementById('clearBtn');
const keywords      = document.getElementById('keywords');
const kwHint        = document.getElementById('kwHint');
const filmstrip     = document.getElementById('filmstrip');
const locInput      = document.getElementById('locInput');
const addLocBtn     = document.getElementById('addLocBtn');
const locList       = document.getElementById('locationsList');
const folderRow     = document.getElementById('folderRow');
const folderPath    = document.getElementById('folderPath');
const previewList   = document.getElementById('previewList');
const emptyState    = document.getElementById('emptyState');
const outputCount   = document.getElementById('outputCount');
const exportCurrentBtn = document.getElementById('exportCurrentBtn');
const exportBtn     = document.getElementById('exportBtn');
const progressWrap  = document.getElementById('progressWrap');
const progressBar   = document.getElementById('progressBar');
const status        = document.getElementById('status');
const openLink      = document.getElementById('openLink');
const pickFilesBtn  = document.getElementById('pickFilesBtn');
const pickFolderBtn = document.getElementById('pickFolderBtn');

// ── Load photos ────────────────────────────────────────────────
pickFilesBtn.addEventListener('click', () => fileInput.click());
pickFolderBtn.addEventListener('click', () => folderInput.click());
addMoreBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => addFiles(e.target.files));
folderInput.addEventListener('change', (e) => addFiles(e.target.files));

// Drag & drop on load zone
loadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  loadZone.classList.add('dragover');
});
loadZone.addEventListener('dragleave', () => loadZone.classList.remove('dragover'));
loadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  loadZone.classList.remove('dragover');
  addFiles(e.dataTransfer.files);
});

// Also allow dropping onto the viewer to add more
viewer.addEventListener('dragover', (e) => e.preventDefault());
viewer.addEventListener('drop', (e) => {
  e.preventDefault();
  addFiles(e.dataTransfer.files);
});

function addFiles(fileList) {
  const imgs = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) return;

  const newPhotos = imgs.map((file) => ({ file, keywords: '', objectURL: URL.createObjectURL(file), checked: false }));
  const isFirst = photos.length === 0;
  photos.push(...newPhotos);

  if (isFirst) {
    currentIndex = 0;
    showViewer();
  }

  renderFilmstrip();
  goTo(isFirst ? 0 : currentIndex);
  // Reset file inputs so the same file can be picked again
  fileInput.value = '';
  folderInput.value = '';
}

function showViewer() {
  loadZone.classList.add('is-hidden');
  viewer.classList.remove('is-hidden');
}

// ── Clear all ──────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  photos.forEach((p) => URL.revokeObjectURL(p.objectURL));
  photos = [];
  currentIndex = 0;
  filmstrip.innerHTML = '';
  viewerImg.src = '';
  keywords.value = '';
  viewer.classList.add('is-hidden');
  loadZone.classList.remove('is-hidden');
  updatePreview();
  updateExportBtn();
});

// ── Navigation ─────────────────────────────────────────────────
prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

document.addEventListener('keydown', (e) => {
  if (document.activeElement === keywords || document.activeElement === locInput) return;
  if (e.key === 'ArrowLeft')  goTo(currentIndex - 1);
  if (e.key === 'ArrowRight') goTo(currentIndex + 1);
});

function goTo(index) {
  if (!photos.length) return;
  currentIndex = Math.max(0, Math.min(index, photos.length - 1));
  const photo = photos[currentIndex];

  viewerImg.src = photo.objectURL;
  keywords.value = photo.keywords;
  navCounter.textContent = `${currentIndex + 1} / ${photos.length}`;
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === photos.length - 1;
  updateFilmstripHighlight();
  scrollFilmstripTo(currentIndex);
  updatePreview();
  updateKwHint();
}

// ── Keywords ───────────────────────────────────────────────────
keywords.addEventListener('input', () => {
  if (!photos.length) return;
  const photo = photos[currentIndex];
  const hadKw = !!photo.keywords.trim();
  photo.keywords = keywords.value;
  const hasKw = !!photo.keywords.trim();
  // auto-check when keywords first set, auto-uncheck when cleared
  if (hasKw && !hadKw) photo.checked = true;
  if (!hasKw) photo.checked = false;
  updateFilmstripThumb(currentIndex);
  updatePreview();
  updateExportBtn();
  updateKwHint();
});

keywords.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && currentIndex < photos.length - 1) goTo(currentIndex + 1);
});

function updateKwHint() {
  if (!photos.length) { kwHint.textContent = ''; return; }
  const withKw = photos.filter((p) => p.keywords.trim()).length;
  kwHint.textContent = withKw === photos.length
    ? `✓ all ${photos.length} done`
    : `${withKw} / ${photos.length} set`;
}

// ── Filmstrip ──────────────────────────────────────────────────
function renderFilmstrip() {
  filmstrip.innerHTML = '';
  photos.forEach((photo, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'filmstrip-thumb';
    if (photo.keywords.trim()) thumb.classList.add('has-kw');
    if (photo.checked) thumb.classList.add('checked');

    const img = document.createElement('img');
    img.src = photo.objectURL;
    img.alt = '';

    const check = document.createElement('div');
    check.className = 'thumb-check';
    check.textContent = '✓';
    check.title = photo.checked ? 'Uncheck' : 'Check';
    check.addEventListener('click', (e) => {
      e.stopPropagation(); // don't navigate
      if (!photos[i].keywords.trim()) return; // can't check without keywords
      photos[i].checked = !photos[i].checked;
      updateFilmstripThumb(i);
      updateExportBtn();
    });

    thumb.append(img, check);
    thumb.addEventListener('click', () => goTo(i));
    filmstrip.appendChild(thumb);
  });
  updateFilmstripHighlight();
}

function updateFilmstripHighlight() {
  filmstrip.querySelectorAll('.filmstrip-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === currentIndex);
  });
}

function updateFilmstripThumb(index) {
  const thumb = filmstrip.children[index];
  if (!thumb) return;
  const photo = photos[index];
  const hasKw = !!photo.keywords.trim();
  thumb.classList.toggle('has-kw', hasKw);
  thumb.classList.toggle('checked', photo.checked);
  const check = thumb.querySelector('.thumb-check');
  if (check) check.title = photo.checked ? 'Uncheck' : 'Check';
}

function scrollFilmstripTo(index) {
  const thumb = filmstrip.children[index];
  if (thumb) thumb.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
}

// ── Output folder ──────────────────────────────────────────────
folderRow.addEventListener('click', async () => {
  const dir = await api.pickFolder();
  if (dir) {
    outputDir = dir;
    folderPath.textContent = dir;
    folderPath.classList.add('set');
  }
});

api.getDownloads().then((dl) => {
  if (!outputDir) {
    outputDir = dl;
    folderPath.textContent = dl;
    folderPath.classList.add('set');
  }
});

// ── Locations ──────────────────────────────────────────────────
addLocBtn.addEventListener('click', addLoc);
locInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addLoc(); });

function addLoc() {
  const v = locInput.value.trim();
  if (!v) return;
  locations.push(v);
  locInput.value = '';
  renderLocations();
  updatePreview();
  updateExportBtn();
  api.saveLocations([...locations]);
}

function removeLoc(index) {
  locations.splice(index, 1);
  renderLocations();
  updatePreview();
  updateExportBtn();
  api.saveLocations([...locations]);
}

function renderLocations() {
  locList.innerHTML = '';
  locations.forEach((loc, i) => {
    const el = document.createElement('div');
    el.className = 'loc-item';

    const dot = document.createElement('span');
    dot.className = 'loc-dot';

    const text = document.createElement('span');
    text.className = 'loc-text';
    text.textContent = loc;

    const btn = document.createElement('button');
    btn.className = 'loc-remove';
    btn.textContent = '✕';
    btn.setAttribute('aria-label', `Remove ${loc}`);
    btn.addEventListener('click', () => removeLoc(i));

    el.append(dot, text, btn);
    locList.appendChild(el);
  });
}

// ── Preview (current photo) ────────────────────────────────────
function updatePreview() {
  previewList.querySelectorAll('.output-item').forEach((el) => el.remove());
  outputCount.textContent = '';

  const photo = photos[currentIndex];
  const kw = photo ? photo.keywords.trim() : '';

  if (!kw || !locations.length) {
    emptyState.classList.remove('is-hidden');
    return;
  }
  emptyState.classList.add('is-hidden');

  const ext = getExt(photo.file.name);
  locations.forEach((loc) => {
    const el = document.createElement('div');
    el.className = 'output-item';
    el.textContent = buildFilename(kw, loc, ext);
    previewList.appendChild(el);
  });

  const countEl = document.createElement('span');
  countEl.textContent = String(locations.length);
  outputCount.replaceChildren(countEl, document.createTextNode(` file${locations.length !== 1 ? 's' : ''}`));
}

function updateExportBtn() {
  const photo = photos[currentIndex];
  const currentHasKw = photo && !!photo.keywords.trim();
  const checkedCount = photos.filter((p) => p.checked).length;

  exportCurrentBtn.disabled = !currentHasKw || !locations.length;

  exportBtn.disabled = !checkedCount || !locations.length;
  exportBtn.textContent = checkedCount
    ? `⬇ Export Selected (${checkedCount})`
    : '⬇ Export Selected';
}

// ── Export helpers ─────────────────────────────────────────────
async function runExport(toExport) {
  if (!toExport.length || !locations.length) return;

  exportCurrentBtn.disabled = true;
  exportBtn.disabled = true;
  progressWrap.classList.add('visible');
  progressBar.style.width = '0%';
  status.className = 'status visible';
  status.textContent = `Exporting ${toExport.length} photo${toExport.length !== 1 ? 's' : ''}…`;
  openLink.classList.remove('visible');

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
      progressBar.style.width = `${Math.round(((i + 1) / toExport.length) * 100)}%`;
    }

    status.className = 'status visible success';
    status.textContent = `✓ ${totalSaved} file${totalSaved !== 1 ? 's' : ''} saved`;
    openLink.classList.add('visible');
    openLink.onclick = () => api.openFolder(lastDir);
  } catch (err) {
    progressBar.style.width = '100%';
    status.className = 'status visible error';
    status.textContent = `✗ ${err.message}`;
  }

  setTimeout(() => {
    progressWrap.classList.remove('visible');
    progressBar.style.width = '0%';
    updateExportBtn();
  }, 1000);
}

exportCurrentBtn.addEventListener('click', () => {
  const photo = photos[currentIndex];
  if (photo && photo.keywords.trim()) runExport([photo]);
});

// ── Export Checked ─────────────────────────────────────────────
exportBtn.addEventListener('click', () => {
  runExport(photos.filter((p) => p.checked));
});

// ── Helpers ────────────────────────────────────────────────────
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// ── Init ───────────────────────────────────────────────────────
api.loadLocations().then((saved) => {
  if (saved.length > 0) {
    locations.push(...saved);
    renderLocations();
  }
});
