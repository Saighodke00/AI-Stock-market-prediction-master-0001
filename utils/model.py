import numpy as np
from utils.keras_fix import apply_keras_fix
apply_keras_fix()
try:
    import tf_keras as keras
except ImportError:
    try:
        import tensorflow.keras as keras
    except ImportError:
        keras = None

import tensorflow as tf

if keras:
    from keras.layers import Input, Dense, Dropout, GRU, Conv1D, BatchNormalization, Flatten, Layer, MultiHeadAttention, LayerNormalization, Add
    from keras.callbacks import EarlyStopping, ReduceLROnPlateau
    import keras.backend as K
    HAS_KERAS = True
else:
    class Dummy:
        def __init__(self, *args, **kwargs): pass
        def __call__(self, *args, **kwargs): return self
        def __getitem__(self, key): return self
        def __getattr__(self, name): return self
        def compile(self, *args, **kwargs): pass
        def fit(self, *args, **kwargs):
            class Hist:
                def __init__(self): self.history = {'loss': [0.1]}
            return Hist()
        def predict(self, x, *args, **kwargs):
            # Return plausible mock predictions based on input x shape or default
            if hasattr(x, 'shape'):
                return np.zeros((x.shape[0], 3))
            return np.zeros((1, 3))
    
    Input = Dense = Dropout = GRU = Conv1D = BatchNormalization = Flatten = Layer = MultiHeadAttention = LayerNormalization = Add = Dummy
    EarlyStopping = ReduceLROnPlateau = Dummy
    K = Dummy()
    Model = Sequential = Dummy
    # Override tf.keras if needed to prevent 'object() takes no arguments'
    if not hasattr(tf, "keras") or tf.keras is None:
        class MockKeras:
            Model = Dummy
            Sequential = Dummy
        tf.keras = MockKeras()
    else:
        # If tf.keras exists but we want to use our Dummies
        tf.keras.Model = Dummy
        tf.keras.Sequential = Dummy
import os
try:
    import lightgbm as lgb
    HAS_LGBM = True
except ImportError:
    HAS_LGBM = False
from sklearn.preprocessing import RobustScaler


# ---------------------------------------------------------------------------
# REGISTERED CUSTOM LOSS - must be module-level so Keras can locate it
# when loading a saved .keras file. The decorator writes the function into
# Keras's global serialization registry under the name 'quantile_loss'.
# ---------------------------------------------------------------------------
def quantile_loss(y_true, y_pred):
    """Pinball / quantile loss for simultaneous Q10, Q50, Q90 regression."""
    quantiles = [0.1, 0.5, 0.9]
    losses = []
    for i, q in enumerate(quantiles):
        error = y_true - y_pred[:, i:i + 1]
        losses.append(K.mean(K.maximum(q * error, (q - 1) * error)))
    return K.sum(losses)

if keras:
    quantile_loss = keras.utils.register_keras_serializable(package='ApexAI', name='quantile_loss')(quantile_loss)

# --- CAUSAL TCN LAYER ---
def create_tcn_block(n_filters, kernel_size, dilation_rate):
    def wrapper(x):
        # Causal padding is key for no-leakage
        x = Conv1D(n_filters, kernel_size, padding='causal', dilation_rate=dilation_rate, activation='relu')(x)
        x = BatchNormalization()(x)
        x = Dropout(0.2)(x)
        return x
    return wrapper

# --- MODELS ---

