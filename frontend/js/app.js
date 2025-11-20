// Main Application
let currentTicker = null;
let ws = null;
let refreshInterval = null;

// IDX Market Hours (WIB - UTC+7)
function isIDXMarketOpen() {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const day = jakartaTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday
    const hours = jakartaTime.getHours();
    const minutes = jakartaTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    // Weekend check (Saturday = 6, Sunday = 0)
    if (day === 0 || day === 6) {
        return false;
    }
    
    // Senin-Kamis: Sesi 1 (09:00-12:00), Sesi 2 (13:30-16:15)
    if (day >= 1 && day <= 4) {
        const sesi1Start = 9 * 60; // 09:00
        const sesi1End = 12 * 60; // 12:00
        const sesi2Start = 13 * 60 + 30; // 13:30
        const sesi2End = 16 * 60 + 15; // 16:15
        
        return (timeInMinutes >= sesi1Start && timeInMinutes <= sesi1End) ||
               (timeInMinutes >= sesi2Start && timeInMinutes <= sesi2End);
    }
    
    // Jumat: Sesi 1 (09:00-11:30), Sesi 2 (14:00-16:15)
    if (day === 5) {
        const sesi1Start = 9 * 60; // 09:00
        const sesi1End = 11 * 60 + 30; // 11:30
        const sesi2Start = 14 * 60; // 14:00
        const sesi2End = 16 * 60 + 15; // 16:15
        
        return (timeInMinutes >= sesi1Start && timeInMinutes <= sesi1End) ||
               (timeInMinutes >= sesi2Start && timeInMinutes <= sesi2End);
    }
    
    return false;
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    loadTickers();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', toggleTheme);

    // Ticker selector
    const tickerSelect = document.getElementById('ticker-select');
    tickerSelect.addEventListener('change', (e) => {
        const ticker = e.target.value;
        if (ticker) {
            selectTicker(ticker);
        }
    });

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', () => {
        if (currentTicker) {
            loadStockData(currentTicker);
        }
    });

    // Tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Time period buttons
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const period = btn.dataset.period;
            selectTimePeriod(period, btn);
        });
    });
}

// Theme toggle
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.querySelector('.theme-icon');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        themeIcon.textContent = '☀';
    } else {
        body.classList.add('dark-theme');
        themeIcon.textContent = '☾';
    }
    
    // Update chart theme
    updateChartTheme();
}

// Load tickers
async function loadTickers() {
    try {
        console.log('Loading tickers...');
        const data = await stockAPI.getTickers();
        console.log('Tickers loaded:', data);
        
        const select = document.getElementById('ticker-select');
        
        // Group by category
        const grouped = {};
        data.tickers.forEach(ticker => {
            if (!grouped[ticker.category]) {
                grouped[ticker.category] = [];
            }
            grouped[ticker.category].push(ticker);
        });

        // Add options by category
        Object.keys(grouped).sort().forEach(category => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;
            
            grouped[category].forEach(ticker => {
                const option = document.createElement('option');
                option.value = ticker.symbol;
                option.textContent = `${ticker.symbol} - ${ticker.name}`;
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        });

        console.log('Ticker dropdown populated');

        // Select IHSG by default
        select.value = '^JKSE';
        selectTicker('^JKSE');

    } catch (error) {
        console.error('Error loading tickers:', error);
        alert('Failed to load tickers. Make sure backend is running on http://localhost:8000');
    }
}

// Select ticker
async function selectTicker(ticker) {
    currentTicker = ticker;
    
    // Disconnect existing WebSocket
    if (ws) {
        stockAPI.disconnectWebSocket();
    }
    
    // Update market status indicator
    updateMarketStatusIndicator(ticker);
    
    // Load stock data
    await loadStockData(ticker);
    
    // Start live updates
    startLiveUpdates(ticker);
}

// Update market status indicator
function updateMarketStatusIndicator(ticker) {
    const isIDXTicker = ticker.endsWith('.JK') || ticker === '^JKSE';
    const statusEl = document.getElementById('market-status');
    const statusText = document.getElementById('market-status-text');
    
    if (!isIDXTicker) {
        statusEl.className = 'live-indicator open';
        statusText.textContent = 'LIVE';
        return;
    }
    
    if (isIDXMarketOpen()) {
        statusEl.className = 'live-indicator open';
        statusText.textContent = 'PASAR BUKA';
    } else {
        statusEl.className = 'live-indicator closed';
        statusText.textContent = 'PASAR TUTUP';
    }
    
    // Update status every minute
    setInterval(() => {
        if (isIDXTicker) {
            if (isIDXMarketOpen()) {
                statusEl.className = 'live-indicator open';
                statusText.textContent = 'PASAR BUKA';
            } else {
                statusEl.className = 'live-indicator closed';
                statusText.textContent = 'PASAR TUTUP';
            }
        }
    }, 60000);
}

// Load stock data
async function loadStockData(ticker, period = '1D') {
    try {
        // Get ticker info
        const tickerInfo = Array.from(document.querySelectorAll('#ticker-select option'))
            .find(opt => opt.value === ticker);
        
        // Update UI
        document.getElementById('ticker-name').textContent = tickerInfo ? tickerInfo.textContent.split(' - ')[1] : ticker;
        document.getElementById('ticker-symbol').textContent = ticker;

        // Get real-time quote
        const quote = await stockAPI.getRealtimeQuote(ticker);
        updatePriceCard(quote);

        // Calculate date range based on period
        const { startDate, endDate, interval } = getDateRangeForPeriod(period);

        const historical = await stockAPI.getHistoricalData(
            ticker,
            startDate,
            endDate,
            interval
        );
        
        updateChart(historical, quote.price);

        // Load analysis
        await loadAnalysis(ticker);

    } catch (error) {
        console.error('Error loading stock data:', error);
        alert('Failed to load stock data. Please try again.');
    }
}

// Get date range for time period
function getDateRangeForPeriod(period) {
    const endDate = new Date();
    const startDate = new Date();
    let interval = '1d';

    switch(period) {
        case '1D':
            startDate.setDate(startDate.getDate() - 1);
            interval = '5m';
            break;
        case '1W':
            startDate.setDate(startDate.getDate() - 7);
            interval = '15m';
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
    }

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        interval
    };
}

