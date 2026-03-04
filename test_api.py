import time
import requests

BASE_URL = "http://localhost:8000/api"

print("Waiting for server to start...")
time.sleep(5)

def test_endpoint(name, method, url, json_payload=None):
    print(f"\n--- Testing {name} ---")
    try:
        if method == "GET":
            res = requests.get(url)
        else:
            res = requests.post(url, json=json_payload)
            
        print(f"Status Code: {res.status_code}")
        try:
            json_res = res.json()
            if "metrics" in json_res:
                print(f"Backtest Metrics: {json_res['metrics']}")
            else:
                print(f"Response (keys): {list(json_res.keys())}")
        except:
            print(f"Text Response: {res.text[:200]}...")
    except Exception as e:
        print(f"Failed to connect: {e}")

test_endpoint("Health Check", "GET", f"{BASE_URL}/health")
test_endpoint("Sentiment Analysis", "GET", f"{BASE_URL}/sentiment/AAPL")
test_endpoint("Screener", "GET", f"{BASE_URL}/screener?sector=Technology&limit=2")
# Post endpoints testing
test_endpoint("Signal (No Model Warning expected)", "POST", f"{BASE_URL}/signal/AAPL")
test_endpoint("Alpaca Webhook Action", "POST", f"{BASE_URL}/webhook/alpaca", json_payload={
    "ticker": "AAPL",
    "price": 150.0,
    "source": "tradingview_test"
})
test_endpoint("Backtest", "POST", f"{BASE_URL}/backtest", json_payload={
    "ticker": "AAPL",
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "config": {"initial_capital": 10000, "time_step": 30}
})

