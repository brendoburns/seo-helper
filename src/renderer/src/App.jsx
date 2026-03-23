import React, { useState } from 'react';
import RenameView from './views/RenameView';
import PostsView from './views/PostsView';
import SettingsView from './views/SettingsView';

const VIEWS = ['Rename', 'Posts'];

export default function App() {
  const [activeView, setActiveView] = useState('Rename');
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="layout">
      <div className="titlebar">
        <div className="titlebar-title">
          SEO<span>HELPER</span>
        </div>
        <div className="titlebar-tabs">
          {VIEWS.map((v) => (
            <button
              key={v}
              className={`tab-btn${activeView === v ? ' active' : ''}`}
              onClick={() => setActiveView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="titlebar-actions">
          <button
            className={`gear-btn${showSettings ? ' active' : ''}`}
            onClick={() => setShowSettings((v) => !v)}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {activeView === 'Rename' ? <RenameView /> : <PostsView />}

      {showSettings && <SettingsView onClose={() => setShowSettings(false)} />}
    </div>
  );
}
