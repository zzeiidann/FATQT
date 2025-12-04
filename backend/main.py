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
import os

from scrapper import RealTimeScraper, download_fast
from analysis.seasonal import SeasonalAnalysis
from analysis.patterns import PatternAnalysis
from analysis.volatility import VolatilityAnalysis
from analysis.intraday import IntradayAnalysis
from analysis.idx_shareholder import (
    get_idx_reports,
    download_pdfs,
    extract_from_files,
    clear_cache,
    PDF_CACHE_DIR
)

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

class IDXReportRequest(BaseModel):
    year: int = 2024
    periode: str = "tw1"  # tw1, tw2, tw3, tahunan
    emiten: str = ""  # kode emiten (tanpa .JK)

class PDFDownloadRequest(BaseModel):
    urls: List[str]  # list of PDF URLs to download

class PDFExtractRequest(BaseModel):
    file_names: List[str]  # list of downloaded PDF filenames


def format_datetime_column(df: pd.DataFrame, column: str = 'Date', ticker: str = '') -> pd.DataFrame:
    """Normalize datetime column to ISO strings, with exchange-local timezone.

    - Untuk ticker IDX (.JK, ^JKSE, dll) -> Asia/Jakarta (UTC+7)
    - Untuk ticker lain -> biarkan di tz aslinya (hanya drop tz info)
    """
    if column not in df.columns:
        return df

    dates = pd.to_datetime(df[column], errors='coerce')

    if getattr(dates.dt, 'tz', None) is not None:
        is_idx = ticker.endswith('.JK') or ticker.startswith('^JK')
        if is_idx:
            # dari UTC -> Asia/Jakarta
            dates = dates.dt.tz_convert('Asia/Jakarta').dt.tz_localize(None)
        else:
            # drop timezone saja (anggap sudah di tz bursa yg bener)
            dates = dates.dt.tz_localize(None)

    # ke ISO tanpa timezone
    df[column] = dates.dt.strftime('%Y-%m-%dT%H:%M:%S')
    return df

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

@app.post("/api/indicators/stochrsi")
async def calculate_stoch_rsi(request: HistoricalRequest):
    """Calculate Stochastic RSI indicator"""
    try:
        # Get historical data first
        data = download_fast(
            request.ticker,
            request.start_date,
            request.end_date,
            interval=request.interval
        )
        
        if data is None or len(data) == 0:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Normalize columns if MultiIndex
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = [c[0] if isinstance(c, (list, tuple)) and len(c) > 0 else c for c in data.columns]
        
        # Ensure we have Close prices
        if 'Close' not in data.columns:
            raise HTTPException(status_code=400, detail="No Close prices available")
        
        # Calculate Stochastic RSI
        def calculate_rsi(prices, period=14):
            """Calculate RSI"""
            deltas = prices.diff()
            gains = deltas.where(deltas > 0, 0)
            losses = -deltas.where(deltas < 0, 0)
            
            avg_gains = gains.rolling(window=period, min_periods=period).mean()
            avg_losses = losses.rolling(window=period, min_periods=period).mean()
            
            rs = avg_gains / avg_losses
            rsi = 100 - (100 / (1 + rs))
            return rsi
        
        def calculate_stoch_rsi(prices, rsi_period=14, stoch_period=14, k_period=3, d_period=3):
            """Calculate Stochastic RSI"""
            # Calculate RSI
            rsi = calculate_rsi(prices, rsi_period)
            
            # Calculate Stochastic of RSI
            rsi_min = rsi.rolling(window=stoch_period, min_periods=stoch_period).min()
            rsi_max = rsi.rolling(window=stoch_period, min_periods=stoch_period).max()
            
            stoch_rsi = ((rsi - rsi_min) / (rsi_max - rsi_min)) * 100
            stoch_rsi = stoch_rsi.fillna(50)  # Fill NaN with neutral value
            
            # Smooth K line
            k_line = stoch_rsi.rolling(window=k_period, min_periods=k_period).mean()
            
            # Calculate D line (SMA of K)
            d_line = k_line.rolling(window=d_period, min_periods=d_period).mean()
            
            return k_line, d_line
        
        # Calculate Stoch RSI
        k_line, d_line = calculate_stoch_rsi(data['Close'])
        
        # Prepare response data
        if 'Date' not in data.columns and data.index is not None:
            data = data.reset_index()

        # Normalize to a single Date column for consistent frontend handling
        if 'Date' not in data.columns:
            if 'Datetime' in data.columns:
                data = data.rename(columns={'Datetime': 'Date'})
            else:
                first_col = data.columns[0]
                data = data.rename(columns={first_col: 'Date'})

        if 'Date' in data.columns:
            data = format_datetime_column(data, 'Date', ticker=request.ticker)
            dates = data['Date'].tolist()
        else:
            dates = list(range(len(data)))

        
        # Filter out NaN values
        result_data = []
        for i, (date, k, d) in enumerate(zip(dates, k_line, d_line)):
            if pd.notna(k) and pd.notna(d):
                result_data.append({
                    "date": date,
                    "k": float(k),
                    "d": float(d)
                })
        
        return {
            "ticker": request.ticker,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "interval": request.interval,
            "indicator": "stochastic_rsi",
            "parameters": {
                "rsi_period": 14,
                "stoch_period": 14,
                "k_period": 3,
                "d_period": 3
            },
            "data": result_data
        }
    except Exception as e:
        import traceback
        print(f"Error in stoch RSI endpoint: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/historical")
