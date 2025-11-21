import React, { useEffect, useState, useRef } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  TimeScale,
  Tooltip,
  Legend
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import './PriceChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  TimeScale,
  Tooltip,
  Legend
);

const PriceChart = ({ historicalData, period, onPeriodChange, theme, quote, ticker, startDate, endDate, interval }) => {
  const [liveData, setLiveData] = useState([]);
  const [showVolume, setShowVolume] = useState(true);
  const [showStochRSI, setShowStochRSI] = useState(false);
  const [stochRSIData, setStochRSIData] = useState({ k: [], d: [] });
  const [loadingStochRSI, setLoadingStochRSI] = useState(false);
  const chartRef = useRef(null);

  // Update live data when quote changes
  useEffect(() => {
    if (!historicalData || historicalData.length === 0) {
      setLiveData([]);
      return;
    }

    if (!quote || (!quote.price && !quote.current_price && !quote.last_price)) {
      setLiveData(historicalData);
      return;
    }

    const currentPrice = quote.price ?? quote.current_price ?? quote.last_price;
    const dataWithLive = [...historicalData];
    const lastHistorical = dataWithLive[dataWithLive.length - 1];
    
    // Always update for live data
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastDataDate = new Date(lastHistorical.Date);
    lastDataDate.setHours(0, 0, 0, 0);
    
    // Track high/low for intraday updates
    const existingLivePoint = dataWithLive[dataWithLive.length - 1];
    const currentHigh = lastDataDate.getTime() === today.getTime() 
      ? Math.max(currentPrice, existingLivePoint.High || currentPrice, existingLivePoint.Open || currentPrice)
      : Math.max(currentPrice, lastHistorical.Close);
    const currentLow = lastDataDate.getTime() === today.getTime()
      ? Math.min(currentPrice, existingLivePoint.Low || currentPrice, existingLivePoint.Open || currentPrice)  
      : Math.min(currentPrice, lastHistorical.Close);
    
    // Update or append live data point
    const livePoint = {
      Date: now.toISOString(),
      Close: currentPrice,
      Open: lastHistorical.Close,
      High: currentHigh,
      Low: currentLow,
      Volume: quote.volume ?? quote.day_volume ?? lastHistorical.Volume ?? 0
    };
    
    // If last data point is from today, replace it with live data
    if (lastDataDate.getTime() === today.getTime()) {
      dataWithLive[dataWithLive.length - 1] = livePoint;
    } else {
      // Otherwise append new live point
      dataWithLive.push(livePoint);
    }
    
    setLiveData(dataWithLive);
    
    // Force chart update
    if (chartRef.current) {
      chartRef.current.update('none'); // Update without animation for smooth live updates
    }
  }, [quote]);

  // Fetch Stochastic RSI from backend
  useEffect(() => {
    const fetchStochRSI = async () => {
      if (!showStochRSI || !ticker || !startDate || !endDate) {
        return;
      }
      
      setLoadingStochRSI(true);
      try {
        // Stoch RSI needs minimum 34 data points (14+14+3+3)
        // For short periods, extend start date to get enough data
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        
        // If period is less than 60 days, extend it to get enough data for calculation
        let adjustedStartDate = startDate;
        if (daysDiff < 60) {
          const extendedStart = new Date(end);
          extendedStart.setDate(extendedStart.getDate() - 90); // Get 90 days of data
          adjustedStartDate = extendedStart.toISOString().split('T')[0];
        }
        
        const response = await fetch('http://localhost:8000/api/indicators/stochrsi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker,
            start_date: adjustedStartDate,
            end_date: endDate,
            interval: interval || '1d'
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.data && result.data.length > 0) {
            const kValues = result.data.map(d => d.k);
            const dValues = result.data.map(d => d.d);
            setStochRSIData({ k: kValues, d: dValues });
          } else {
            setStochRSIData({ k: [], d: [] });
          }
        } else {
          console.error('Failed to fetch Stoch RSI');
          setStochRSIData({ k: [], d: [] });
        }
      } catch (error) {
        console.error('Error fetching Stoch RSI:', error);
        setStochRSIData({ k: [], d: [] });
      } finally {
        setLoadingStochRSI(false);
      }
    };
    
    fetchStochRSI();
  }, [showStochRSI, ticker, startDate, endDate, interval]);

  const displayData = liveData.length > 0 ? liveData : historicalData;

  if (!displayData || displayData.length === 0) {
    return <div className="chart-placeholder">Loading chart...</div>;
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Calculate if price is up or down
  const firstPrice = displayData[0]?.Close;
  const lastPrice = displayData[displayData.length - 1]?.Close;
  const isPositive = lastPrice >= firstPrice;

  const chartData = {
    labels: displayData.map(d => d.Date),
    datasets: [{
      label: 'Price',
      data: displayData.map(d => d.Close),
      borderColor: isPositive 
        ? (theme === 'dark' ? '#10b981' : '#059669')
        : (theme === 'dark' ? '#ef4444' : '#dc2626'),
      backgroundColor: function(context) {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        if (!chartArea) return null;
        
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        if (isPositive) {
          gradient.addColorStop(0, theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(5, 150, 105, 0.2)');
          gradient.addColorStop(1, theme === 'dark' ? 'rgba(16, 185, 129, 0)' : 'rgba(5, 150, 105, 0)');
        } else {
          gradient.addColorStop(0, theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.2)');
          gradient.addColorStop(1, theme === 'dark' ? 'rgba(239, 68, 68, 0)' : 'rgba(220, 38, 38, 0)');
        }
        return gradient;
      },
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: isPositive ? '#10b981' : '#ef4444',
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 2,
      tension: 0.4,
      fill: true
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: theme === 'dark' ? '#fff' : '#000',
        bodyColor: theme === 'dark' ? '#fff' : '#000',
        borderColor: theme === 'dark' ? '#444' : '#ddd',
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: {
          title: function(context) {
            if (!context || !context[0] || !context[0].parsed) return 'N/A';
            // Chart.js time scale gives us parsed.x as timestamp
            const timestamp = context[0].parsed.x;
            if (!timestamp) return 'N/A';
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return 'Invalid Date';
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            if (period === '1D') {
              return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} ${hours}:${minutes}`;
            }
            return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          },
          label: function(context) {
            if (!context || context.parsed.y === null || context.parsed.y === undefined) return 'N/A';
            const price = context.parsed.y;
            return 'Price: ' + new Intl.NumberFormat('id-ID', { 
              style: 'currency', 
              currency: 'IDR', 
              maximumFractionDigits: 0 
            }).format(price);
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: period === '1D' ? 'hour' : 'day',
          displayFormats: {
            hour: 'HH:mm',
            day: 'MMM d'
          }
        },
        grid: {
          display: false
        },
        ticks: {
          color: theme === 'dark' ? '#888' : '#666',
          maxRotation: 0,
          autoSkipPadding: 20,
          font: {
            size: 10
          }
        }
      },
      y: {
        position: 'right',
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          drawBorder: false
        },
        ticks: {
          color: theme === 'dark' ? '#888' : '#666',
          font: {
            size: 10
          },
          callback: function(value) {
            return value.toFixed(0);
          }
        }
      }
    }
  };

  const periods = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', '10Y', 'MAX'];

  // Volume chart data
  const volumeData = {
    labels: displayData.map(d => d.Date),
    datasets: [{
      label: 'Volume',
      data: displayData.map(d => d.Volume || 0),
      backgroundColor: displayData.map((d, i) => {
        if (i === 0) return 'rgba(59, 130, 246, 0.5)';
        return d.Close >= displayData[i - 1].Close
          ? 'rgba(16, 185, 129, 0.5)'
          : 'rgba(239, 68, 68, 0.5)';
      }),
      borderWidth: 0
    }]
  };

  const volumeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: (context) => `Volume: ${context.parsed.y.toLocaleString()}`
        }
      }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        position: 'right',
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false
        },
        ticks: {
          color: '#888',
          font: { size: 9 },
          callback: (value) => {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value;
          }
        }
      }
    }
  };

  // Stoch RSI chart data
  const stochRSIChartData = {
    labels: displayData.slice(displayData.length - stochRSIData.k.length).map(d => d.Date),
    datasets: [
      {
        label: 'Stoch RSI K',
        data: stochRSIData.k,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4
      },
      {
        label: 'Stoch RSI D',
        data: stochRSIData.d.length > 0 ? [...Array(stochRSIData.k.length - stochRSIData.d.length).fill(null), ...stochRSIData.d] : [],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4
      }
    ]
  };

  const stochRSIOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff'
      }
    },
    scales: {
      x: { display: false },
      y: {
        position: 'right',
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false
        },
        ticks: {
          color: '#888',
          font: { size: 9 }
        }
      }
    }
  };

  return (
    <div className="price-chart">
      <div className="chart-header">
        <div className="period-selector">
          {periods.map(p => (
            <button
              key={p}
              className={`period-btn ${period === p ? 'active' : ''}`}
              onClick={() => onPeriodChange(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="chart-indicators">
          <button
            className={`indicator-btn ${showVolume ? 'active' : ''}`}
            onClick={() => setShowVolume(!showVolume)}
            title="Toggle Volume"
          >
            Volume
          </button>
          <button
            className={`indicator-btn ${showStochRSI ? 'active' : ''}`}
            onClick={() => setShowStochRSI(!showStochRSI)}
            title="Toggle Stochastic RSI"
          >
            Stoch RSI
          </button>
        </div>
      </div>
      <div className="chart-container">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
      {showVolume && (
        <div className="volume-chart-container">
          <Bar data={volumeData} options={volumeOptions} />
        </div>
      )}
      {showStochRSI && (
        <div className="stochrsi-chart-container">
          {loadingStochRSI ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
              Loading Stoch RSI...
            </div>
          ) : stochRSIData.k.length > 0 ? (
            <Line data={stochRSIChartData} options={stochRSIOptions} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
              No Stoch RSI data available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PriceChart;
