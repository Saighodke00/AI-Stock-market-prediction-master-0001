import requests
import time

endpoints = [
    "http://127.0.0.1:9001/api/market-pulse",
    "http://127.0.0.1:9001/api/dashboard/logs",
    "http://127.0.0.1:9001/api/dashboard-stats"
]

for url in endpoints:
    print(f"Testing {url}...")
    try:
        start = time.time()
        resp = requests.get(url, timeout=10)
        end = time.time()
        print(f"Status: {resp.status_code}, Time: {end-start:.2f}s")
        print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
