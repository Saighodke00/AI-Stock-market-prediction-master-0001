"""
Keras Legacy Fix Utility
------------------------
Resolves: "Could not locate class 'Functional'" error in TensorFlow 2.16+ (Keras 3).
This happens when loading models saved with the Functional API in older Keras versions.
"""

import logging

logger = logging.getLogger("apex.keras_fix")

def apply_keras_fix():
    try:
        import tensorflow as tf
        
        # Strategy 1: If tf_keras is available, it is the most reliable for Keras 2 models
        try:
            import tf_keras
            # We can't easily force tf.keras to be tf_keras globally here,
            # but we can ensure it's used in utils/model.py (handled there).
        except ImportError:
            pass

        # Strategy 2: Patch Keras 3 to recognize 'Functional' and ignore incompatible keywords
        import keras
        custom_objects = keras.saving.get_custom_objects()
        
        if "Functional" not in custom_objects:
            try:
                from keras.src.models.functional import Functional
            except ImportError:
                Functional = keras.Model
            custom_objects["Functional"] = Functional
            logger.info("Registered 'Functional' class.")

        # Strategy 3: Handle keyword mismatches like 'time_major' in GRU
        # This is more complex but we can try to patch the loading logic if needed.
        # For now, registering Functional is the most critical part for the reported error.
            
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"Failed to apply Keras legacy fix: {e}")

# Auto-apply on import
apply_keras_fix()
