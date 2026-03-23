import React, { useState, useEffect } from 'react';

const api = window.electronAPI;

const BUSINESS_TYPES = [
  'Dumpster Rental', 'Junk Removal', 'Moving Services', 'Landscaping',
  'Roofing', 'Plumbing', 'HVAC', 'General Contractor', 'Other',
];
const TONES = ['Professional', 'Friendly', 'Casual', 'Bold'];

const EMPTY_BUSINESS = { name: '', type: 'Dumpster Rental', phone: '', website: '', tone: 'Friendly' };

export default function SettingsView({ onClose }) {
  const [businesses, setBusinesses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_BUSINESS);
  const [isNew, setIsNew] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([api.loadBusinesses(), api.loadSettings()]).then(([biz, settings]) => {
      setBusinesses(biz);
      setGeminiKey(settings.geminiKey || '');
      const active = biz.find((b) => b.isActive) || biz[0];
      if (active) { setSelectedId(active.id); setForm(active); }
    });
  }, []);

  function selectBusiness(b) {
    setSelectedId(b.id);
    setForm({ ...b });
    setIsNew(false);
    setSaved(false);
  }

  function startNew() {
    setSelectedId(null);
    setForm({ ...EMPTY_BUSINESS });
    setIsNew(true);
    setSaved(false);
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function saveBusiness() {
    if (!form.name.trim()) return;
    const id = await api.saveBusiness({ ...form, id: isNew ? undefined : selectedId });
    if (isNew) await api.setActiveBusiness(id);
    const biz = await api.loadBusinesses();
    setBusinesses(biz);
    setSelectedId(id);
    setIsNew(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function setActive(id) {
    await api.setActiveBusiness(id);
    const biz = await api.loadBusinesses();
    setBusinesses(biz);
  }

  async function deleteBusiness(id) {
    if (businesses.length <= 1) return; // keep at least one
    await api.deleteBusiness(id);
    const biz = await api.loadBusinesses();
    setBusinesses(biz);
    const next = biz[0];
    if (next) { setSelectedId(next.id); setForm({ ...next }); }
  }

  async function saveGlobalSettings() {
    await api.saveSettings({ geminiKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const selected = isNew ? null : businesses.find((b) => b.id === selectedId);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>

        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">

          {/* ── AI ── */}
          <div className="settings-section">
            <div className="settings-section-label">AI Content Generation</div>
            <div className="settings-field">
              <label>
                Gemini API Key
                <span className="settings-label-hint"> — free at <em>aistudio.google.com</em></span>
              </label>
              <div className="settings-key-row">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => { setGeminiKey(e.target.value); setSaved(false); }}
                  placeholder="AIza..."
                />
                <button className="btn-sm" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? 'Hide' : 'Show'}
                </button>
                <button className="btn-sm" onClick={saveGlobalSettings}>Save</button>
              </div>
              {geminiKey
                ? <div className="settings-hint success">✓ AI features enabled</div>
                : <div className="settings-hint">Without a key, template-based captions are used.</div>
              }
            </div>
          </div>

          {/* ── Businesses ── */}
          <div className="settings-section">
            <div className="settings-section-label">Business Profiles</div>

            <div className="biz-layout">

              {/* List */}
              <div className="biz-list">
                {businesses.map((b) => (
                  <div
                    key={b.id}
                    className={`biz-item${b.id === selectedId && !isNew ? ' selected' : ''}`}
                    onClick={() => selectBusiness(b)}
                  >
                    <div className="biz-item-name">{b.name}</div>
                    <div className="biz-item-type">{b.type}</div>
                    {b.isActive && <span className="biz-active-badge">Active</span>}
                  </div>
                ))}
                <button className="biz-add-btn" onClick={startNew}>+ New Business</button>
              </div>

              {/* Form */}
              <div className="biz-form">
                <div className="settings-field">
                  <label>Business Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g. Smith's Dumpster Rental"
                  />
                </div>

                <div className="settings-field">
                  <label>Business Type</label>
                  <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
                    {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div className="settings-row">
                  <div className="settings-field">
                    <label>Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="settings-field">
                    <label>Website</label>
                    <input
                      type="text"
                      value={form.website}
                      onChange={(e) => setField('website', e.target.value)}
                      placeholder="smithsdumpsters.com"
                    />
                  </div>
                </div>

                <div className="settings-field">
                  <label>Caption Tone</label>
                  <div className="settings-tone-row">
                    {TONES.map((t) => (
                      <button
                        key={t}
                        className={`tone-btn${form.tone === t ? ' active' : ''}`}
                        onClick={() => setField('tone', t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="biz-form-actions">
                  {!isNew && selected && !selected.isActive && (
                    <button className="btn-sm" onClick={() => setActive(selectedId)}>
                      Set as Active
                    </button>
                  )}
                  {!isNew && businesses.length > 1 && (
                    <button className="btn-sm danger" onClick={() => deleteBusiness(selectedId)}>
                      Delete
                    </button>
                  )}
                  <button
                    className="btn btn-accent"
                    onClick={saveBusiness}
                    disabled={!form.name.trim()}
                  >
                    {saved ? '✓ Saved' : isNew ? 'Add Business' : 'Save Changes'}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
