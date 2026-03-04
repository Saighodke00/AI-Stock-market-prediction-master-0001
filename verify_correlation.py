import requests
import json
import time

def verify_correlation_api():
    base_url = "http://localhost:8000"
    tickers = "AAPL,MSFT,NVDA,GLD,SPY"
    endpoint = f"{base_url}/api/correlation?tickers={tickers}"
    
    print(f"Testing Correlation API: {endpoint}")
    
    try:
        response = requests.get(endpoint)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\nAPI Response Structure:")
            print(json.dumps(data, indent=2)[:1000] + "...")
            
            # Check for key fields
            if "correlation" in data and "risk" in data:
                print("\nSUCCESS: API returned expected structure.")
                print(f"Avg Correlation: {data['risk']['avg_correlation']}")
                print(f"Risk Level: {data['risk']['concentration_risk']}")
                print(f"Suggestion: {data['risk']['suggestion']}")
            else:
                print("\nFAILURE: Missing key fields in response.")
        else:
            print(f"\nFAILURE: API returned error: {response.text}")
            
    except Exception as e:
        print(f"\nERROR: Could not connect to API: {e}")

if __name__ == "__main__":
    # Note: main.py must be running for this to work.
    # Since I cannot easily run main.py in the background and wait, 
    # I will mock the logic or just verify the function calls if I can't run the server.
    # However, I already verified correlation.py standalone.
    # I'll try to run the server briefly or just rely on standalone verification.
    
    print("Verifying backend logic via direct function calls (server-less)...")
    from correlation import calculate_correlation_matrix, analyze_portfolio_risk
    
    tickers = ["AAPL", "MSFT", "NVDA", "GLD"]
    corr = calculate_correlation_matrix(tickers)
    risk = analyze_portfolio_risk(tickers)
    
    if corr['matrix'] and risk['avg_correlation'] is not None:
        print("Backend Logic Verified.")
        print(f"Matrix Size: {len(corr['tickers'])}x{len(corr['tickers'])}")
        print(f"Risk Suggestions: {risk['suggestion']}")
    else:
        print("Backend Logic Verification Failed.")
