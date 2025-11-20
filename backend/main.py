"""
FastAPI Backend Server
Provides REST API and WebSocket for stock analysis
"""

import sys
sys.path.append('/Users/mraffyzeidan/Learning/FATQT')

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio
import json
from datetime import datetime, timedelta
import pandas as pd

from scrapper import RealTimeScraper, download_fast
from analysis.seasonal import SeasonalAnalysis
from analysis.patterns import PatternAnalysis
from analysis.volatility import VolatilityAnalysis
from analysis.intraday import IntradayAnalysis

app = FastAPI(title="FATQT Stock Analysis API")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize scraper
scraper = RealTimeScraper()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()


# Request/Response Models
class TickerRequest(BaseModel):
    ticker: str

class HistoricalRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    interval: str = "1d"

class AnalysisRequest(BaseModel):
    ticker: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


# API Endpoints

@app.get("/")
async def root():
    return {
        "name": "FATQT Stock Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "realtime": "/api/realtime/{ticker}",
            "historical": "/api/historical",
            "analysis": "/api/analysis/{ticker}",
            "tickers": "/api/tickers",
            "websocket": "/ws/realtime/{ticker}"
        }
    }

@app.get("/api/realtime/{ticker}")
async def get_realtime_quote(ticker: str):
    """Get real-time quote for a ticker"""
    try:
        quote = scraper.get_realtime_quote(ticker)
        if quote['error']:
            raise HTTPException(status_code=404, detail=quote['error'])
        return quote
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/historical")
async def get_historical_data(request: HistoricalRequest):
    """Get historical price data"""
    try:
        data = download_fast(
            request.ticker,
            request.start_date,
            request.end_date,
            interval=request.interval
        )
        
        if data is None or len(data) == 0:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Convert to dict for JSON response
        # Normalize columns: if MultiIndex (returned for some tickers), flatten to simple names
        if isinstance(data.columns, pd.MultiIndex):
            # prefer the first level (e.g., ('Close','^JKSE') -> 'Close')
            data.columns = [c[0] if isinstance(c, (list, tuple)) and len(c) > 0 else c for c in data.columns]

        # Ensure Date is a column (reset index if necessary)
        if 'Date' not in data.columns and data.index is not None:
            data = data.reset_index()

        # Convert datetime to string for JSON serialization
        if 'Date' in data.columns:
            data['Date'] = data['Date'].astype(str)

        # Keep a stable column order if common columns exist
        preferred_cols = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
        existing = [c for c in preferred_cols if c in data.columns]
        # Append any other columns after preferred ones
        other = [c for c in data.columns if c not in existing]
        data = data[existing + other]

        data_dict = data.to_dict(orient='records')
        
        return {
            "ticker": request.ticker,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "interval": request.interval,
            "data": data_dict
        }
    except Exception as e:
        import traceback
        print(f"Error in historical endpoint: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analysis/{ticker}")
