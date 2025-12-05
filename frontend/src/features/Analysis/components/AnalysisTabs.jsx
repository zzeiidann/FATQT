import { useState } from 'react';

const tabs = [
  { 
    id: 'shareholders', 
    label: 'Shareholders',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
    description: 'Extract shareholder data from IDX financial reports'
  },
  { 
    id: 'financials', 
    label: 'Financials',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    ),
    description: 'Financial ratios & analysis',
    disabled: true
  },
  { 
    id: 'ownership', 
    label: 'Ownership',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
      </svg>
    ),
    description: 'Institutional ownership tracking',
    disabled: true
  },
  { 
    id: 'insiders', 
    label: 'Insiders',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <line x1="19" y1="8" x2="19" y2="14"></line>
        <line x1="22" y1="11" x2="16" y2="11"></line>
      </svg>
    ),
    description: 'Insider transactions & holdings',
    disabled: true
  }
];

function AnalysisTabs({ activeTab, onTabChange }) {
  return (
    <div className="analysis-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`analysis-tab ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          disabled={tab.disabled}
          title={tab.disabled ? 'Coming soon' : tab.description}
        >
          {tab.icon}
          <span className="tab-label">{tab.label}</span>
          {tab.disabled && <span className="tab-badge">Soon</span>}
        </button>
      ))}
    </div>
  );
}

export default AnalysisTabs;
export { tabs };
