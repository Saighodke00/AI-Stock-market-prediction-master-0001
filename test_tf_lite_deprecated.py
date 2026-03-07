import traceback
import tensorflow as tf

print('TensorFlow version:', tf.__version__)

try:
    # Use the supposedly deprecated but more mature interpreter
    interpreter = tf.lite.Interpreter(model_path='models/intraday_NSEI15m.tflite')
    interpreter.allocate_tensors()
    print('Success with tf.lite.Interpreter')
except Exception as e:
    print('Failed with tf.lite.Interpreter')
    traceback.print_exc()