async def get_comprehensive_analysis(
    ticker: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get comprehensive quantitative analysis"""
    try:
        # Default to last 2 years if not specified
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        if not start_date:
            start_date = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')
        
        # Download historical data
        data = download_fast(ticker, start_date, end_date)
        
        if data is None or len(data) == 0:
            raise HTTPException(status_code=404, detail="No data found for analysis")
        
        # Perform all analyses
        seasonal = SeasonalAnalysis(data)
        patterns = PatternAnalysis(data)
        volatility = VolatilityAnalysis(data)
        
        # Note: Intraday analysis requires intraday data
        # For daily data, we skip intraday analysis
        
        result = {
            "ticker": ticker,
            "period": {
                "start": start_date,
                "end": end_date,
                "days": len(data)
            },
            "seasonal_analysis": seasonal.get_all_seasonal_analysis(),
            "pattern_analysis": patterns.get_all_pattern_analysis(),
            "volatility_analysis": volatility.get_all_volatility_analysis(),
            "generated_at": datetime.now().isoformat()
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tickers")
async def get_ticker_list():
    """Get list of available tickers"""
    # IDX major stocks
    idx_tickers = [
        {"symbol": "^JKSE", "name": "IDX Composite (IHSG)", "category": "Index"},
        {"symbol": "BBCA.JK", "name": "Bank Central Asia", "category": "Banking"},
        {"symbol": "BMRI.JK", "name": "Bank Mandiri", "category": "Banking"},
        {"symbol": "BBRI.JK", "name": "Bank Rakyat Indonesia", "category": "Banking"},
        {"symbol": "BBNI.JK", "name": "Bank Negara Indonesia", "category": "Banking"},
        {"symbol": "TLKM.JK", "name": "Telkom Indonesia", "category": "Telecommunications"},
        {"symbol": "ASII.JK", "name": "Astra International", "category": "Automotive"},
        {"symbol": "UNVR.JK", "name": "Unilever Indonesia", "category": "Consumer Goods"},
        {"symbol": "ICBP.JK", "name": "Indofood CBP", "category": "Consumer Goods"},
        {"symbol": "INDF.JK", "name": "Indofood Sukses Makmur", "category": "Consumer Goods"},
        {"symbol": "KLBF.JK", "name": "Kalbe Farma", "category": "Healthcare"},
        {"symbol": "GGRM.JK", "name": "Gudang Garam", "category": "Consumer Goods"},
        {"symbol": "ADRO.JK", "name": "Adaro Energy", "category": "Energy"},
        {"symbol": "PTBA.JK", "name": "Bukit Asam", "category": "Energy"},
        {"symbol": "INCO.JK", "name": "Vale Indonesia", "category": "Mining"},
        {"symbol": "ANTM.JK", "name": "Aneka Tambang", "category": "Mining"},
        {"symbol": "SMGR.JK", "name": "Semen Indonesia", "category": "Construction"},
        {"symbol": "WIKA.JK", "name": "Wijaya Karya", "category": "Construction"},
        {"symbol": "PGAS.JK", "name": "Perusahaan Gas Negara", "category": "Energy"},
        {"symbol": "BSDE.JK", "name": "Bumi Serpong Damai", "category": "Property"},
        {"symbol": "BUVA.JK", "name": "Bukalapak", "category": "Technology"},
        {"symbol": "GOTO.JK", "name": "GoTo Gojek Tokopedia", "category": "Technology"},
        {"symbol": "EMTK.JK", "name": "Elang Mahkota Teknologi", "category": "Media"},
        {"symbol": "MEDC.JK", "name": "Medco Energi", "category": "Energy"},
        {"symbol": "EXCL.JK", "name": "XL Axiata", "category": "Telecommunications"},
    ]
    
    return {
        "total": len(idx_tickers),
        "tickers": idx_tickers
    }

def is_idx_market_open():
    """Check if IDX market is currently open (WIB/UTC+7)"""
    from datetime import timezone, timedelta
    
    # Get Jakarta time (UTC+7)
    jakarta_tz = timezone(timedelta(hours=7))
    now_jakarta = datetime.now(jakarta_tz)
    
    day = now_jakarta.weekday()  # 0=Monday, 4=Friday, 5=Saturday, 6=Sunday
    hours = now_jakarta.hour
    minutes = now_jakarta.minute
    time_in_minutes = hours * 60 + minutes
    
    # Weekend check
    if day >= 5:  # Saturday or Sunday
        return False
    
    # Monday-Thursday: Session 1 (09:00-12:00), Session 2 (13:30-16:15)
    if day <= 3:  # Monday to Thursday
        sesi1_start = 9 * 60  # 09:00
        sesi1_end = 12 * 60  # 12:00
        sesi2_start = 13 * 60 + 30  # 13:30
        sesi2_end = 16 * 60 + 15  # 16:15
        
        return (time_in_minutes >= sesi1_start and time_in_minutes <= sesi1_end) or \
               (time_in_minutes >= sesi2_start and time_in_minutes <= sesi2_end)
    
    # Friday: Session 1 (09:00-11:30), Session 2 (14:00-16:15)
    if day == 4:  # Friday
        sesi1_start = 9 * 60  # 09:00
        sesi1_end = 11 * 60 + 30  # 11:30
        sesi2_start = 14 * 60  # 14:00
        sesi2_end = 16 * 60 + 15  # 16:15
        
        return (time_in_minutes >= sesi1_start and time_in_minutes <= sesi1_end) or \
               (time_in_minutes >= sesi2_start and time_in_minutes <= sesi2_end)
    
    return False

@app.websocket("/ws/realtime/{ticker}")
async def websocket_realtime(websocket: WebSocket, ticker: str):
    """WebSocket endpoint for real-time price updates"""
    await manager.connect(websocket)
    
    # Check if this is an IDX ticker
    is_idx_ticker = ticker.endswith('.JK') or ticker == '^JKSE'
    
    try:
        while True:
            # For IDX tickers, only send updates during market hours
            if is_idx_ticker and not is_idx_market_open():
                # Send market closed status
                await websocket.send_json({
                    "type": "market_closed",
                    "ticker": ticker,
                    "message": "IDX market is closed",
                    "timestamp": datetime.now().isoformat()
                })
                # Wait longer when market is closed (check every 60 seconds)
                await asyncio.sleep(60)
                continue
            
            # Get real-time quote
            quote = scraper.get_realtime_quote(ticker)
            
            # Send to client
            await websocket.send_json({
                "type": "quote",
                "ticker": ticker,
                "data": quote,
                "timestamp": datetime.now().isoformat()
            })
            
            # Wait 2 seconds before next update
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
