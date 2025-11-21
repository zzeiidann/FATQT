const API_BASE_URL = 'http://localhost:8000';

class StockAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.ws = null;
  }

  async getRealtimeQuote(ticker) {
    const response = await fetch(`${this.baseURL}/api/realtime/${ticker}`);
    if (!response.ok) throw new Error('Failed to fetch quote');
    return await response.json();
  }

  async getHistoricalData(ticker, startDate, endDate, interval = '1d') {
    const response = await fetch(`${this.baseURL}/api/historical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, start_date: startDate, end_date: endDate, interval }),
    });
    if (!response.ok) throw new Error('Failed to fetch historical data');
    return await response.json();
  }

  async getAnalysis(ticker) {
    const response = await fetch(`${this.baseURL}/api/analysis/${ticker}`);
    if (!response.ok) throw new Error('Failed to fetch analysis');
    return await response.json();
  }

  async getTickers() {
    const response = await fetch(`${this.baseURL}/api/tickers`);
    if (!response.ok) throw new Error('Failed to fetch tickers');
    return await response.json();
  }

  connectWebSocket(ticker, onMessage) {
    if (this.ws) this.ws.close();
    
    const wsURL = this.baseURL.replace('http', 'ws');
    this.ws = new WebSocket(`${wsURL}/ws/realtime/${ticker}`);
    
    this.ws.onopen = () => console.log('WebSocket connected');
    this.ws.onmessage = (event) => onMessage(JSON.parse(event.data));
    this.ws.onerror = (error) => console.error('WebSocket error:', error);
    this.ws.onclose = () => console.log('WebSocket disconnected');
    
    return this.ws;
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const stockAPI = new StockAPI();

export function isIDXMarketOpen() {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const day = jakartaTime.getDay();
  const hours = jakartaTime.getHours();
  const minutes = jakartaTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  if (day === 0 || day === 6) return false;
  
  if (day >= 1 && day <= 4) {
    const sesi1Start = 9 * 60;
    const sesi1End = 12 * 60;
    const sesi2Start = 13 * 60 + 30;
    const sesi2End = 16 * 60 + 15;
    return (timeInMinutes >= sesi1Start && timeInMinutes <= sesi1End) ||
           (timeInMinutes >= sesi2Start && timeInMinutes <= sesi2End);
  }
  
  if (day === 5) {
    const sesi1Start = 9 * 60;
    const sesi1End = 11 * 60 + 30;
    const sesi2Start = 14 * 60;
    const sesi2End = 16 * 60 + 15;
    return (timeInMinutes >= sesi1Start && timeInMinutes <= sesi1End) ||
           (timeInMinutes >= sesi2Start && timeInMinutes <= sesi2End);
  }
  
  return false;
}
