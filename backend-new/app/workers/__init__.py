"""
Background workers for VibeTrade backend.

Three main workers:
1. DataIngestWorker - Fetches external data every 10 seconds
2. TriggerMonitorWorker - Monitors risk and triggers alerts every 1 second
3. AnomalyWorker - Monitors for anomalies and pings AI agent every 5 seconds
"""

from app.workers.ingest import DataIngestWorker, run_ingest_worker
from app.workers.monitor import TriggerMonitorWorker, run_monitor_worker
from app.workers.anomaly_worker import AnomalyWorker, run_anomaly_worker

__all__ = [
    "DataIngestWorker",
    "run_ingest_worker",
    "TriggerMonitorWorker",
    "run_monitor_worker",
    "AnomalyWorker",
    "run_anomaly_worker"
]
