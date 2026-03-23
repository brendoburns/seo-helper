import React, { useState, useEffect } from 'react';

const api = window.electronAPI;

export default function PostsView() {
  const [businesses, setBusinesses] = useState([]);
  const [activeBusiness, setActiveBusiness] = useState(null);

  useEffect(() => {
    api.loadBusinesses().then((biz) => {
      setBusinesses(biz);
      setActiveBusiness(biz.find((b) => b.isActive) || biz[0] || null);
    });
  }, []);

  async function switchBusiness(id) {
    await api.setActiveBusiness(Number(id));
    const biz = await api.loadBusinesses();
    setBusinesses(biz);
    setActiveBusiness(biz.find((b) => b.isActive) || null);
  }

  return (
    <div className="posts-view">

      {/* Business switcher bar */}
      <div className="posts-topbar">
        <div className="posts-topbar-label">Business</div>
        {businesses.length > 0 ? (
          <select
            className="biz-switcher"
            value={activeBusiness?.id ?? ''}
            onChange={(e) => switchBusiness(e.target.value)}
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : (
          <span className="posts-topbar-hint">Add a business in Settings ⚙</span>
        )}
      </div>

      {/* Placeholder */}
      <div className="posts-placeholder">
        <div className="posts-placeholder-icon">📱</div>
        <div className="posts-placeholder-title">Social Post Planner</div>
        <div className="posts-placeholder-sub">
          {activeBusiness
            ? `Building posts for ${activeBusiness.name} — coming soon.`
            : 'Add a business in Settings to get started.'
          }
        </div>
      </div>

    </div>
  );
}
