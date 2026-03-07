import os
import sys

# Try to add the DLL directory for TensorFlow
import tensorflow as tf
tf_dir = os.path.dirname(tf.__file__)
print(f"TensorFlow directory: {tf_dir}")

if hasattr(os, 'add_dll_directory'):
    print("Adding DLL directory...")
    # Add various potential DLL paths
    os.add_dll_directory(tf_dir)
    os.add_dll_directory(os.path.join(tf_dir, 'python'))
    os.add_dll_directory(os.path.join(tf_dir, 'lite', 'python'))

print("Attempting to load TFLite model with Flex ops...")
try:
    from ai_edge_litert.interpreter import Interpreter
    interpreter = Interpreter(model_path='models/intraday_NSEI15m.tflite')
    # experimental_op_resolver_type might be needed
    # but let's try defaults first
    interpreter.allocate_tensors()
    print("SUCCESS with ai_edge_litert after adding DLL directory!")
except Exception as e:
    print(f"FAILED with ai_edge_litert: {e}")

try:
    interpreter2 = tf.lite.Interpreter(model_path='models/intraday_NSEI15m.tflite')
    interpreter2.allocate_tensors()
    print("SUCCESS with tf.lite.Interpreter after adding DLL directory!")
except Exception as e:
    print(f"FAILED with tf.lite.Interpreter: {e}")