async def get_historical_data(request: HistoricalRequest):
    try:
        # --- ADJUST END DATE UNTUK INTRADAY ---
        intraday_intervals = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h"}

        start_str = request.start_date
        end_str = request.end_date

        if request.interval in intraday_intervals:
            # yfinance: end itu exclusive, jadi tambahin 1 hari
            try:
                end_dt = datetime.strptime(request.end_date, "%Y-%m-%d") + timedelta(days=1)
                end_str = end_dt.strftime("%Y-%m-%d")
            except Exception:
                end_str = request.end_date  # fallback kalau parsing error

        print(f"[API] Historical data request: {request.ticker} from {start_str} to {end_str}, interval={request.interval}")

        data = download_fast(
            request.ticker,
            start_str,
            end_str,
            interval=request.interval,
            progress=False
        )

        print(f"[API] Received {len(data) if data is not None else 0} rows from yfinance")

    
        if data is None or len(data) == 0:
            print(f"[API] WARNING: No data returned for {request.ticker} with interval {request.interval}")
            raise HTTPException(status_code=404, detail="No data found")
        
        # ---- 1) Flatten MultiIndex kalau ada
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = [c[0] if isinstance(c, (list, tuple)) and len(c) > 0 else c for c in data.columns]

        # ---- 2) Pastikan index jadi kolom
        if data.index is not None:
            data = data.reset_index()

        # ---- 3) Normalisasi nama kolom tanggal -> selalu 'Date'
        if 'Date' not in data.columns:
            if 'Datetime' in data.columns:
                data = data.rename(columns={'Datetime': 'Date'})
            else:
                # fallback: jadikan kolom pertama sebagai Date
                first_col = data.columns[0]
                data = data.rename(columns={first_col: 'Date'})

                # ---- 4) Konversi Date ke ISO-8601 string biar frontend gampang parse
        data = format_datetime_column(data, 'Date', ticker=request.ticker)

        # ---- 5) Susun ulang kolom
        preferred_cols = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
        existing = [c for c in preferred_cols if c in data.columns]
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
        try:
            seasonal = SeasonalAnalysis(data)
            seasonal_data = seasonal.get_all_seasonal_analysis()
        except Exception as e:
            print(f"Seasonal analysis error: {e}")
            seasonal_data = {"error": str(e)}
        
        try:
            patterns = PatternAnalysis(data)
            pattern_data = patterns.get_all_pattern_analysis()
        except Exception as e:
            print(f"Pattern analysis error: {e}")
            pattern_data = {"error": str(e)}
        
        try:
            volatility = VolatilityAnalysis(data)
            volatility_data = volatility.get_all_volatility_analysis()
        except Exception as e:
            print(f"Volatility analysis error: {e}")
            volatility_data = {"error": str(e)}
        
        result = {
            "ticker": ticker,
            "period": {
                "start": start_date,
                "end": end_date,
                "days": len(data)
            },
            "seasonal": seasonal_data,
            "patterns": pattern_data,
            "volatility": volatility_data,
            "generated_at": datetime.now().isoformat()
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tickers")
async def get_ticker_list():
    """Get list of available tickers"""
    # IDX major stocks - expanded list
    idx_tickers = [
        {"symbol": "^JKSE", "name": "Jakarta Composite Index", "category": "Index"},
        {"symbol": "^JKLQ45", "name": "LQ45 Index", "category": "Index"},
    ]
    
    idx_composite = pd.read_csv('idx_composite_list.csv')

    for _, row in idx_composite.iterrows():
        idx_tickers.append({
            "symbol": row['symbol'],
            "name": row['name'],
            "category": row['category']
        })
    
    return {
        "total": len(idx_tickers),
        "tickers": idx_tickers
    }


# ============================================================
# IDX PDF SHAREHOLDER ANALYSIS ENDPOINTS
# ============================================================

@app.get("/api/idx/emiten")
async def get_idx_emiten_list():
    """Get list of IDX emiten codes from idx_composite_list.csv"""
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'idx_composite_list.csv')
        df = pd.read_csv(csv_path)
        
        # Extract emiten code (remove .JK suffix)
        emiten_list = []
        for _, row in df.iterrows():
            symbol = row['symbol']
            code = symbol.replace('.JK', '') if '.JK' in symbol else symbol
            if not code.startswith('^'):  # Skip index symbols
                emiten_list.append({
                    "code": code,
                    "name": row['name'],
                    "category": row.get('category', 'Stock')
                })
        
        return {
            "total": len(emiten_list),
            "emiten": emiten_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/idx/reports")
async def search_idx_reports(request: IDXReportRequest):
    """Search IDX financial reports by year, periode, and emiten"""
    try:
        result = get_idx_reports(request.year, request.periode, request.emiten)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/idx/download")
async def download_idx_pdfs(request: PDFDownloadRequest):
    """Download selected PDFs from IDX"""
    try:
        result = download_pdfs(request.urls)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/idx/extract")
async def extract_shareholders_from_pdfs(request: PDFExtractRequest):
    """Extract shareholder data from downloaded PDFs"""
    try:
        result = extract_from_files(request.file_names)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/idx/cache")
async def clear_pdf_cache_endpoint():
    """Clear all downloaded PDF cache"""
    try:
        result = clear_cache()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
