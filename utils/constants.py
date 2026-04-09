TICKER_LIST = {
    "Large Cap / Nifty 50": [
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
        "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS",
        "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS",
        "ULTRACEMCO.NS", "NESTLEIND.NS", "WIPRO.NS", "HCLTECH.NS", "BAJFINANCE.NS",
        "BAJAJFINSV.NS", "TECHM.NS", "SUNPHARMA.NS", "ONGC.NS", "NTPC.NS",
        "POWERGRID.NS", "COALINDIA.NS", "JSWSTEEL.NS", "TATASTEEL.NS", "ADANIENT.NS",
    ],
    "Mid Cap": [
        "PERSISTENT.NS", "COFORGE.NS", "MPHASIS.NS", "LTIM.NS", "TATAELXSI.NS",
        "PIIND.NS", "ALKEM.NS", "TORNTPHARM.NS", "ABFRL.NS", "INDHOTEL.NS",
        "ZOMATO.NS", "NYKAA.NS", "POLICYBZR.NS", "PAYTM.NS", "DELHIVERY.NS",
    ],
    "Banking & Finance": [
        "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS",
        "INDUSINDBK.NS", "BANDHANBNK.NS", "FEDERALBNK.NS", "IDFCFIRSTB.NS",
        "PNB.NS", "BANKBARODA.NS", "CANBK.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS",
        "CHOLAFIN.NS", "MANAPPURAM.NS", "MUTHOOTFIN.NS", "SHRIRAMFIN.NS", "LICHSGFIN.NS",
        "PFC.NS", "RECLTD.NS",
    ],
    "IT": [
        "TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS",
        "PERSISTENT.NS", "COFORGE.NS", "MPHASIS.NS", "LTIM.NS", "TATAELXSI.NS",
        "KPITTECH.NS", "ROUTE.NS", "CYIENT.NS", "ZENTEC.NS", "SONATSOFTW.NS",
    ],
    "Pharma": [
        "SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "BIOCON.NS",
        "AUROPHARMA.NS", "LUPIN.NS", "TORNTPHARM.NS", "ALKEM.NS", "PIIND.NS",
        "APOLLOHOSP.NS", "FORTIS.NS", "MAXHEALTH.NS", "GLENMARK.NS", "LAURUSLABS.NS",
        "ZYDUSLIFE.NS", "IPCALAB.NS",
    ],
    "Auto": [
        "MARUTI.NS", "TMCV.NS", "M&M.NS", "BAJAJ-AUTO.NS", "HEROMOTOCO.NS",
        "EICHERMOT.NS", "ASHOKLEY.NS", "TVSMOTOR.NS", "MOTHERSON.NS", "BALKRISIND.NS",
    ],
    "Oil & Energy": [
        "RELIANCE.NS", "ONGC.NS", "IOC.NS", "BPCL.NS", "GAIL.NS",
        "NTPC.NS", "POWERGRID.NS", "TATAPOWER.NS", "ADANIGREEN.NS", "ADANIPORTS.NS",
        "HPCL.NS", "OIL.NS", "PETRONET.NS", "SJVN.NS", "NHPC.NS",
    ],
    "Metals & Mining": [
        "TATASTEEL.NS", "JSWSTEEL.NS", "HINDALCO.NS", "VEDL.NS", "NATIONALUM.NS",
        "SAIL.NS", "NMDC.NS", "COALINDIA.NS",
    ],
    "FMCG": [
        "HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS", "BRITANNIA.NS", "DABUR.NS",
        "MARICO.NS", "COLPAL.NS", "GODREJCP.NS", "EMAMILTD.NS", "TATACONSUM.NS",
        "VBL.NS", "TRENT.NS", "JSL.NS", "NYKAA.NS",
    ],
    "Indices & ETFs": [
        "^NSEI", "^BSESN", "NIFTYBEES.NS", "BANKBEES.NS", "JUNIORBEES.NS",
    ],
    "Crypto (via yfinance)": [
        "BTC-USD", "ETH-USD", "BNB-USD",
    ],
}

# Flat list for multiselect
ALL_TICKERS = [t for sector in TICKER_LIST.values() for t in sector]

DEFAULT_SUGGESTIONS = ["RELIANCE.NS", "INFY.NS", "ICICIBANK.NS", "HDFCBANK.NS", "TCS.NS"]

TIMEFRAME_CONFIG = {
    "1m":  {"interval": "1m",  "period": "5d",   "bars": 300, "label": "1-Min Scalp"},
    "5m":  {"interval": "5m",  "period": "10d",  "bars": 250, "label": "5-Min Scalp"},
    "15m": {"interval": "15m", "period": "20d",  "bars": 200, "label": "15-Min Swing"},
    "30m": {"interval": "30m", "period": "30d",  "bars": 180, "label": "30-Min Swing"},
    "1h":  {"interval": "1h",  "period": "60d",  "bars": 160, "label": "Hourly Swing"},
    "4h":  {"interval": "60m", "period": "120d", "bars": 140, "label": "4H Position"},
    "1D":  {"interval": "1d",  "period": "1y",   "bars": 252, "label": "Daily Swing"},
    "1W":  {"interval": "1wk", "period": "5y",   "bars": 200, "label": "Weekly Position"},
}

# Top-20 NSE stocks — used by the async screener in main.py
NSE_SCREENER_TICKERS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "BHARTIARTL.NS",
    "SBIN.NS", "INFY.NS", "ITC.NS", "HINDUNILVR.NS", "LT.NS",
    "BAJFINANCE.NS", "HCLTECH.NS", "MARUTI.NS", "SUNPHARMA.NS", "ONGC.NS",
    "TMCV.NS", "NTPC.NS", "KOTAKBANK.NS", "TITAN.NS", "WIPRO.NS",
]