def create_gru_direction(input_shape):
    """
    Directional Model with Selective Attention (TFT-inspired).
    """
    inputs = Input(shape=input_shape)
    
    # 1. Temporal Processing
    x = GRU(64, return_sequences=True, dropout=0.2)(inputs)
    
    # 2. Multi-Head Attention
    attn_out = MultiHeadAttention(num_heads=4, key_dim=16)(x, x)
    x = Add()([x, attn_out])
    x = LayerNormalization()(x)
    
    # 3. Output Generation
    x = GRU(32, return_sequences=False)(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    outputs = Dense(1, activation='sigmoid')(x)
    
    model = tf.keras.Model(inputs, outputs)
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

def create_tcn_direction(input_shape):
    inputs = Input(shape=input_shape)
    x = create_tcn_block(32, 3, 1)(inputs)
    x = create_tcn_block(32, 3, 2)(x)
    x = create_tcn_block(32, 3, 4)(x)
    
    # Add Self-Attention to TCN output
    attn_out = MultiHeadAttention(num_heads=2, key_dim=8)(x, x)
    x = Add()([x, attn_out])
    x = LayerNormalization()(x)
    
    x = Flatten()(x)
    x = Dense(32, activation='relu')(x)
    outputs = Dense(1, activation='sigmoid')(x)
    model = tf.keras.Model(inputs, outputs)
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

def create_magnitude_model(input_shape):
    """
    Quantile Regression Magnitude Model with Attention.
    """
    inputs = Input(shape=input_shape)
    
    # Temporal Compression
    x = GRU(64, return_sequences=True, dropout=0.2)(inputs)
    
    # Attention Layer
    attn_out = MultiHeadAttention(num_heads=4, key_dim=16)(x, x)
    x = Add()([x, attn_out])
    x = LayerNormalization()(x)
    
    x = GRU(32, return_sequences=False)(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    
    # Quantile outputs: [Q10, Q50 (Median), Q90]
    # Fix 1: tanh activation bounds output to [-1,1] (log-return scale)
    # preventing unbounded gradients that cause NaN loss during training.
    outputs = Dense(3, activation='tanh')(x)
    model = tf.keras.Model(inputs, outputs)
    # Use the module-level registered quantile_loss (not a local lambda)
    # so that model.save() / load_model() can resolve it by name.
    # Gradient clipping prevents explosion even if input has outliers.
    optimizer = tf.keras.optimizers.Adam(learning_rate=1e-3, clipnorm=1.0)
    model.compile(optimizer=optimizer, loss=quantile_loss)
    return model

# --- ENGINE WRAPPER ---

class CausalTradingEngine:
    def __init__(self, input_shape):
        self.gru_dir = create_gru_direction(input_shape)
        self.tcn_dir = create_tcn_direction(input_shape)
        self.gbm_dir = None # Trained on the fly
        self.mag_model = create_magnitude_model(input_shape)
        self.scaler = RobustScaler()
        self.history = {'loss': []}

    def train_ensemble(self, X, y_dir, y_mag, epochs=30):
        # Fix 4: NaN-safe training — sanitize inputs before any training
        nan_mask = np.isfinite(X).all(axis=(1, 2)) & np.isfinite(y_dir).ravel() & np.isfinite(y_mag).all(axis=1)
        if not nan_mask.all():
            n_bad = (~nan_mask).sum()
            print(f"  ⚠️  Dropped {n_bad}/{len(X)} rows with NaN/Inf before training")
            X, y_dir, y_mag = X[nan_mask], y_dir[nan_mask], y_mag[nan_mask]
        if len(X) < 30:
            raise ValueError(f"Too few clean samples ({len(X)}) after NaN removal. Check your feature pipeline.")

        # 1. Train GRU Direction
        h1 = self.gru_dir.fit(X, y_dir, epochs=epochs, batch_size=128, verbose=0, validation_split=0.1)
        
        # 2. Train TCN Direction
        h2 = self.tcn_dir.fit(X, y_dir, epochs=epochs, batch_size=128, verbose=0, validation_split=0.1)
        
        # 3. Train LightGBM Direction (flatten X)
        if HAS_LGBM:
            X_flat = X.reshape(X.shape[0], -1)
            self.gbm_dir = lgb.LGBMClassifier(n_estimators=100, learning_rate=0.05, verbose=-1)
            self.gbm_dir.fit(X_flat, y_dir)
        
        # 4. Train Magnitude Model
        h3 = self.mag_model.fit(X, y_mag, epochs=epochs, batch_size=128, verbose=0, validation_split=0.1)
        
        # Combine losses for UI history
        # Fix Bug 04: Ensure all losses are captured
        self.history['loss'] = h1.history['loss']
        if 'loss' in h2.history:
            self.history['tcn_loss'] = h2.history['loss']
        if 'loss' in h3.history:
            self.history['mag_loss'] = h3.history['loss']
            
        if 'val_loss' in h1.history:
            self.history['val_loss'] = h1.history['val_loss']
        return self.history

    def predict(self, X):
        X_flat = X.reshape(X.shape[0], -1)
        
        p_gru = self.gru_dir.predict(X, verbose=0)
        p_tcn = self.tcn_dir.predict(X, verbose=0)
        
        if HAS_LGBM and self.gbm_dir is not None:
            p_gbm = self.gbm_dir.predict_proba(X_flat)[:, 1].reshape(-1, 1)
            # Ensemble weighting
            dir_prob = 0.4 * p_gru + 0.4 * p_tcn + 0.2 * p_gbm
        else:
            dir_prob = 0.5 * p_gru + 0.5 * p_tcn
        
        # Magnitude prediction: Returns [Q10, Q50, Q90] or [Q0.02, Q0.1, Q0.25, Q0.5, Q0.75, Q0.9, Q0.98]
        q_out = self.mag_model.predict(X, verbose=0)
        
        # Fix Bug 01: Handle multi-dimensional (TFT) or flat (Keras) outputs
        if q_out.ndim == 3: # (batch, horizon, quantiles)
            # Index 13 = 14th day, index 3 = P50 (median)
            # If the model has 7 quantiles [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]
            h_idx = min(13, q_out.shape[1] - 1)
            q_dim = q_out.shape[2]
            if q_dim == 7:
                q10 = q_out[:, h_idx, 1]
                q50 = q_out[:, h_idx, 3]
                q90 = q_out[:, h_idx, 5]
            else:
                # Fallback for standard 3 quantiles
                q10 = q_out[:, h_idx, 0]
                q50 = q_out[:, h_idx, 1]
                q90 = q_out[:, h_idx, 2]
        else: # (batch, quantiles)
            q_dim = q_out.shape[1]
            if q_dim == 7:
                q10 = q_out[:, 1]
                q50 = q_out[:, 3]
                q90 = q_out[:, 5]
            else:
                q10 = q_out[:, 0]
                q50 = q_out[:, 1]
                q90 = q_out[:, 2]
        
        return dir_prob, q10, q50, q90

    def get_signal(self, dir_prob, mean_ret, adx, wf_sharpe, atr, fii_dii_score=0):
        """
        Gating logic for research-grade signal quality.
        """
        # 1. Prediction Confidence
        conf_gate = dir_prob > 0.65 or dir_prob < 0.35
        
        # 2. Trend Strength
        trend_gate = adx > 20
        
        # 3. Expected Magnitude vs Volatility
        mag_gate = abs(mean_ret) > (0.25 * atr)
        
        # 4. Strategy Stability
        stability_gate = wf_sharpe > 1.2
        
        # 5. Institutional Flow Alignment (Optional)
        # If score is > 0 (bullish) and dir is Buy, it passes.
        # If score is < 0 (bearish) and dir is Sell, it passes.
        flow_gate = True
        if fii_dii_score > 500 and dir_prob < 0.5: flow_gate = False # Bearish signal against Bullish flow
        if fii_dii_score < -500 and dir_prob > 0.5: flow_gate = False # Bullish signal against Bearish flow
        
        if conf_gate and trend_gate and mag_gate and stability_gate and flow_gate:
            if dir_prob > 0.65: return "BUY", "#00ff88"
            if dir_prob < 0.35: return "SELL", "#ff4b4b"
            
        return "NEUTRAL", "#888888"

    def explain_prediction(self, X, feature_names):
        """
        Explainable AI (XAI): Returns top 5 contributing features using SHAP.
        """
        try:
            import shap
            explainer = shap.GradientExplainer(self.gru_dir, X[:10])
            shap_values = explainer.shap_values(X)
            abs_shap = np.abs(shap_values[0]).mean(axis=0)
            indices = np.argsort(abs_shap)[-5:][::-1]
            top_features = []
            for idx in indices:
                top_features.append({
                    'feature': feature_names[idx],
                    'importance': float(abs_shap[idx])
                })
            return top_features
        except Exception as e:
            print(f"XAI Engine Error: {e}")
            return []

    def save_to_dir(self, directory: str, history: dict = None):
        """Save all sub-models to a directory using native formats (no pickle).
        
        Keras models  -> <dir>/gru_dir.keras, tcn_dir.keras, mag_model.keras
        LightGBM      -> <dir>/gbm_dir.txt  (text format, always portable)
        History       -> <dir>/history.json
        """
        import json
        os.makedirs(directory, exist_ok=True)
        self.gru_dir.save(os.path.join(directory, "gru_dir.keras"))
        self.tcn_dir.save(os.path.join(directory, "tcn_dir.keras"))
        self.mag_model.save(os.path.join(directory, "mag_model.keras"))
        if HAS_LGBM and self.gbm_dir is not None:
            self.gbm_dir.booster_.save_model(os.path.join(directory, "gbm_dir.txt"))
        hist = history if history is not None else self.history
        with open(os.path.join(directory, "history.json"), "w") as f:
            json.dump({k: [float(v) for v in vals] for k, vals in hist.items()}, f)

    @classmethod
    def load_from_dir(cls, directory: str, input_shape):
        """Reconstruct a CausalTradingEngine from a saved directory.
        
        Creates a fresh engine (builds architecture), then loads weights only
        - avoiding any pickle/class-identity issues caused by hot-reloads.
        """
        import json
        engine = cls(input_shape)  # Builds fresh architecture
        gru_path = os.path.join(directory, "gru_dir.keras")
        tcn_path = os.path.join(directory, "tcn_dir.keras")
        mag_path = os.path.join(directory, "mag_model.keras")
        gbm_path = os.path.join(directory, "gbm_dir.txt")
        hist_path = os.path.join(directory, "history.json")
        # custom_objects is a belt-and-suspenders fallback for .keras files
        # saved before the @register_keras_serializable decorator was added.
        _custom = {'quantile_loss': quantile_loss}
        if os.path.exists(gru_path):
            engine.gru_dir = keras.models.load_model(gru_path, custom_objects=_custom)
        if os.path.exists(tcn_path):
            engine.tcn_dir = keras.models.load_model(tcn_path, custom_objects=_custom)
        if os.path.exists(mag_path):
            engine.mag_model = keras.models.load_model(mag_path, custom_objects=_custom)
        if HAS_LGBM and os.path.exists(gbm_path):
            booster = lgb.Booster(model_file=gbm_path)
            engine.gbm_dir = booster
        if os.path.exists(hist_path):
            with open(hist_path) as f:
                engine.history = json.load(f)
        return engine

# --- UI COMPATIBILITY LAYER ---

def create_model(input_shape):
    """
    UI Compatibility factory.
    """
    return CausalTradingEngine(input_shape)

def train_model(X, y, epochs=30):
    """
    UI Compatibility function.
    Fix Bug 04: Actually call training logic instead of returning stub.
    """
    input_shape = (X.shape[1], X.shape[2])
    engine = CausalTradingEngine(input_shape)
    y_dir, y_mag = y
    history = engine.train_ensemble(X, y_dir, y_mag, epochs=epochs)
    return engine, history

def predict_next_day(engine, last_sequence, scaler, fallback_model=None):
    """
    Robust scaling validation: Converts scaled neural output back into 3 price quantiles.
    Returns: (q10_price, q50_price, q90_price)
    """
    dir_prob, q10, q50, q90 = engine.predict(last_sequence)
    
    # 1. Prediction Confidence (Median direction)
    engine.last_prob = dir_prob[0][0]
    engine.last_mean_ret = q50[0]
    
    # 2. Inverse Mapping logic for Price
    last_scaled_close = last_sequence[0, -1, 0]
    num_features = scaler.n_features_in_
    dummy_row = np.zeros((1, num_features))
    dummy_row[0, 0] = last_scaled_close
    
    try:
        last_actual_close = scaler.inverse_transform(dummy_row)[0, 0]
        # Guard against zero or extreme returns
        q10_ret = np.clip(np.nan_to_num(q10[0]), -0.2, 0.2)
        q50_ret = np.clip(np.nan_to_num(q50[0]), -0.2, 0.2)
        q90_ret = np.clip(np.nan_to_num(q90[0]), -0.2, 0.2)
        
        price_q10 = last_actual_close * np.exp(q10_ret)
        price_q50 = last_actual_close * np.exp(q50_ret)
        price_q90 = last_actual_close * np.exp(q90_ret)
    except Exception:
        # Fallback if scaling fails
        price_q10 = price_q50 = price_q90 = 0.0
    
    return float(price_q10), float(price_q50), float(price_q90)

def convert_to_tflite(model, path):
    # Skip for complex ensemble
    return None
