#!/bin/bash
cd "$(dirname "$0")/frontend"
echo "🚀 Starting frontend on http://localhost:3000"
echo "📂 Serving from: $(pwd)"
python3 -m http.server 3000
