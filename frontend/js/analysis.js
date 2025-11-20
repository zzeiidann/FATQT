// Analysis Manager
let currentAnalysis = null;

async function loadAnalysis(ticker) {
    try {
        // Show loading states
        showLoading('seasonal');
        showLoading('patterns');
        showLoading('volatility');

        // Fetch analysis
        const analysis = await stockAPI.getAnalysis(ticker);
        currentAnalysis = analysis;

        // Render each tab
        renderSeasonalAnalysis(analysis.seasonal_analysis);
        renderPatternAnalysis(analysis.pattern_analysis);
        renderVolatilityAnalysis(analysis.volatility_analysis);

        // Hide loading states
        hideLoading('seasonal');
        hideLoading('patterns');
        hideLoading('volatility');

    } catch (error) {
        console.error('Error loading analysis:', error);
        showError('Failed to load analysis. Please try again.');
    }
}

function showLoading(tab) {
    const loading = document.getElementById(`${tab}-loading`);
    const content = document.getElementById(`${tab}-content`);
    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';
}

function hideLoading(tab) {
    const loading = document.getElementById(`${tab}-loading`);
    const content = document.getElementById(`${tab}-content`);
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';
}

function renderSeasonalAnalysis(data) {
    // Monthly patterns
    const monthlyDiv = document.getElementById('monthly-patterns');
    if (monthlyDiv && data.monthly) {
        const monthly = data.monthly;
        let html = `
            <div class="stat-row">
                <span class="stat-label">Best Month</span>
                <span class="stat-value positive">${monthly.best_month.name} (${(monthly.best_month.avg_return * 100).toFixed(2)}%)</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Worst Month</span>
                <span class="stat-value negative">${monthly.worst_month.name} (${(monthly.worst_month.avg_return * 100).toFixed(2)}%)</span>
            </div>
        `;
        
        // Top 3 months by win rate
        const sortedMonths = Object.entries(monthly.win_rates)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        
        html += '<div class="stat-row"><span class="stat-label" style="font-weight: 600; margin-top: 10px;">Top Win Rates:</span></div>';
        sortedMonths.forEach(([month, rate]) => {
            const monthName = new Date(2024, month - 1).toLocaleDateString('en-US', { month: 'long' });
            html += `
                <div class="stat-row">
                    <span class="stat-label">${monthName}</span>
                    <span class="stat-value">${rate}%</span>
                </div>
            `;
        });
        
        monthlyDiv.innerHTML = html;
    }

    // Weekly patterns
    const weeklyDiv = document.getElementById('weekly-patterns');
    if (weeklyDiv && data.weekly) {
        const weekly = data.weekly;
        let html = `
            <div class="stat-row">
                <span class="stat-label">Best Day</span>
                <span class="stat-value positive">${weekly.best_day.day} (${(weekly.best_day.avg_return * 100).toFixed(2)}%)</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Worst Day</span>
                <span class="stat-value negative">${weekly.worst_day.day} (${(weekly.worst_day.avg_return * 100).toFixed(2)}%)</span>
            </div>
        `;
        
        html += '<div class="stat-row"><span class="stat-label" style="font-weight: 600; margin-top: 10px;">Daily Win Rates:</span></div>';
        Object.entries(weekly.win_rates).forEach(([day, rate]) => {
            html += `
                <div class="stat-row">
                    <span class="stat-label">${day}</span>
                    <span class="stat-value">${rate}%</span>
                </div>
            `;
        });
        
        weeklyDiv.innerHTML = html;
    }

    // Quarterly patterns
    const quarterlyDiv = document.getElementById('quarterly-patterns');
    if (quarterlyDiv && data.quarterly) {
        const quarterly = data.quarterly;
        let html = `
            <div class="stat-row">
                <span class="stat-label">Best Quarter</span>
                <span class="stat-value positive">${quarterly.best_quarter.quarter} (${(quarterly.best_quarter.avg_return * 100).toFixed(2)}%)</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Worst Quarter</span>
                <span class="stat-value negative">${quarterly.worst_quarter.quarter} (${(quarterly.worst_quarter.avg_return * 100).toFixed(2)}%)</span>
            </div>
        `;
        
        html += '<div class="stat-row"><span class="stat-label" style="font-weight: 600; margin-top: 10px;">Quarterly Win Rates:</span></div>';
        Object.entries(quarterly.win_rates).forEach(([q, rate]) => {
            html += `
                <div class="stat-row">
                    <span class="stat-label">${q}</span>
                    <span class="stat-value">${rate}%</span>
                </div>
            `;
        });
        
        quarterlyDiv.innerHTML = html;
    }

    // Yearly analysis
    const yearlyDiv = document.getElementById('yearly-patterns');
    if (yearlyDiv && data.yearly) {
        const yearly = data.yearly;
        let html = `
            <div class="stat-row">
                <span class="stat-label">Total Years Analyzed</span>
                <span class="stat-value">${yearly.total_years}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Avg Annual Return</span>
                <span class="stat-value ${yearly.avg_annual_return >= 0 ? 'positive' : 'negative'}">${yearly.avg_annual_return}%</span>
            </div>
        `;
        
        html += '<div class="stat-row"><span class="stat-label" style="font-weight: 600; margin-top: 10px;">Annual Returns:</span></div>';
        const sortedYears = Object.entries(yearly.annual_returns).sort((a, b) => b[0] - a[0]).slice(0, 5);
        sortedYears.forEach(([year, ret]) => {
            html += `
                <div class="stat-row">
                    <span class="stat-label">${year}</span>
                    <span class="stat-value ${ret >= 0 ? 'positive' : 'negative'}">${ret}%</span>
                </div>
            `;
        });
        
        yearlyDiv.innerHTML = html;
    }
}

