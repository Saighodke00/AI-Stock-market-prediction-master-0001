
import os
import sys
import pandas as pd
import numpy as np

# Mocking some dependencies if they fail to load in this environment
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from main import _run_inference, _state, _load_all_models, _find_startup_scaler

def diagnose():
    print("--- APEX AI Signal Diagnoser ---")
    
    # Initialize state
    print("Loading models and scaler...")
    _load_all_models()
    _state.scaler = _find_startup_scaler()
    
    tickers = ["RELIANCE.NS", "TCS.NS", "INFY.NS"]
    
    for ticker in tickers:
        print(f"\nAnalyzing {ticker}...")
        try:
            result = _run_inference(ticker, mode="swing")
            
            action = result["action"]
            direction = result["direction"]
            gates = result["gate_results"]
            conf = result["confidence"]
            
            print(f"  Direction: {direction}")
            print(f"  Final Action: {action}")
            print(f"  Confidence: {conf}")
            print(f"  Gate 1 (Cone: {result['p90']-result['p10']:.2f}): {'✅' if gates['gate1_cone'] else '❌'}  (Width: {gates['cone_width']:.4f})")
            print(f"  Gate 2 (Sentiment: {result['sentiment']['score']:.4f}): {'✅' if gates['gate2_sentiment'] else '❌'}")
            print(f"  Gate 3 (RSI: {result['rsi']:.1f}): {'✅' if gates['gate3_technical'] else '❌'}")
            
            if action == "HOLD":
                reasons = []
                if not gates["gate1_cone"]: reasons.append("High volatility (Wide prediction cone)")
                if not gates["gate2_sentiment"]: reasons.append("Sentiment conflict or data missing")
                if not gates["gate3_technical"]: reasons.append("RSI in extreme zone")
                print(f"  [HOLD REASON]: {', '.join(reasons)}")
                
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    diagnose()
