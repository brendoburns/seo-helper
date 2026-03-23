import React, { useState, useEffect } from 'react';

const api = window.electronAPI;

const BUSINESS_TYPES = [
  'Dumpster Rental',
  'Junk Removal',
  'Moving Services',
  'Landscaping',
  'Roofing',
  'Plumbing',
  'HVAC',
  'General Contractor',
  'Other',
];

const TONES = ['Professional', 'Friendly', 'Casual', 'Bold'];

const DEFAULT_SETTINGS = {
  businessName: '',
  businessType: 'Dumpster Rental',
  phone: '',
  website: '',
  tone: 'Friendly',
  geminiKey: '',
};

export default function SettingsView({ onClose }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    api.loadSettings().then((s) => {
      setSettings((prev) => ({ ...prev, ...s }));
    });
  }, []);

  function set(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    await api.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>

        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">

          {/* Business */}
          <div className="settings-section">
            <div className="settings-section-label">Business</div>

            <div className="settings-field">
              <label>Business Name</label>
              <input
                type="text"
                value={settings.businessName}
                onChange={(e) => set('businessName', e.target.value)}
                placeholder="e.g. Smith's Dumpster Rental"
              />
            </div>

            <div className="settings-field">
              <label>Business Type</label>
              <select
                value={settings.businessType}
                onChange={(e) => set('businessType', e.target.value)}
              >
                {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="settings-row">
              <div className="settings-field">
                <label>Phone</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="e.g. (555) 123-4567"
                />
              </div>
              <div className="settings-field">
                <label>Website</label>
                <input
                  type="text"
                  value={settings.website}
                  onChange={(e) => set('website', e.target.value)}
                  placeholder="e.g. smithsdumpsters.com"
                />
              </div>
            </div>
          </div>

          {/* AI */}
          <div className="settings-section">
            <div className="settings-section-label">AI Content Generation</div>

            <div className="settings-field">
              <label>
                Gemini API Key
                <span className="settings-label-hint">
                  — free at <em>aistudio.google.com</em>
                </span>
              </label>
              <div className="settings-key-row">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.geminiKey}
                  onChange={(e) => set('geminiKey', e.target.value)}
                  placeholder="AIza..."
                />
                <button className="btn-sm" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              {settings.geminiKey
                ? <div className="settings-hint success">✓ AI features enabled</div>
                : <div className="settings-hint">Without a key, template-based captions are used.</div>
              }
            </div>

            <div className="settings-field">
              <label>Caption Tone</label>
              <div className="settings-tone-row">
                {TONES.map((t) => (
                  <button
                    key={t}
                    className={`tone-btn${settings.tone === t ? ' active' : ''}`}
                    onClick={() => set('tone', t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        <div className="settings-footer">
          <button className="btn btn-accent" onClick={save}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
}
