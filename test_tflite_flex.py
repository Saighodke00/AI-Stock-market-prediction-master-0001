import glob
import os

try:
    import tensorflow as tf
    print(f"TensorFlow version: {tf.__version__}")
except ImportError:
    print("TensorFlow not installed")

try:
    import tflite_runtime.interpreter as tflite_rt
    print("tflite_runtime available")
except ImportError:
    print("tflite_runtime not available")

import tensorflow.lite as tflite

keras_files = glob.glob("models/**/*.tflite", recursive=True)
if not keras_files:
    print("No .tflite files found")
    exit()

model_path = keras_files[0]
print(f"Testing model: {model_path}")

try:
    print("Attempting standard load...")
    interp = tflite.Interpreter(model_path=model_path)
    interp.allocate_tensors()
    print("Standard load successful!")
except Exception as e:
    print(f"Standard load failed: {e}")

try:
    print("Attempting load with explicit Flex delegate...")
    # This is the official way to enable Flex ops if they aren't auto-registered
    import tensorflow as tf
    try:
        # On some platforms it's just 'flex', on others it might be a full path to the .dll/.so
        delegate = tf.lite.experimental.load_delegate('flex')
        interp = tf.lite.Interpreter(model_path=model_path, experimental_delegates=[delegate])
        interp.allocate_tensors()
        print("Explicit Flex load successful!")
    except Exception as e:
        print(f"Explicit Flex load failed: {e}")
except Exception as e:
    print(f"Delegate setup failed: {e}")
