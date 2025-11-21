import React, { useState, useEffect } from 'react';
import '../styles/Header.css';

const Header = ({ marketOpen = false, activeView = 'trading' }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'dark';
  });

  // Dynamic header content based on active view
  const getHeaderContent = () => {
    switch(activeView) {
      case 'trading':
        return {
          title: 'Trading Terminal',
          subtitle: 'Real-time Market Analytics & Intelligence'
        };
      case 'analysis':
        return {
          title: 'Market Analysis',
          subtitle: 'Advanced Technical & Fundamental Analysis Tools'
        };
      case 'portfolio':
        return {
          title: 'Portfolio Manager',
          subtitle: 'Track Your Investments & Performance'
        };
      case 'watchlist':
        return {
          title: 'Watchlist',
          subtitle: 'Monitor Your Favorite Assets'
        };
      case 'news':
        return {
          title: 'Market News',
          subtitle: 'Latest Financial News & Updates'
        };
      case 'settings':
        return {
          title: 'Settings',
          subtitle: 'Customize Your Trading Experience'
        };
      default:
        return {
          title: 'Trading Terminal',
          subtitle: 'Real-time Market Analytics & Intelligence'
        };
    }
  };

  const headerContent = getHeaderContent();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('.app')?.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const tickerSegments = [
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      text: 'Developed by Mohammad Raffy Zeidan'
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
      ),
      text: '@raffyzeidan'
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
          <rect x="2" y="9" width="4" height="12"></rect>
          <circle cx="4" cy="4" r="2"></circle>
        </svg>
      ),
      text: 'Mohammad Raffy Zeidan'
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      ),
      text: 'raffy.zeidan@gmail.com'
    }
  ];

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div className="header-brand">
            <h1>{headerContent.title}</h1>
            <span className="header-subtitle">{headerContent.subtitle}</span>
          </div>
        </div>
        
        {/* Developer Ticker */}
        <div className="developer-ticker">
          <div className="ticker-track">
            {/* Repeat 3 times for seamless loop */}
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="ticker-segment-group">
                {tickerSegments.map((segment, segIdx) => (
                  <div key={segIdx} className="ticker-segment">
                    <span className="ticker-icon">{segment.icon}</span>
                    <span className="ticker-text">{segment.text}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Theme Toggle - Bottom Right */}
      <button 
        className="theme-toggle-floating" 
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </button>
    </>
  );
};

export default Header;