function renderPatternAnalysis(data) {
    // Day patterns
    const dayDiv = document.getElementById('day-patterns');
    if (dayDiv && data.day_patterns) {
        let html = '';
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        days.forEach(day => {
            const pattern = data.day_patterns[day];
            if (pattern) {
                const tendency = pattern.tendency;
                const tendencyClass = tendency === 'Up' ? 'positive' : tendency === 'Down' ? 'negative' : '';
                html += `
                    <div class="stat-row">
                        <span class="stat-label">${day}</span>
                        <span class="stat-value ${tendencyClass}">${tendency} (${pattern.up_percentage}%)</span>
                    </div>
                `;
            }
        });
        dayDiv.innerHTML = html;
    }

    // Hourly patterns (if available)
    const hourlyDiv = document.getElementById('hourly-patterns');
    if (hourlyDiv && data.hourly_patterns) {
        const patterns = Object.entries(data.hourly_patterns).slice(0, 8);
        let html = '';
        patterns.forEach(([hour, pattern]) => {
            const tendency = pattern.tendency;
            const tendencyClass = tendency === 'Up' ? 'positive' : tendency === 'Down' ? 'negative' : '';
            html += `
                <div class="stat-row">
                    <span class="stat-label">${hour}</span>
                    <span class="stat-value ${tendencyClass}">${tendency} (${pattern.up_percentage}%)</span>
                </div>
            `;
        });
        hourlyDiv.innerHTML = html || '<p style="color: var(--text-secondary); padding: 10px;">No hourly data available (requires intraday data)</p>';
    }

    // Best times
    const bestDiv = document.getElementById('best-times');
    if (bestDiv && data.best_worst_times) {
        let html = '<div class="stat-row"><span class="stat-label" style="font-weight: 600;">Best Times:</span></div>';
        data.best_worst_times.best_times.slice(0, 3).forEach(time => {
            html += `
                <div class="stat-row">
                    <span class="stat-label">${time.day} ${time.hour}</span>
                    <span class="stat-value positive">${(time.avg_return * 100).toFixed(3)}%</span>
                </div>
            `;
        });
        
        html += '<div class="stat-row"><span class="stat-label" style="font-weight: 600; margin-top: 10px;">Worst Times:</span></div>';
        data.best_worst_times.worst_times.slice(0, 3).forEach(time => {
            html += `
                <div class="stat-row">
                    <span class="stat-label">${time.day} ${time.hour}</span>
                    <span class="stat-value negative">${(time.avg_return * 100).toFixed(3)}%</span>
                </div>
            `;
        });
        
        bestDiv.innerHTML = html;
    }

    // Consecutive patterns
    const consecutiveDiv = document.getElementById('consecutive-patterns');
    if (consecutiveDiv && data.consecutive_patterns) {
        const cp = data.consecutive_patterns;
        let html = `
            <div class="stat-row">
                <span class="stat-label">Max Consecutive Up</span>
                <span class="stat-value positive">${cp.max_consecutive_up_days} days</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Max Consecutive Down</span>
                <span class="stat-value negative">${cp.max_consecutive_down_days} days</span>
            </div>
        `;
        
        if (cp.reversal_probabilities) {
            html += '<div class="stat-row"><span class="stat-label" style="font-weight: 600; margin-top: 10px;">Reversal Probabilities:</span></div>';
            const probs = Object.entries(cp.reversal_probabilities).slice(0, 4);
            probs.forEach(([key, value]) => {
                const label = key.replace(/_/g, ' ').replace('consecutive', '');
                const prob = value.continues_up || value.reverses_up || 0;
                html += `
                    <div class="stat-row">
                        <span class="stat-label">${label}</span>
                        <span class="stat-value">${prob}%</span>
                    </div>
                `;
            });
        }
        
        consecutiveDiv.innerHTML = html;
    }
}

