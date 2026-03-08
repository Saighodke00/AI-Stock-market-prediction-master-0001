import sys
import os
import tensorflow as tf
import tf_keras
import numpy as np

print("Test start - with TF/tf_keras and 18 features")
try:
    from main import InferenceModel
    print("InferenceModel imported")
    
    keras_path = 'models/intraday_41b101a7f4/mag_model.keras'
    print(f"Loading {keras_path}...")
    model = InferenceModel(keras_path)
    print("Model loaded")
    
    dummy_input = np.random.rand(1, 60, 18).astype(np.float32)
    print("Running prediction...")
    preds = model.predict(dummy_input)
    print("Prediction result:", preds)
    print("TEST SUCCESS")
except Exception as e:
    print("TEST FAILED:", e)
    import traceback
    traceback.print_exc()
