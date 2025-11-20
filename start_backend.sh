#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
cd backend
echo "🚀 Starting FastAPI backend on http://localhost:8000"
python main.py
