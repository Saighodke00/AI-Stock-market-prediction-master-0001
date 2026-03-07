import traceback
import sys
import ai_edge_litert.interpreter as tflite
print('ai_edge_litert version:', tflite.__version__ if hasattr(tflite, '__version__') else 'N/A')
try:
    interpreter = tflite.Interpreter(model_path='models/intraday_NSEI15m.tflite', experimental_op_resolver_type=tflite.OpResolverType.BUILTIN_REF)
    interpreter.allocate_tensors()
    print('Success')
except Exception as e:
    print('Exception:')
    traceback.print_exc()
