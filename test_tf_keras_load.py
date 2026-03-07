import os
import tensorflow as tf
import tf_keras

def quantile_loss(y_true, y_pred):
    import tf_keras.backend as K
    quantiles = [0.1, 0.5, 0.9]
    losses = []
    for i, q in enumerate(quantiles):
        error = y_true - y_pred[:, i:i + 1]
        losses.append(K.mean(K.maximum(q * error, (q - 1) * error)))
    return K.sum(losses)

# Mock registration for the script
tf_keras.saving.register_keras_serializable(package='ApexAI', name='quantile_loss')(quantile_loss)

def check_tf_keras_load(model_path):
    print(f"Checking tf_keras load for {model_path}...")
    if not os.path.exists(model_path):
        print("File not found.")
        return
    try:
        # Pass custom_objects explicitly too
        model = tf_keras.models.load_model(model_path, custom_objects={'quantile_loss': quantile_loss})
        print("SUCCESS! Model loaded with tf_keras.")
        print("Inputs:", model.input_shape)
        print("Outputs:", model.output_shape)
    except Exception as e:
        print(f"FAILED with tf_keras: {e}")
        import traceback
        traceback.print_exc()

check_tf_keras_load('models/intraday_41b101a7f4/mag_model.keras')
