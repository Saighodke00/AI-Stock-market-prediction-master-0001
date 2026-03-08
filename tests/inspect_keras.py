import sys
import os
import tensorflow as tf
import tf_keras
import numpy as np

print("Test start - inspecting model (Isolated with Registration)")
try:
    keras_path = 'models/intraday_41b101a7f4/mag_model.keras'
    print(f"Loading {keras_path}...")
    
    @tf_keras.saving.register_keras_serializable(package='ApexAI', name='quantile_loss')
    def quantile_loss(y_true, y_pred):
        import tf_keras.backend as K
        quantiles = [0.1, 0.5, 0.9]
        losses = []
        for i, q in enumerate(quantiles):
            error = y_true - y_pred[:, i:i + 1]
            losses.append(K.mean(K.maximum(q * error, (q - 1) * error)))
        return K.sum(losses)

    print("Loading model...")
    model = tf_keras.models.load_model(keras_path, custom_objects={'quantile_loss': quantile_loss})
    print("SUCCESS: Model loaded.")
    
    print("\nModel Summary:")
    model.summary()
    
    # Try to find the input layer count
    # Usually it's the first layer
    input_shape = model.input_shape
    print("\nModel Input Shape:", input_shape)
    
except Exception as e:
    print("FAILED:", e)
    import traceback
    traceback.print_exc()
