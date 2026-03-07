import tensorflow as tf
import traceback

model_path = 'models/intraday_NSEI15m.tflite'

for resolver_type in [tf.lite.OpResolverType.AUTO, tf.lite.OpResolverType.BUILTIN, tf.lite.OpResolverType.BUILTIN_REF, tf.lite.OpResolverType.BUILTIN_WITHOUT_DEFAULT_DELEGATES]:
    print(f"\nTesting resolver: {resolver_type}")
    try:
        interpreter = tf.lite.Interpreter(
            model_path=model_path,
            experimental_op_resolver_type=resolver_type
        )
        interpreter.allocate_tensors()
        print(f"SUCCESS with {resolver_type}")
        break
    except Exception as e:
        print(f"FAILED with {resolver_type}: {e}")
        # traceback.print_exc()
