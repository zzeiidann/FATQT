import { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TradingPage from './features/Trading/TradingPage';
import PortfolioPage from './features/Portfolio/PortfolioPage';
import WatchlistPage from './features/Watchlist/WatchlistPage';
import AnalysisPage from './features/Analysis/AnalysisPage';
import NewsPage from './features/News/NewsPage';
import { stockAPI as api, isIDXMarketOpen } from './services/api';
import './styles/globals.css';

function App() {
  const theme = 'dark';
  const [activeView, setActiveView] = useState('trading');
  const [currentTicker, setCurrentTicker] = useState('');
  const [tickers, setTickers] = useState([]);
  const [quote, setQuote] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [period, setPeriod] = useState('1M');
  const [loading, setLoading] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved !== null ? saved === 'true' : false;
    } catch (error) {
      return false;
    }
  });

  const handleSidebarToggle = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    try {
      localStorage.setItem('sidebarCollapsed', String(newState));
    } catch (error) {
      console.error('Failed to save sidebar state:', error);
    }
  };

  useEffect(() => {
    loadTickers();
    
    // Check market status every minute
    const checkMarket = () => setMarketOpen(isIDXMarketOpen());
    checkMarket();
    const intervalId = setInterval(checkMarket, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  const loadTickers = async () => {
    try {
      const data = await api.getTickers();
      setTickers(data.tickers || []);
    } catch (error) {
      console.error('Error loading tickers:', error);
    }
  };

  const renderActivePage = () => {
    switch(activeView) {
      case 'trading':
        return <TradingPage tickers={tickers} marketOpen={marketOpen} />;
      case 'portfolio':
        return <PortfolioPage />;
      case 'watchlist':
        return <WatchlistPage />;
      case 'analysis':
        return <AnalysisPage />;
      case 'news':
        return <NewsPage />;
      case 'settings':
        return (
          <div className="page-container">
            <div className="page-header">
              <h1 className="page-title">Settings</h1>
            </div>
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6"></path>
                  <path d="M17 4.22l-4.24 4.24m0 7.08l4.24 4.24"></path>
                  <path d="M20.78 7l-4.24 4.24m-7.08 0L5.22 7"></path>
                  <path d="M23 12h-6m-6 0H1"></path>
                  <path d="M20.78 17l-4.24-4.24m-7.08 0L5.22 17"></path>
                  <path d="M17 19.78l-4.24-4.24m0-7.08L17 4.22"></path>
                </svg>
              </div>
              <h2 className="empty-title">Settings Panel</h2>
              <p className="empty-description">Configure your trading preferences and account settings.</p>
            </div>
          </div>
        );
      default:
        return <TradingPage tickers={tickers} marketOpen={marketOpen} />;
    }
  };

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView}
        isCollapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
      />
      
      <div className="main-content">
        <Header marketOpen={marketOpen} activeView={activeView} />
        <div className="content-wrapper">
          {renderActivePage()}
        </div>
      </div>
    </div>
  );
}

export default App;
