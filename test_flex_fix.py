import traceback
import sys
import tensorflow as tf
import ai_edge_litert.interpreter as tflite

print('TensorFlow version:', tf.__version__)
print('ai_edge_litert version:', tflite.__version__ if hasattr(tflite, '__version__') else 'N/A')

try:
    # Try standard interpreter with experimental_op_resolver_type
    interpreter = tflite.Interpreter(
        model_path='models/intraday_NSEI15m.tflite',
        experimental_op_resolver_type=tflite.OpResolverType.BUILTIN_REF
    )
    interpreter.allocate_tensors()
    print('Success with BUILTIN_REF and TF import')
except Exception as e:
    print('Failed with BUILTIN_REF and TF import')
    traceback.print_exc()

try:
    # Try loading the flex delegate explicitly if we can find it
    # On Windows, it might be in the tensorflow package
    import os
    tf_path = os.path.dirname(tf.__file__)
    # Common location for flex delegate in recent TF
    flex_delegate_path = os.path.join(tf_path, 'lite', 'python', 'interpreter_wrapper', '_pywrap_tensorflow_interpreter_wrapper.pyd')
    if os.path.exists(flex_delegate_path):
        print(f'Found potential flex delegate at: {flex_delegate_path}')
        interpreter = tflite.Interpreter(
            model_path='models/intraday_NSEI15m.tflite',
            experimental_delegates=[tflite.load_delegate(flex_delegate_path)]
        )
        interpreter.allocate_tensors()
        print('Success with explicit delegate load')
    else:
        print('Flex delegate path not found')
except Exception as e:
        print('Failed with explicit delegate load')
        traceback.print_exc()
