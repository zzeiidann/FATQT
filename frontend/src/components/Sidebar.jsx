import React from 'react';
import '../styles/Sidebar.css';

const Sidebar = ({ activeView, onViewChange, isCollapsed, onToggle }) => {
  const mainSections = [
    { 
      id: 'trading', 
      label: 'Trading', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      )
    },
    { 
      id: 'portfolio', 
      label: 'Portfolio', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      )
    },
    { 
      id: 'watchlist', 
      label: 'Watchlist', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      )
    },
    { 
      id: 'analysis', 
      label: 'Analysis', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      )
    },
    { 
      id: 'news', 
      label: 'News', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
          <path d="M18 14h-8"></path>
          <path d="M15 18h-5"></path>
          <path d="M10 6h8v4h-8V6Z"></path>
        </svg>
      )
    },
  ];

  const utilityItems = [
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m-6-6H0m12 0h6m-3-9l-3 3m0 12l-3 3m12-12l-3-3m0 12l-3-3"></path>
        </svg>
      )
    },
  ];

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <h1 className="logo">
            FATQT
            <span className="logo-subtitle">FORM</span>
          </h1>
        )}
        <button className="collapse-btn" onClick={onToggle}>
          {isCollapsed ? '›' : '‹'}
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <div className="nav-section">
          {!isCollapsed && <div className="nav-section-label">Main</div>}
          {mainSections.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-section">
          {!isCollapsed && <div className="nav-section-label">Settings</div>}
          {utilityItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="user-section">
            <div className="user-avatar">U</div>
            <div className="user-info">
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
