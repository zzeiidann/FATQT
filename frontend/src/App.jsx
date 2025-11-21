import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TickerSearch from './components/TickerSearch';
import PriceChart from './components/PriceChart';
import HeroStats from './components/HeroStats';
import OrderPanel from './components/OrderPanel';
import PositionsTable from './components/PositionsTable';
import { stockAPI as api, isIDXMarketOpen } from './services/api';
import './App.css';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    loadTickers();
    
    // Check market status every minute
    const checkMarket = () => setMarketOpen(isIDXMarketOpen());
    checkMarket();
    const intervalId = setInterval(checkMarket, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (currentTicker) {
      loadStockData();
    }
  }, [currentTicker]);

  useEffect(() => {
    if (currentTicker) {
      loadHistoricalData();
    }
  }, [currentTicker, period]);

  useEffect(() => {
    if (!currentTicker) return;
    
    console.log('Connecting WebSocket for:', currentTicker);
    api.connectWebSocket(currentTicker, (data) => {
      if (data.type === 'quote' && data.data) {
        setQuote(data.data);
      } else if (data.quote) {
        setQuote(data.quote);
      }
    });

    return () => {
      console.log('Disconnecting WebSocket');
      api.disconnectWebSocket();
    };
  }, [currentTicker]);

  const loadTickers = async () => {
    try {
      const data = await api.getTickers();
      setTickers(data.tickers || []);
      if (data.tickers && data.tickers.length > 0) {
        const ihsg = data.tickers.find(t => t.symbol === '^JKSE');
        setCurrentTicker(ihsg ? ihsg.symbol : data.tickers[0].symbol);
      }
    } catch (error) {
      console.error('Error loading tickers:', error);
    }
  };

  const loadStockData = async () => {
    if (!currentTicker) return;
    
    try {
      console.log('Loading stock data for:', currentTicker);
      const data = await api.getRealtimeQuote(currentTicker);
      setQuote(data);

    } catch (error) {
      console.error('Error loading stock data:', error);
    }
  };

  const loadHistoricalData = async () => {
    if (!currentTicker) return;
    
    setLoading(true);
    try {
      console.log('Loading historical data for:', currentTicker, period);
      const { startDate, endDate, interval } = getDateRange(period);
      const response = await api.getHistoricalData(currentTicker, startDate, endDate, interval);
      setHistoricalData(response.data || []);
    } catch (error) {
      console.error('Error loading historical data:', error);
      setHistoricalData([]);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (selectedPeriod) => {
    const endDate = new Date();
    const startDate = new Date();
    let interval = '1d';

    switch(selectedPeriod) {
      case '1D':
        startDate.setDate(startDate.getDate() - 5); // Get more days for context
        interval = '1d';
        break;
      case '1W':
        startDate.setDate(startDate.getDate() - 7);
        interval = '1d';
        break;
      case '1M':
        startDate.setMonth(startDate.getMonth() - 1);
        interval = '1d';
        break;
      case '3M':
        startDate.setMonth(startDate.getMonth() - 3);
        interval = '1d';
        break;
      case '6M':
        startDate.setMonth(startDate.getMonth() - 6);
        interval = '1d';
        break;
      case '1Y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        interval = '1d';
        break;
      case '5Y':
        startDate.setFullYear(startDate.getFullYear() - 5);
        interval = '1wk';
        break;
      case '10Y':
        startDate.setFullYear(startDate.getFullYear() - 10);
        interval = '1mo';
        break;
      case 'MAX':
        startDate.setFullYear(startDate.getFullYear() - 20); // 20 years as "max"
        interval = '1mo';
        break;
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      interval
    };
  };

  const handleTickerChange = (newTicker) => {
    setCurrentTicker(newTicker);
  };

  const positionsData = useMemo(() => {
    if (!tickers.length) return [];
    const roiTemplates = [8.34, -27.52, 23.28, 13.76, 11.01, -17.43, 3.67];
    const basePrice = quote?.price ?? quote?.current_price ?? quote?.last_price ?? 1000;

    return tickers
      .filter(t => t.symbol !== currentTicker)
      .slice(0, 5)
      .map((stock, idx) => {
        const entry = basePrice * (1 + idx * 0.005);
        const roi = roiTemplates[idx % roiTemplates.length];
        const exit = entry * (1 + roi / 100);
        const pnl = (exit - entry) / entry;
        return {
          id: stock.symbol,
          symbol: stock.symbol,
          currency: 'USDT',
          wager: 0.99 + idx * 0.5,
          entry,
          exit,
          multiplier: idx % 2 === 0 ? 50 : 10,
          pnl,
          roi,
        };
      });
  }, [tickers, quote, currentTicker]);

  const currentPrice = quote?.price ?? quote?.current_price ?? quote?.last_price;
  const currentInfo = tickers.find(t => t.symbol === currentTicker);

  return (
    <div className={`app ${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className="main-content">
        <Header />

        <div className="dashboard-grid">
          <div className="primary-column">
            <HeroStats 
              tickerInfo={currentInfo}
              quote={quote}
              marketOpen={marketOpen}
            />

            <div className="chart-card">
              <div className="chart-card-header">
                <p className="section-label">Price Performance</p>
              </div>
              <PriceChart 
                historicalData={historicalData}
                period={period}
                onPeriodChange={setPeriod}
                theme={theme}
                quote={quote}
                ticker={currentTicker}
                startDate={getDateRange(period).startDate}
                endDate={getDateRange(period).endDate}
                interval={getDateRange(period).interval}
              />
            </div>
          </div>

          <OrderPanel ticker={currentTicker} price={currentPrice} />
        </div>

        <PositionsTable rows={positionsData} />
      </div>
      
      <TickerSearch 
        tickers={tickers}
        currentTicker={currentTicker}
        onTickerChange={handleTickerChange}
        onRefresh={loadStockData}
      />
    </div>
  );
}

export default App;
