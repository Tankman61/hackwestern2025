#!/usr/bin/env python3
"""
VibeTrade Backend Startup Script
"""
import os
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    print(f"""
╔══════════════════════════════════════════╗
║     VibeTrade API Starting...            ║
║     Host: {host:<30} ║
║     Port: {port:<30} ║
╚══════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
