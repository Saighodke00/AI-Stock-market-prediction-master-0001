
print("Starting import test...")
import sys
import os
print("Importing modules...")
try:
    import pandas as pd
    print("pandas imported")
    import numpy as np
    print("numpy imported")
    import tensorflow as tf
    print(f"tensorflow imported: {tf.__version__}")
    from main import app
    print("main:app imported successfully!")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
