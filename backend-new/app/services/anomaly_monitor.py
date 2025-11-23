"""
Anomaly Detection Service
Monitors various metrics and detects significant anomalies
When anomalies are detected, triggers alerts to the AI agent
"""
import logging
import statistics
from typing import Dict, Any, List, Optional, Callable, Awaitable
from datetime import datetime, timedelta
from collections import deque

logger = logging.getLogger(__name__)


class AnomalyMonitor:
    """
    Service that monitors metrics and detects anomalies using statistical methods.
    
    Detects anomalies based on:
    - Sudden changes (rate of change exceeds threshold)
    - Statistical outliers (values outside 2-3 standard deviations)
    - Trend breaks (sudden reversals in direction)
    """
    
    def __init__(self, window_size: int = 10, z_score_threshold: float = 2.5):
        """
        Initialize anomaly monitor.
        
        Args:
            window_size: Number of historical values to keep for baseline
            z_score_threshold: Z-score threshold for outlier detection (default 2.5 = ~99% confidence)
        """
        self.window_size = window_size
        self.z_score_threshold = z_score_threshold
        
        # Store historical values for each metric
        self.metric_history: Dict[str, deque] = {}
        
        # Track last anomaly detection time per metric (for cooldown)
        self.last_anomaly_time: Dict[str, datetime] = {}
        
        # Anomaly cooldown period (seconds)
        self.anomaly_cooldown_seconds = 60
        
        logger.info(f"✅ Anomaly Monitor initialized (window={window_size}, z_threshold={z_score_threshold})")
    
    def add_metric_value(self, metric_name: str, value: float, timestamp: Optional[datetime] = None):
        """
        Add a new value for a metric to track.
        
        Args:
            metric_name: Name of the metric (e.g., "btc_price", "portfolio_balance")
            value: Current value
            timestamp: Optional timestamp (defaults to now)
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        if metric_name not in self.metric_history:
            self.metric_history[metric_name] = deque(maxlen=self.window_size)
        
        self.metric_history[metric_name].append({
            "value": value,
            "timestamp": timestamp
        })
    
    def detect_anomalies(self, metric_name: str, current_value: float, 
                        rate_of_change_threshold: float = 0.05) -> Optional[Dict[str, Any]]:
        """
        Detect if current value represents an anomaly.
        
        Args:
            metric_name: Name of the metric to check
            current_value: Current value to test
            rate_of_change_threshold: Threshold for rate of change detection (5% default)
        
        Returns:
            Anomaly details dict if anomaly detected, None otherwise
            {
                "metric": "btc_price",
                "current_value": 96500.00,
                "baseline_mean": 95000.00,
                "baseline_std": 500.00,
                "z_score": 3.0,
                "rate_of_change": 0.08,
                "anomaly_type": "outlier" | "sudden_change" | "trend_break",
                "severity": "high" | "medium" | "low"
            }
        """
        if metric_name not in self.metric_history:
            # Not enough history yet, add the value and return None
            self.add_metric_value(metric_name, current_value)
            return None
        
        history = self.metric_history[metric_name]
        
        if len(history) < 3:
            # Need at least 3 data points for meaningful analysis
            self.add_metric_value(metric_name, current_value)
            return None
        
        # Extract historical values
        historical_values = [item["value"] for item in history]
        
        # Calculate baseline statistics
        mean = statistics.mean(historical_values)
        stdev = statistics.stdev(historical_values) if len(historical_values) > 1 else 0
        
        # Check cooldown
        if metric_name in self.last_anomaly_time:
            time_since_last = (datetime.utcnow() - self.last_anomaly_time[metric_name]).total_seconds()
            if time_since_last < self.anomaly_cooldown_seconds:
                # Still in cooldown, just add value and return
                self.add_metric_value(metric_name, current_value)
                return None
        
        anomaly = None
        anomaly_type = None
        severity = "low"
        
        # Detection Method 1: Statistical Outlier (Z-score)
        if stdev > 0:
            z_score = abs((current_value - mean) / stdev)
            if z_score >= self.z_score_threshold:
                anomaly_type = "outlier"
                if z_score >= 4.0:
                    severity = "high"
                elif z_score >= 3.0:
                    severity = "high"
                elif z_score >= 2.5:
                    severity = "medium"
                
                anomaly = {
                    "metric": metric_name,
                    "current_value": current_value,
                    "baseline_mean": mean,
                    "baseline_std": stdev,
                    "z_score": z_score,
                    "anomaly_type": anomaly_type,
                    "severity": severity,
                    "message": f"{metric_name} is {z_score:.2f} standard deviations from baseline ({current_value:.2f} vs {mean:.2f})"
                }
        
        # Detection Method 2: Sudden Rate of Change
        if not anomaly and len(history) >= 2:
            previous_value = history[-1]["value"]
            rate_of_change = abs((current_value - previous_value) / previous_value) if previous_value != 0 else 0
            
            if rate_of_change >= rate_of_change_threshold:
                # Check if this is a sudden reversal (trend break)
                if len(historical_values) >= 3:
                    # Check if previous trend was consistent
                    recent_trend = historical_values[-1] - historical_values[-2]
                    current_trend = current_value - historical_values[-1]
                    
                    if (recent_trend > 0 and current_trend < -recent_trend * 2) or \
                       (recent_trend < 0 and current_trend > -recent_trend * 2):
                        anomaly_type = "trend_break"
                        severity = "high" if rate_of_change >= 0.10 else "medium"
                    else:
                        anomaly_type = "sudden_change"
                        severity = "high" if rate_of_change >= 0.15 else "medium" if rate_of_change >= 0.08 else "low"
                else:
                    anomaly_type = "sudden_change"
                    severity = "high" if rate_of_change >= 0.15 else "medium"
                
                if not anomaly or severity == "high":  # Override if current is more severe
                    anomaly = {
                        "metric": metric_name,
                        "current_value": current_value,
                        "previous_value": previous_value,
                        "rate_of_change": rate_of_change,
                        "change_percent": rate_of_change * 100,
                        "anomaly_type": anomaly_type,
                        "severity": severity,
                        "message": f"{metric_name} changed {rate_of_change*100:.2f}% suddenly ({previous_value:.2f} → {current_value:.2f})"
                    }
        
        # Add current value to history
        self.add_metric_value(metric_name, current_value)
        
        # If anomaly detected, update last anomaly time
        if anomaly:
            self.last_anomaly_time[metric_name] = datetime.utcnow()
            logger.warning(f"🚨 ANOMALY DETECTED: {anomaly['message']} (severity: {severity})")
        
        return anomaly


# Global singleton
_anomaly_monitor: Optional[AnomalyMonitor] = None


def get_anomaly_monitor() -> AnomalyMonitor:
    """Get or create the anomaly monitor singleton."""
    global _anomaly_monitor
    if _anomaly_monitor is None:
        _anomaly_monitor = AnomalyMonitor()
    return _anomaly_monitor

