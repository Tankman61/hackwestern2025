# How to Know When Ingest Cycles Run

## Overview
The **Data Ingest Worker** runs every **10 seconds** and fetches data from Polymarket, Reddit, and Finnhub.

## Understanding Change Percentages

**First Cycle**: All markets will show "+0%" because there's no previous data to compare against.
**Second Cycle**: Real change percentages will appear because we can compare current odds with previous odds.

## How to Check the Logs

### Look for These Log Messages:

#### First Cycle (All "+0%"):
```
🔄 Starting ingest cycle...
📊 Found 0 previous Polymarket markets for change calculation
✅ Upserted X Polymarket feed items (FIRST CYCLE - all markets are new, changes will appear next cycle)
✅ Ingest cycle complete. Next cycle in 10s
```

#### Second Cycle (Real Changes):
```
🔄 Starting ingest cycle...
📊 Found X previous Polymarket markets for change calculation
✅ Upserted X Polymarket feed items: Y with real changes, Z new markets
🎯 Change percentages are now calculated! Check the frontend to see real changes instead of '+0%'
✅ Ingest cycle complete. Next cycle in 10s
```

### Key Indicators:

1. **"FIRST CYCLE"** in the log = This is the first run, all will be "+0%"
2. **"Found X previous Polymarket markets"** where X > 0 = Second cycle or later
3. **"Y with real changes"** where Y > 0 = Real change percentages calculated!

## Quick Ways to Check

### Method 1: Check Server Logs
Look at your FastAPI server logs. You'll see:
- Every 10 seconds: `🔄 Starting ingest cycle...`
- After 10 seconds: Check if it says "FIRST CYCLE" or shows "with real changes"

### Method 2: Check Frontend
- Refresh the frontend
- Look at the Polymarket panel
- If you see "+0%" on all markets = First cycle
- If you see "+X%" or "-X%" = Second cycle or later (real changes!)

### Method 3: Check Database
Query the `feed_items` table:
```sql
SELECT title, metadata->>'change' as change
FROM feed_items
WHERE source = 'POLYMARKET'
ORDER BY created_at DESC
LIMIT 10;
```

- If all changes are "+0%" = First cycle
- If you see other values = Second cycle or later

## Timeline

- **T+0s**: First ingest cycle runs → All markets show "+0%"
- **T+10s**: Second ingest cycle runs → Real changes appear!

## Manual Testing

You can also run a single cycle manually:
```bash
cd backend-new
python test_ingest_once.py
```

This will run one cycle and show you the log output without waiting for the full 10-second interval.

