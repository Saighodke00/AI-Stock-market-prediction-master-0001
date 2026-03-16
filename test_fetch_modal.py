
import sys
import os
sys.path.append(os.getcwd())

from utils.data_pipeline import fetch_multi_modal
import logging

# Set logging to a level that won't try to print emojis to a non-standard terminal if possible
# Or just let it fail and catch the exception

try:
    print("Testing fetch_multi_modal...")
    df = fetch_multi_modal("AAPL", period="1d")
    print(f"SUCCESS: fetch_multi_modal complete, shape: {df.shape}")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
