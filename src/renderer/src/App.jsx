import React, { useState } from 'react';
import RenameView from './views/RenameView';
import PostsView from './views/PostsView';

const VIEWS = ['Rename', 'Posts'];

export default function App() {
  const [activeView, setActiveView] = useState('Rename');

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
      </div>
      {activeView === 'Rename' ? <RenameView /> : <PostsView />}
    </div>
  );
}
