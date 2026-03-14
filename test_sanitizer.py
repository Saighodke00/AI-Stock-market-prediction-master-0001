import sys
import os
import math
import numpy as np

# Add current dir to path
sys.path.insert(0, os.getcwd())

from main import _json_sanitize

def test_sanitizer():
    test_data = {
        "ok": 1.23,
        "nan": float('nan'),
        "inf": float('inf'),
        "mix": [1, float('nan'), {"nested_inf": float('-inf')}],
        "string": "hello"
    }
    
    print("Original data:", test_data)
    sanitized = _json_sanitize(test_data)
    print("Sanitized data:", sanitized)
    
    assert sanitized["nan"] == 0.0
    assert sanitized["inf"] == 0.0
    assert sanitized["mix"][1] == 0.0
    assert sanitized["mix"][2]["nested_inf"] == 0.0
    print("\nSanitizer test passed!")

if __name__ == "__main__":
    test_sanitizer()
