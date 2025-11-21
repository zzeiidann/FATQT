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

const PriceChart = ({
  historicalData,
  period,
  onPeriodChange,
  interval,
  onIntervalChange,
  theme,
  quote,
  ticker,
  startDate,
  endDate
}) => {
  const [liveData, setLiveData] = useState([]);
  const [showVolume, setShowVolume] = useState(true);
  const [showStochRSI, setShowStochRSI] = useState(false);
  const [stochRSIData, setStochRSIData] = useState({ k: [], d: [] });
  const [loadingStochRSI, setLoadingStochRSI] = useState(false);
  const [intervalMenuOpen, setIntervalMenuOpen] = useState(false);
  const chartRef = useRef(null);
  const intervalMenuRef = useRef(null);

  // =========================
  // Close interval dropdown on outside click
  // =========================
  useEffect(() => {
    if (!intervalMenuOpen) return;

    const handleOutsideClick = (event) => {
      if (intervalMenuRef.current && !intervalMenuRef.current.contains(event.target)) {
        setIntervalMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [intervalMenuOpen]);

  // =========================
  // Inject live quote → hanya kalau last candle = hari ini
  // =========================
  useEffect(() => {
    console.log('[PriceChart] historicalData updated:', historicalData?.length, 'rows');

    if (!historicalData || historicalData.length === 0) {
      setLiveData([]);
      return;
    }

    // Kalau belum ada quote live, pakai historical apa adanya
    if (!quote || (!quote.price && !quote.current_price && !quote.last_price)) {
      setLiveData(historicalData);
      return;
    }

    const currentPrice = quote.price ?? quote.current_price ?? quote.last_price;
    const dataWithLive = [...historicalData];
    const lastHistorical = dataWithLive[dataWithLive.length - 1];

    const lastDate = new Date(lastHistorical.Date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastDay = new Date(lastDate);
    lastDay.setHours(0, 0, 0, 0);

    // Hanya utak-atik candle kalau datanya memang hari ini
    if (!Number.isNaN(lastDay.getTime()) && lastDay.getTime() === today.getTime()) {
      const existing = dataWithLive[dataWithLive.length - 1];

      const currentHigh = Math.max(
        currentPrice,
        existing.High ?? currentPrice,
        existing.Open ?? currentPrice
      );
      const currentLow = Math.min(
        currentPrice,
        existing.Low ?? currentPrice,
        existing.Open ?? currentPrice
      );

      const livePoint = {
        ...existing,
        Date: new Date().toISOString(),
        Close: currentPrice,
        High: currentHigh,
        Low: currentLow,
        Volume: quote.volume ?? quote.day_volume ?? existing.Volume ?? 0
      };

      dataWithLive[dataWithLive.length - 1] = livePoint;
    }

    setLiveData(dataWithLive);

    if (chartRef.current) {
      chartRef.current.update('none');
    }
  }, [quote, historicalData, ticker, period, interval]);

  // =========================
  // Fetch Stoch RSI dari backend
  // =========================
  useEffect(() => {
    const fetchStochRSI = async () => {
      if (!showStochRSI || !ticker || !startDate || !endDate) return;

      setLoadingStochRSI(true);
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));

        let adjustedStartDate = startDate;
        if (daysDiff < 60) {
          const extendedStart = new Date(end);
          extendedStart.setDate(extendedStart.getDate() - 90);
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
            const kValues = result.data.map((d) => d.k);
            const dValues = result.data.map((d) => d.d);
            setStochRSIData({ k: kValues, d: dValues });
          } else {
            setStochRSIData({ k: [], d: [] });
          }
        } else {
          console.error('Failed to fetch Stoch RSI');
          setStochRSIData({ k: [], d: [] });
        }
      } catch (err) {
        console.error('Error fetching Stoch RSI:', err);
        setStochRSIData({ k: [], d: [] });
      } finally {
        setLoadingStochRSI(false);
      }
    };

    fetchStochRSI();
  }, [showStochRSI, ticker, startDate, endDate, interval]);

  // =========================
  // Build displayData (apply 1D filter)
  // =========================
  // Pilih dulu sumber data utama
  let displayData = liveData.length > 0 ? liveData : historicalData;

  // Untuk 1D: tunjukkan HANYA satu hari kalender terakhir (last trading day),
  if (period === '1D' && displayData && displayData.length > 0) {
    const referenceData =
      historicalData && historicalData.length > 0 ? historicalData : displayData;

    const lastRef = referenceData[referenceData.length - 1];
    const refDate = new Date(lastRef.Date);

    if (!Number.isNaN(refDate.getTime())) {
      const refYear = refDate.getFullYear();
      const refMonth = refDate.getMonth();
      const refDay = refDate.getDate();

      displayData = displayData.filter((row) => {
        const dt = new Date(row.Date);
        return (
          !Number.isNaN(dt.getTime()) &&
          dt.getFullYear() === refYear &&
          dt.getMonth() === refMonth &&
          dt.getDate() === refDay
        );
      });
    }
  }

  // // 1D: kalau last tick udah “basi”, paksa perpanjang garis sampai jam sekarang
  // if (period === '1D' && displayData && displayData.length > 0) {
  //   const lastPoint = displayData[displayData.length - 1];
  //   const lastTs = Date.parse(lastPoint.Date);
  //   const nowTs = Date.now();

  //   // threshold: kalau data terakhir lebih tua dari 15 menit
  //   const FIFTEEN_MIN = 15 * 60 * 1000;

  //   if (!Number.isNaN(lastTs) && nowTs - lastTs > FIFTEEN_MIN) {
  //     const nowISO = new Date().toISOString();

  //     displayData = [
  //       ...displayData,
  //       {
  //         ...lastPoint,
  //         Date: nowISO,
  //         Volume: 0, // optional: biar kelihatan ini titik synthetic
  //       },
  //     ];
  //   }
  // }

  console.log(
    '[PriceChart] Render',
    'period:', period,
    'interval:', interval,
    'rows:', displayData.length
  );

  if (!displayData || displayData.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  // =========================
  // Chart data & options
  // =========================
  const firstPrice = displayData[0]?.Close;
  const lastPrice = displayData[displayData.length - 1]?.Close;
  const isPositive = lastPrice >= firstPrice;

  const chartData = {
    labels: displayData.map((d) => d.Date),
    datasets: [
      {
        label: 'Price',
        data: displayData.map((d) => d.Close),
        borderColor: isPositive
          ? (theme === 'dark' ? '#10b981' : '#059669')
          : (theme === 'dark' ? '#ef4444' : '#dc2626'),
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          if (isPositive) {
            gradient.addColorStop(
              0,
              theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(5, 150, 105, 0.2)'
            );
            gradient.addColorStop(
              1,
              theme === 'dark' ? 'rgba(16, 185, 129, 0)' : 'rgba(5, 150, 105, 0)'
            );
          } else {
            gradient.addColorStop(
              0,
              theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.2)'
            );
            gradient.addColorStop(
              1,
              theme === 'dark' ? 'rgba(239, 68, 68, 0)' : 'rgba(220, 38, 38, 0)'
            );
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
      }
    ]
  };

  const xTimeUnit =
    period === '1D'
      ? (['1m', '2m', '3m', '5m', '15m', '30m', '60m', '1h'].includes(interval)
          ? 'minute'
          : 'hour')
      : 'day';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: theme === 'dark' ? '#fff' : '#000',
        bodyColor: theme === 'dark' ? '#fff' : '#000',
        borderColor: theme === 'dark' ? '#444' : '#ddd',
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: {
          title: (ctx) => {
            if (!ctx || !ctx[0] || !ctx[0].parsed) return 'N/A';
            const ts = ctx[0].parsed.x;
            if (!ts) return 'N/A';
            const date = new Date(ts);
            if (Number.isNaN(date.getTime())) return 'Invalid Date';
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const h = date.getHours().toString().padStart(2, '0');
            const m = date.getMinutes().toString().padStart(2, '0');
            if (period === '1D') {
              return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} ${h}:${m}`;
            }
            return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          },
          label: (ctx) => {
            if (!ctx || ctx.parsed.y == null) return 'N/A';
            const price = ctx.parsed.y;
            return (
              'Price: ' +
              new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
              }).format(price)
            );
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: xTimeUnit,
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MMM d'
          }
        },
        grid: { display: false },
        ticks: {
          color: theme === 'dark' ? '#888' : '#666',
          maxRotation: 0,
          autoSkipPadding: 20,
          font: { size: 10 }
        }
      },
      y: {
        position: 'right',
        grid: {
          color:
            theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          drawBorder: false
        },
        ticks: {
          color: theme === 'dark' ? '#888' : '#666',
          font: { size: 10 },
          callback: (v) => Number(v).toFixed(0)
        }
      }
    }
  };

  const periods = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', '10Y', 'MAX'];

  // =========================
  // Volume chart
  // =========================
  const volumeData = {
    labels: displayData.map((d) => d.Date),
    datasets: [
      {
        label: 'Volume',
        data: displayData.map((d) => d.Volume || 0),
        backgroundColor: displayData.map((d, i) => {
          if (i === 0) return 'rgba(59, 130, 246, 0.5)';
          return d.Close >= displayData[i - 1].Close
            ? 'rgba(16, 185, 129, 0.5)'
            : 'rgba(239, 68, 68, 0.5)';
        }),
        borderWidth: 0
      }
    ]
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
          label: (ctx) => `Volume: ${ctx.parsed.y.toLocaleString()}`
        }
      }
    },
    scales: {
      x: { display: false },
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
            if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
            if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
            return value;
          }
        }
      }
    }
  };

  // =========================
  // Stoch RSI chart
  // =========================
  const stochRSIChartData = {
    labels: displayData
      .slice(displayData.length - stochRSIData.k.length)
      .map((d) => d.Date),
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
        data:
          stochRSIData.d.length > 0
            ? [
                ...Array(stochRSIData.k.length - stochRSIData.d.length).fill(null),
                ...stochRSIData.d
              ]
            : [],
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

  // =========================
  // Interval options per period
  // =========================
  const getIntervalOptions = () => {
    if (period === '1D') {
      return ['1m', '2m', '5m', '15m', '30m', '60m'];
    }
    if (period === '1W') {
      return ['1m', '2m', '5m', '15m', '30m', '60m', '1d'];
    }
    if (period === '1M') {
      return ['5m', '15m', '30m', '60m', '1d'];
    }
    return [];
  };

  const intervalOptions = getIntervalOptions();
  const showIntervalSelector = intervalOptions.length > 0;

  const formatIntervalLabel = (int) => {
    switch (int) {
      case '1m': return '1 min';
      case '2m': return '2 mins';
      case '3m': return '3 mins';
      case '5m': return '5 mins';
      case '15m': return '15 mins';
      case '30m': return '30 mins';
      case '60m':
      case '1h': return '1 hour';
      case '1d': return '1 day';
      default: return int;
    }
  };

  return (
    <div className="price-chart">
      <div className="chart-header">
        <div className="period-selector">
          {periods.map((p) => (
            <button
              key={p}
              className={`period-btn ${period === p ? 'active' : ''}`}
              onClick={() => onPeriodChange(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {showIntervalSelector && (
          <div className="interval-selector" ref={intervalMenuRef}>
            <label>Interval:</label>
            <div className={`interval-dropdown-wrapper ${intervalMenuOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="interval-dropdown-button"
                onClick={() => setIntervalMenuOpen((open) => !open)}
              >
                <span>{formatIntervalLabel(interval)}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 8L2 4h8z" fill="currentColor" />
                </svg>
              </button>
              {intervalMenuOpen && (
                <div className="interval-dropdown-menu">
                  {intervalOptions.map((int) => (
                    <button
                      key={int}
                      type="button"
                      className={`interval-dropdown-option ${interval === int ? 'active' : ''}`}
                      onClick={() => {
                        onIntervalChange(int);
                        setIntervalMenuOpen(false);
                      }}
                    >
                      {formatIntervalLabel(int)}
                      {interval === int && <span className="interval-check">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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
            <div className="stochrsi-loading">Loading Stoch RSI...</div>
          ) : stochRSIData.k.length > 0 ? (
            <Line data={stochRSIChartData} options={stochRSIOptions} />
          ) : (
            <div className="stochrsi-empty">No Stoch RSI data available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default PriceChart;