// Select time period
function selectTimePeriod(period, btn) {
    // Update active button
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Reload data with new period
    if (currentTicker) {
        loadStockData(currentTicker, period);
    }
}

// Start live updates via WebSocket
function startLiveUpdates(ticker) {
    // Check if it's an IDX ticker
    const isIDXTicker = ticker.endsWith('.JK') || ticker === '^JKSE';
    
    console.log('Starting WebSocket for:', ticker);
    ws = stockAPI.connectWebSocket(ticker, (data) => {
        console.log('WebSocket data received:', data);
        
        // For IDX tickers, only update during market hours
        if (isIDXTicker && !isIDXMarketOpen()) {
            console.log('IDX market is closed. Skipping update.');
            return;
        }
        
        if (data.type === 'quote' && data.data) {
            updatePriceCard(data.data);
            // Add live price to chart only if market is open
            if (data.data.price && (!isIDXTicker || isIDXMarketOpen())) {
                addLiveDataPoint(data.data.price);
            }
        }
    });
}

// Update price card
function updatePriceCard(quote) {
    if (quote.error) {
        console.error('Quote error:', quote.error);
        return;
    }

    // Update price
    const priceValue = document.getElementById('price-value');
    priceValue.textContent = formatPriceDisplay(quote.price);

    // Update change
    const priceChange = document.getElementById('price-change');
    const changeValue = document.getElementById('change-value');
    const changePercent = document.getElementById('change-percent');
    
    const isPositive = quote.change >= 0;
    priceChange.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
    
    changeValue.textContent = (isPositive ? '+' : '') + formatPriceDisplay(quote.change);
    changePercent.textContent = `(${(isPositive ? '+' : '')}${quote.change_percent.toFixed(2)}%)`;

    // Update details
    document.getElementById('open-value').textContent = formatPriceDisplay(quote.open);
    document.getElementById('high-value').textContent = formatPriceDisplay(quote.high);
    document.getElementById('low-value').textContent = formatPriceDisplay(quote.low);
    document.getElementById('volume-value').textContent = formatVolume(quote.volume);
}

// Format price display
function formatPriceDisplay(value) {
    if (value === null || value === undefined) return '-';
    
    if (value >= 1000) {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    return value.toFixed(2);
}

// Format volume
function formatVolume(volume) {
    if (volume === null || volume === undefined || volume === 0) return '-';
    
    if (volume >= 1000000000) {
        return (volume / 1000000000).toFixed(2) + 'B';
    } else if (volume >= 1000000) {
        return (volume / 1000000).toFixed(2) + 'M';
    } else if (volume >= 1000) {
        return (volume / 1000).toFixed(2) + 'K';
    }
    return volume.toLocaleString();
}

// Switch tabs
function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}
