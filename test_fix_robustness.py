import sys
import os
import pandas as pd
import numpy as np
import logging
from unittest.mock import MagicMock, patch

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from utils.features import build_features
from utils.data_pipeline import fetch_multi_modal

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("test_fix")

def test_feature_count_consistency():
    logger.info("--- Test: feature count consistency ---")
    
    n = 100
    df = pd.DataFrame({
        "Open": np.random.randn(n) + 100,
        "High": np.random.randn(n) + 101,
        "Low": np.random.randn(n) + 99,
        "Close": np.random.randn(n) + 100,
        "Volume": np.random.randint(1000, 10000, n).astype(float),
    }, index=pd.date_range("2023-01-01", periods=n))
    
    logger.info(f"Input shape: {df.shape}")
    X, cols = build_features(df, ticker="TEST")
    
    logger.info(f"Output shape: {X.shape}")
    assert X.shape[1] == 36, f"Expected 36 features, got {X.shape[1]}"
    logger.info("PASS: feature count consistency")

def test_duplicate_column_handling():
    logger.info("--- Test: duplicate column handling ---")
    
    n = 100
    df = pd.DataFrame({
        "Open": [100.0] * n,
        "High": [105.0] * n,
        "Low": [95.0] * n,
        "Close": [102.0] * n,
        "Volume": [10000.0] * n,
    }, index=pd.date_range("2023-01-01", periods=n))
    
    # Create duplicate columns
    df_dup = pd.concat([df, df["Close"]], axis=1)
    # df_dup now has two columns named "Close" if we don't rename
    # Let's ensure they have the same name
    new_cols = list(df.columns) + ["Close"]
    df_dup.columns = new_cols
    
    logger.info(f"Input columns with duplicates: {list(df_dup.columns)}")
    X, cols = build_features(df_dup, ticker="TEST_DUP")
    
    assert X.shape[1] == 36
    logger.info("PASS: duplicate column handling")

@patch("yfinance.download")
def test_data_pipeline_robustness(mock_download):
    logger.info("--- Test: data pipeline robustness ---")
    
    n = 50
    mock_df = pd.DataFrame({
        "Open": [100.0] * n,
        "High": [105.0] * n,
        "Low": [95.0] * n,
        "Close": [102.0] * n,
        "Volume": [10000.0] * n,
    }, index=pd.date_range("2023-01-01", periods=n))
    
    def side_effect(ticker, *args, **kwargs):
        if ticker == "RELIANCE.NS": return mock_df
        if ticker == "^VIX":
            # Return duplicate columns
            d = pd.concat([mock_df["Close"], mock_df["Close"]], axis=1)
            d.columns = ["Close", "Close"]
            return d
        return pd.DataFrame() # Empty
        
    mock_download.side_effect = side_effect
    
    df_result = fetch_multi_modal("RELIANCE.NS", period="1mo")
    
    logger.info(f"Resulting columns: {list(df_result.columns)}")
    assert "VIX" in df_result.columns
    assert list(df_result.columns).count("Close") == 1
    logger.info("PASS: data pipeline robustness")

if __name__ == "__main__":
    try:
        test_feature_count_consistency()
        test_duplicate_column_handling()
        test_data_pipeline_robustness()
        print("\nALL TESTS PASSED!")
    except Exception as e:
        logger.error(f"Test FAILED: {e}", exc_info=True)
        sys.exit(1)
