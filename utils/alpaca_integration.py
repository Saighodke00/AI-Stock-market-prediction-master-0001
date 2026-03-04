import os
import logging
from typing import Optional

try:
    import alpaca_trade_api as tradeapi
    from alpaca_trade_api.rest import TimeFrame
    HAS_ALPACA = True
except ImportError:
    HAS_ALPACA = False

logger = logging.getLogger("apex_ai.alpaca")

# Default to paper trading
ALPACA_API_KEY = os.getenv("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY", "")
ALPACA_BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

class AlpacaClient:
    def __init__(self):
        self.enabled = False
        self.api = None
        if HAS_ALPACA and ALPACA_API_KEY and ALPACA_SECRET_KEY:
            try:
                self.api = tradeapi.REST(
                    key_id=ALPACA_API_KEY,
                    secret_key=ALPACA_SECRET_KEY,
                    base_url=ALPACA_BASE_URL,
                    api_version='v2'
                )
                account = self.api.get_account()
                logger.info(f"Alpaca initialized. Account status: {account.status}. Balance: ${account.equity}")
                self.enabled = True
            except Exception as e:
                logger.error(f"Failed to initialize Alpaca: {e}")
        else:
            logger.warning("Alpaca not initialized (missing API keys or module).")

    def execute_trade(self, action: str, ticker: str, confidence: float, current_price: float) -> dict:
        """Execute algorithmic trade based on signal action and confidence."""
        if not self.enabled or not self.api:
            return {"status": "skipped", "reason": "Alpaca integration disabled or missing keys."}
            
        action = action.upper()
        if action not in ["BUY", "SELL"]:
            return {"status": "skipped", "reason": f"No action taken for {action}"}
            
        try:
            # Simple position sizing: e.g., max 5% of buying power per trade, adjusted by confidence
            account = self.api.get_account()
            buying_power = float(account.buying_power)
            
            # Risk/Position Sizing logic
            max_capital_per_trade = buying_power * 0.05 
            # E.g confidence is 0-1, scale allocation between 1% and 5% based on confidence
            allocation = max_capital_per_trade * confidence
            
            qty = int(allocation // current_price)
            
            if qty <= 0:
                return {"status": "rejected", "reason": "Insufficient buying power for minimum allocation."}

            if action == "SELL":
                # Check if we own it, and close if possible
                try:
                    position = self.api.get_position(ticker)
                    qty_owned = int(position.qty)
                    # If we own it, liquidate up to the desired qty (for simplicity, we just liquidate all here as demo)
                    order = self.api.submit_order(
                        symbol=ticker,
                        qty=qty_owned,
                        side='sell',
                        type='market',
                        time_in_force='day'
                    )
                    return {"status": "success", "order_id": order.id, "action": "LIQUIDATE", "qty": qty_owned}
                except Exception:
                    # Not found -> perhaps initiating a short position depending on account permissions
                    return {"status": "skipped", "reason": f"No existing position to sell for {ticker}."}

            # BUY order
            if action == "BUY":
                order = self.api.submit_order(
                    symbol=ticker,
                    qty=qty,
                    side='buy',
                    type='market',
                    time_in_force='day'
                )
                return {"status": "success", "order_id": order.id, "action": "BUY", "qty": qty}
                
        except Exception as e:
            logger.exception("Failed to execute Alpaca trade.")
            return {"status": "error", "reason": str(e)}

        return {"status": "skipped", "reason": "Unknown condition."}

alpaca_client = AlpacaClient()
