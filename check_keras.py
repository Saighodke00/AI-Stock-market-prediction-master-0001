import sys
try:
    import tensorflow as tf
    print(f"TensorFlow version: {tf.__version__}")
except ImportError:
    print("TensorFlow not installed")

try:
    import keras
    print(f"Keras version: {keras.__version__}")
    from keras import Model
    print(f"Model class: {Model}")
    # Try to find Functional
    try:
        from keras.src.models.functional import Functional
        print(f"Found Functional in keras.src: {Functional}")
    except:
        print("Functional not in keras.src")
    
    # Check registration
    import keras
    print(f"Custom objects before: {list(keras.saving.get_custom_objects().keys())[:10]}")
    
    try:
        from keras.src.models.functional import Functional
        keras.saving.get_custom_objects()["Functional"] = Functional
        print("Registered Functional successfully")
    except Exception as e:
        print(f"Registration failed: {e}")
        
    print(f"Custom objects after: {list(keras.saving.get_custom_objects().keys())[:10]}")
    
    # Check if tf.keras sees it too
    import tensorflow as tf
    try:
        print(f"tf.keras custom objects: {list(tf.keras.utils.get_custom_objects().keys())[:10]}")
    except:
        print("tf.keras.utils.get_custom_objects not found")
except ImportError:
    print("Keras not installed")

try:
    import tf_keras
    print(f"tf_keras version: {tf_keras.__version__}")
except ImportError:
    print("tf_keras not installed")
