import os
import sys
import asyncio

# Ensure we can import from the project root
sys.path.append(os.getcwd())

# Mock tensorflow to avoid environmental issues during verification
from unittest.mock import MagicMock
mock_tf = MagicMock()
sys.modules['tensorflow'] = mock_tf
sys.modules['tensorflow.lite'] = mock_tf.lite
sys.modules['tensorflow.keras'] = mock_tf.keras

from main import lifespan, app, get_signal, normalize_ticker

class MockRequest:
    def __init__(self):
        self.scope = {"type": "http"}

async def verify_insider_integration():
    print("🚀 Verifying Insider Tracker Integration...")
    
    async with lifespan(app):
        ticker = "NVDA"
        print(f"Fetching signal for {ticker}...")
        
        # Test the get_signal function directly (mocking the request)
        try:
            response = await get_signal(MockRequest(), ticker)
            print("✅ API Response Received")
            
            if response.insider_analysis:
                print(f"📊 Insider Analysis found for {ticker}")
                print(f"Interpretation: {response.insider_analysis.interpretation}")
                print(f"Net Flow: ${response.insider_analysis.metrics.net_insider_flow:,.2f}")
            else:
                print("⚠️ Insider analysis field is present but empty (Expected if no filings found)")
                
        except Exception as e:
            print(f"❌ Error during API verification: {e}")

if __name__ == "__main__":
    asyncio.run(verify_insider_integration())
