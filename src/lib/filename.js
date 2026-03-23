function buildFilename(kw, loc, ext) {
  const k = kw.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const l = loc.replace(/,\s*/g, '-').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  return `${k}-${l}${ext}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function getExt(name) {
  const m = name.match(/(\.[^.]+)$/);
  return m ? m[1].toLowerCase() : '';
}

if (typeof module !== 'undefined') {
  module.exports = { buildFilename, getExt };
}
