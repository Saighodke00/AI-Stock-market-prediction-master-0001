import tensorflow as tf
import os

def check_keras_model(model_path):
    print(f"Checking {model_path}...")
    if not os.path.exists(model_path):
        print(f"Error: {model_path} does not exist!")
        return
    try:
        print("Starting load_model...")
        model = tf.keras.models.load_model(model_path)
        print("Model loaded successfully!")
        print("Inputs:", model.inputs)
        print("Outputs:", model.outputs)
        model.summary()
    except Exception as e:
        print(f"Error loading {model_path}: {e}")
        import traceback
        traceback.print_exc()

# Check one of the Keras models
check_keras_model('models/intraday_41b101a7f4/mag_model.keras')
print("Script finished.")
