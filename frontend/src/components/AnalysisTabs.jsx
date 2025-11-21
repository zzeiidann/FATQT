import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const AnalysisTabs = ({ analysis, theme }) => {
  const [activeTab, setActiveTab] = useState('seasonal');

  const tabs = [
    { id: 'seasonal', label: 'Seasonal' },
    { id: 'patterns', label: 'Patterns' },
    { id: 'volatility', label: 'Volatility' }
  ];

  const renderSeasonalChart = (data) => {
    if (!data || !data.monthly) {
      return <div className="analysis-placeholder">Loading seasonal data...</div>;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const returns = [];
    const winRates = [];

    try {
      for (let i = 1; i <= 12; i++) {
        returns.push((data.monthly.monthly_stats?.Returns?.mean?.[i] || 0) * 100);
        winRates.push(data.monthly.win_rates?.[i] || 0);
      }
    } catch (error) {
      console.error('Error processing seasonal data:', error);
      return <div className="analysis-placeholder">Error loading seasonal data</div>;
    }

    const chartData = {
      labels: monthNames,
      datasets: [
        {
          label: 'Avg Return (%)',
          data: returns,
          backgroundColor: theme === 'dark' ? 'rgba(74, 222, 128, 0.5)' : 'rgba(34, 197, 94, 0.5)',
          borderColor: theme === 'dark' ? '#4ade80' : '#22c55e',
          borderWidth: 1
        },
        {
          label: 'Win Rate (%)',
          data: winRates,
          backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(37, 99, 235, 0.5)',
          borderColor: theme === 'dark' ? '#3b82f6' : '#2563eb',
          borderWidth: 1
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          display: true, 
          position: 'top',
          labels: { color: theme === 'dark' ? '#e0e0e0' : '#1a1a1a', font: { size: 11 } }
        },
        title: {
          display: true,
          text: 'Monthly Performance Pattern',
          color: theme === 'dark' ? '#e0e0e0' : '#1a1a1a',
          font: { size: 13, weight: '600' }
        }
      },
      scales: {
        x: { 
          ticks: { color: theme === 'dark' ? '#888' : '#666', font: { size: 10 } },
          grid: { display: false }
        },
        y: { 
          ticks: { color: theme === 'dark' ? '#888' : '#666', font: { size: 10 } },
          grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
        }
      }
    };

    return (
      <div>
        <div style={{ height: '250px', marginBottom: '16px' }}>
          <Bar data={chartData} options={options} />
        </div>
        {data.monthly.best_month && data.monthly.worst_month && (
          <div className="analysis-summary">
            <div className="summary-item">
              <span className="summary-label">Best Month:</span>
              <span className="summary-value positive">
                {data.monthly.best_month.name} ({((data.monthly.best_month.avg_return || 0) * 100).toFixed(2)}%)
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Worst Month:</span>
              <span className="summary-value negative">
                {data.monthly.worst_month.name} ({((data.monthly.worst_month.avg_return || 0) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPatternsChart = (data) => {
    if (!data || data.error) {
      return <div className="analysis-placeholder">Pattern analysis data not available</div>;
    }

    return (
      <div className="analysis-content">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  };

  const renderVolatilityChart = (data) => {
    if (!data || data.error) {
      return <div className="analysis-placeholder">Volatility analysis data not available</div>;
    }

    return (
      <div className="analysis-content">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  };

  const renderContent = () => {
    if (!analysis) {
      return <div className="analysis-placeholder">Loading analysis...</div>;
    }

    switch(activeTab) {
      case 'seasonal':
        return renderSeasonalChart(analysis.seasonal);
      case 'patterns':
        return renderPatternsChart(analysis.patterns);
      case 'volatility':
        return renderVolatilityChart(analysis.volatility);
      default:
        return <div className="analysis-placeholder">No data available</div>;
    }
  };

  return (
    <div className="analysis-tabs">
      <div className="tabs-header">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default AnalysisTabs;