function renderVolatilityAnalysis(data) {
    // STD Returns
    const stdReturnsDiv = document.getElementById('std-returns');
    if (stdReturnsDiv && data.std_metrics && data.std_metrics.std_returns) {
        const stdReturns = data.std_metrics.std_returns;
        let html = '';
        Object.entries(stdReturns).forEach(([period, values]) => {
            html += `
                <div class="stat-row">
                    <span class="stat-label">${period} STD</span>
                    <span class="stat-value">${(values.current * 100).toFixed(3)}%</span>
                </div>
            `;
        });
        stdReturnsDiv.innerHTML = html;
    }

    // STD Volume
    const stdVolumeDiv = document.getElementById('std-volume');
    if (stdVolumeDiv && data.std_metrics && data.std_metrics.std_volume) {
        const stdVolume = data.std_metrics.std_volume;
        let html = '';
        Object.entries(stdVolume).forEach(([period, values]) => {
            html += `
                <div class="stat-row">
                    <span class="stat-label">${period} STD</span>
                    <span class="stat-value">${formatNumber(values.current)}</span>
                </div>
            `;
        });
        stdVolumeDiv.innerHTML = html;
    }

    // Volatility Regime
    const regimeDiv = document.getElementById('volatility-regime');
    if (regimeDiv && data.volatility_regime) {
        const regime = data.volatility_regime;
        const regimeColor = regime.regime === 'High' ? 'negative' : regime.regime === 'Low' ? 'positive' : '';
        let html = `
            <div class="stat-row">
                <span class="stat-label">Current Regime</span>
                <span class="stat-value ${regimeColor}">${regime.regime}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Current Volatility</span>
                <span class="stat-value">${(regime.current_volatility * 100).toFixed(2)}%</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Percentile</span>
                <span class="stat-value">${regime.volatility_percentile.toFixed(1)}%</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Avg Volatility</span>
                <span class="stat-value">${(regime.avg_volatility * 100).toFixed(2)}%</span>
            </div>
        `;
        regimeDiv.innerHTML = html;
    }

    // Bollinger Bands
    const bbDiv = document.getElementById('bollinger-bands');
    if (bbDiv && data.bollinger_bands) {
        const bb = data.bollinger_bands;
        let html = `
            <div class="stat-row">
                <span class="stat-label">Upper Band</span>
                <span class="stat-value">${formatNumber(bb.upper_band)}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Middle Band</span>
                <span class="stat-value">${formatNumber(bb.middle_band)}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Lower Band</span>
                <span class="stat-value">${formatNumber(bb.lower_band)}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">BB Position</span>
                <span class="stat-value">${bb.bb_position.toFixed(1)}%</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Band Width</span>
                <span class="stat-value">${formatNumber(bb.band_width)}</span>
            </div>
        `;
        bbDiv.innerHTML = html;
    }
}

function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

function showError(message) {
    alert(message);
}
