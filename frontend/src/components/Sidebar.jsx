import React from 'react';

const Sidebar = ({ activeView, onViewChange, isCollapsed, onToggle }) => {
  const menuItems = [
    { id: 'trading', label: 'Trading' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'news', label: 'News' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <h1 className="logo">
            FATQT
            <span className="logo-subtitle">Trading Platform</span>
          </h1>
        )}
        <button className="collapse-btn" onClick={onToggle}>
          {isCollapsed ? '›' : '‹'}
        </button>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
            title={item.label}
          >
            <span className="nav-label">{isCollapsed ? item.label.charAt(0) : item.label}</span>
          </button>
        ))}
      </nav>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">U</div>
            <div className="user-details">
              <div className="user-name">User</div>
              <div className="user-status">Premium</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
