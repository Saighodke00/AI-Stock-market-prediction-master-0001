import os
import sys
import numpy as np
import logging

# Setup basic logging to see InferenceModel logs
logging.basicConfig(level=logging.INFO)

# Add current dir to path to import main
sys.path.append(os.getcwd())

from main import InferenceModel

def test_loading():
    print("--- Testing Unified Model Loading ---")
    
    # Test TFLite (should trigger Flex error and we verify it's caught if used in a loop, 
    # but here we just test the class itself)
    tflite_path = 'models/intraday_NSEI15m.tflite'
    print(f"\n1. Testing TFLite instantiation for {tflite_path}")
    try:
        model = InferenceModel(tflite_path)
        print("Instantiated TFLite successfully (Surprising if it didn't fail allocation!)")
    except Exception as e:
        print(f"Caught expected TFLite error: {e}")

    # Test Keras fallback path
    keras_path = 'models/intraday_41b101a7f4/mag_model.keras'
    print(f"\n2. Testing Keras instantiation for {keras_path}")
    try:
        model_k = InferenceModel(keras_path)
        print("SUCCESS: Instantiated Keras model.")
        
        # Test prediction
        dummy_input = np.random.rand(1, 60, 18).astype(np.float32)
        preds = model_k.predict(dummy_input)
        print("Prediction result:", preds)
        
        if "q0.5" in preds:
            print("Verified: q0.5 is present in predictions.")
        else:
            print("FAILED: q0.5 missing from predictions.")
            
    except Exception as e:
        print(f"FAILED: Keras instantiation/prediction failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_loading()
