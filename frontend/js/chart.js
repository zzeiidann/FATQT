// Chart Manager
let priceChart = null;
let chartData = [];

function initChart() {
    const ctx = document.getElementById('price-chart');
    if (!ctx) return;

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Close Price',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                borderWidth: 1.5,
                tension: 0.3,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 8,
                    titleFont: { size: 11 },
                    bodyFont: { size: 11 },
                    callbacks: {
                        label: function(context) {
                            return 'Price: ' + formatPrice(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.03)',
                        drawBorder: false
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-secondary').trim(),
                        font: { size: 10 },
                        maxTicksLimit: 8
                    }
                },
                y: {
                    position: 'right',
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.03)',
                        drawBorder: false
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-secondary').trim(),
                        font: { size: 10 },
                        callback: function(value) {
                            return formatPrice(value);
                        }
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });
}

function updateChart(historicalData, currentPrice = null) {
    if (!priceChart || !historicalData || !historicalData.data) return;

    const data = historicalData.data;
    chartData = data;

    // Determine if data is intraday or daily based on interval
    const interval = historicalData.interval || '1d';
    const isIntraday = ['1m', '5m', '15m', '30m', '1h'].includes(interval);

    // Extract dates and close prices with appropriate formatting
    const labels = data.map(item => {
        const date = new Date(item.Date);
        if (isIntraday) {
            // For intraday: show time only
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else {
            // For daily: show date
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    });
    
    const prices = data.map(item => item.Close);

    // Determine if overall trend is up or down
    const firstPrice = prices[0];
    const lastPrice = currentPrice || prices[prices.length - 1];
    const isPositive = lastPrice >= firstPrice;

    // Update chart colors based on trend
    const color = isPositive ? '#059669' : '#dc2626';
    const bgColor = isPositive ? 'rgba(5, 150, 105, 0.05)' : 'rgba(220, 38, 38, 0.05)';

    priceChart.data.labels = labels;
    priceChart.data.datasets[0].data = prices;
    priceChart.data.datasets[0].borderColor = color;
    priceChart.data.datasets[0].backgroundColor = bgColor;
    
    priceChart.update('none');
}

function addLiveDataPoint(price) {
    if (!priceChart) return;
    
    // Add timestamp label
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    priceChart.data.labels.push(timeLabel);
    priceChart.data.datasets[0].data.push(price);
    
    // Keep only last 100 points to avoid memory bloat
    const maxPoints = 100;
    if (priceChart.data.labels.length > maxPoints) {
        priceChart.data.labels.shift();
        priceChart.data.datasets[0].data.shift();
    }
    
    // Update trend color dynamically
    const dataPoints = priceChart.data.datasets[0].data;
    if (dataPoints.length > 1) {
        const firstPrice = dataPoints[0];
        const lastPrice = dataPoints[dataPoints.length - 1];
        const isPositive = lastPrice >= firstPrice;
        const color = isPositive ? '#10b981' : '#ef4444';
        const bgColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        
        priceChart.data.datasets[0].borderColor = color;
        priceChart.data.datasets[0].backgroundColor = bgColor;
    }
    
    priceChart.update('none');
}

function updateChartTheme() {
    if (!priceChart) return;

    const isDark = document.body.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    const textColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-secondary').trim();

    priceChart.options.scales.x.grid.color = gridColor;
    priceChart.options.scales.y.grid.color = gridColor;
    priceChart.options.scales.x.ticks.color = textColor;
    priceChart.options.scales.y.ticks.color = textColor;

    priceChart.update('none');
}

function formatPrice(value) {
    if (value >= 1000) {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }
    return value.toFixed(2);
}
