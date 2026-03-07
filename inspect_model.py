import tensorflow as tf

def describe_tflite_model(model_path):
    print(f"Describing {model_path}...")
    try:
        interpreter = tf.lite.Interpreter(model_path=model_path)
        # Note: We don't allocate tensors yet, just get details
        # Actually, get_tensor_details() doesn't need allocation
        
        # To see ops, we can look at the buffer
        with open(model_path, 'rb') as f:
            model_content = f.read()
            
        # We can use the internal schema if needed, but easier is to use the interpreter's 
        # error message if it fails on allocation.
        # But we already know it uses Flex.
        
        # Let's try to see if we can get ANY info from it
        print("Inputs:", interpreter.get_input_details())
        print("Outputs:", interpreter.get_output_details())
        
    except Exception as e:
        print(f"Error describing model: {e}")

describe_tflite_model('models/intraday_NSEI15m.tflite')
describe_tflite_model('models/swing_NVDA.tflite')
