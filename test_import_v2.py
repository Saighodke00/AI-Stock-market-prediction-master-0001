
import time
import sys

def test_imp(name):
    t0 = time.time()
    print(f"Importing {name}...", end=" ", flush=True)
    try:
        __import__(name)
        print(f"DONE ({time.time()-t0:.2f}s)")
    except Exception as e:
        print(f"FAIL: {e}")

test_imp("pandas")
test_imp("numpy")
test_imp("tensorflow")
test_imp("fastapi")
print("--- Local Utils ---")
test_imp("utils.constants")
test_imp("utils.data_loader")
test_imp("utils.features")
test_imp("utils.indicators")
test_imp("utils.sentiment")
test_imp("reasoning")
test_imp("paper_trading")
print("All tests done.")
