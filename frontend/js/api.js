// API Client
const API_BASE_URL = 'http://localhost:8000';

class StockAPI {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.ws = null;
    }

    async getRealtimeQuote(ticker) {
        try {
            const response = await fetch(`${this.baseURL}/api/realtime/${ticker}`);
            if (!response.ok) throw new Error('Failed to fetch quote');
            return await response.json();
        } catch (error) {
            console.error('Error fetching quote:', error);
            throw error;
        }
    }

    async getHistoricalData(ticker, startDate, endDate, interval = '1d') {
        try {
            const response = await fetch(`${this.baseURL}/api/historical`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticker,
                    start_date: startDate,
                    end_date: endDate,
                    interval,
                }),
            });
            if (!response.ok) throw new Error('Failed to fetch historical data');
            return await response.json();
        } catch (error) {
            console.error('Error fetching historical data:', error);
            throw error;
        }
    }

    async getAnalysis(ticker, startDate = null, endDate = null) {
        try {
            let url = `${this.baseURL}/api/analysis/${ticker}`;
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            
            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch analysis');
            return await response.json();
        } catch (error) {
            console.error('Error fetching analysis:', error);
            throw error;
        }
    }

    async getTickers() {
        try {
            const response = await fetch(`${this.baseURL}/api/tickers`);
            if (!response.ok) throw new Error('Failed to fetch tickers');
            return await response.json();
        } catch (error) {
            console.error('Error fetching tickers:', error);
            throw error;
        }
    }

    connectWebSocket(ticker, onMessage) {
        const wsURL = this.baseURL.replace('http', 'ws');
        this.ws = new WebSocket(`${wsURL}/ws/realtime/${ticker}`);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
        };
        
        return this.ws;
    }

    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Export for use in other scripts
const stockAPI = new StockAPI();
