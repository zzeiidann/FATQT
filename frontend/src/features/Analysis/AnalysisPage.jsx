import { useState } from 'react';
import AnalysisTabs, { tabs } from './components/AnalysisTabs';
import ShareholderAnalysis from './components/ShareholderAnalysis';
import './Analysis.css';

function AnalysisPage() {
  const [activeTab, setActiveTab] = useState('shareholders');

  const currentTab = tabs.find(t => t.id === activeTab);

  return (
    <div className="analysis-page">
      {/* Header */}
      <div className="analysis-header">
        <div className="header-content">
          <h1 className="page-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            Analysis
          </h1>
          <p className="page-subtitle">{currentTab?.description}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <AnalysisTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="analysis-content">
        {activeTab === 'shareholders' && <ShareholderAnalysis />}
        
        {activeTab === 'financials' && (
          <div className="coming-soon">
            <div className="coming-soon-icon">💰</div>
            <h3>Financial Analysis</h3>
            <p>Revenue, profit margins, debt ratios, and more. Coming soon!</p>
          </div>
        )}
        
        {activeTab === 'ownership' && (
          <div className="coming-soon">
            <div className="coming-soon-icon">🏦</div>
            <h3>Ownership Analysis</h3>
            <p>Track institutional investors and ownership changes. Coming soon!</p>
          </div>
        )}
        
        {activeTab === 'insiders' && (
          <div className="coming-soon">
            <div className="coming-soon-icon">👤</div>
            <h3>Insider Activity</h3>
            <p>Monitor insider buying and selling patterns. Coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalysisPage;
