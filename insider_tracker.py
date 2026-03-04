import requests
import xml.etree.ElementTree as ET
import time
import json
import logging
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# ── LOGGING ──────────────────────────────────────────────────────────────────
logger = logging.getLogger("apex_ai.insider")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s — %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# ── CONFIG ───────────────────────────────────────────────────────────────────
# IMPORTANT: SEC requires a descriptive User-Agent
SEC_USER_AGENT = "ApexAI/1.0 (contact@apexai.local)" 
SEC_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index"
SEC_ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ── REDIS WRAPPER ────────────────────────────────────────────────────────────
try:
    import redis
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
    HAS_REDIS = True
except Exception:
    logger.warning("Redis not found or connection failed. Insider tracker will not cache results.")
    HAS_REDIS = False

# ── FUNCTIONS ────────────────────────────────────────────────────────────────

def fetch_form4_filings(ticker: str, days_back: int = 30) -> List[Dict[str, Any]]:
    """
    Query SEC EDGAR full-text search API for Form 4 filings.
    
    Args:
        ticker: Stock ticker symbol.
        days_back: Number of days to look back for filings.
        
    Returns:
        List of transaction dictionaries.
    """
    ticker = ticker.upper()
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # URL: https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&startdt={start}&enddt={end}&forms=4
    params = {
        "q": f'"{ticker}"',
        "dateRange": "custom",
        "startdt": start_str,
        "enddt": end_str,
        "forms": "4"
    }
    
    headers = {"User-Agent": SEC_USER_AGENT}
    transactions = []
    
    try:
        response = requests.get(SEC_SEARCH_URL, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        hits = data.get("hits", {}).get("hits", [])
        
        for hit in hits:
            source = hit.get("_source", {})
            adsh = source.get("adsh", "")
            ciks = source.get("ciks", [])
            cik = ciks[0] if ciks else None
            
            if not adsh or not cik:
                continue
            
            # Form XML URL: https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{doc}.xml
            accession_path = adsh.replace("-", "")
            
            # The search API hit doesn't always contain the primary document name clearly
            # We check 'file_name' or use a common default
            file_name = source.get("file_name", "")
            if not file_name or not file_name.endswith(".xml"):
                # If file_name is not useful, we might need to find the XML in the directory index
                # but usually we can try form4.xml or the primary document from the adsh
                file_name = "form4.xml" # Common default for Form 4
                
            xml_url = f"{SEC_ARCHIVE_URL}/{int(cik)}/{accession_path}/{file_name}"
            
            # Respect SEC rate limits: 0.1s delay
            time.sleep(0.1)
            
            try:
                xml_resp = requests.get(xml_url, headers=headers, timeout=10)
                if xml_resp.status_code != 200:
                    # Alternative common name if the first guess fails
                    xml_url = f"{SEC_ARCHIVE_URL}/{int(cik)}/{accession_path}/doc1.xml"
                    xml_resp = requests.get(xml_url, headers=headers, timeout=10)
                
                if xml_resp.status_code == 200:
                    parsed_txs = parse_form4_xml(xml_resp.text)
                    transactions.extend(parsed_txs)
                else:
                    logger.debug(f"Could not find XML for {adsh} at {xml_url}")
            except Exception as e:
                logger.error(f"Failed to fetch/parse XML for {adsh}: {e}")
                
        return transactions

    except Exception as e:
        logger.error(f"Failed to fetch filings for {ticker}: {e}")
        return []

def parse_form4_xml(xml_text: str) -> List[Dict[str, Any]]:
    """
    Parses SEC Form 4 XML to extract insider transactions.
    Filters for open-market purchases (P) and sales (S).
    """
    try:
        # Some XMLs have namespaces, some don't. ET handles basic search well.
        root = ET.fromstring(xml_text)
        transactions = []
        
        # Extract metadata
        reporting_owner = root.find(".//reportingOwner")
        owner_name = reporting_owner.find(".//rptOwnerName").text if reporting_owner is not None and reporting_owner.find(".//rptOwnerName") is not None else "Unknown"
        
        rel = root.find(".//reportingOwnerRelationship")
        title = "Insider" 
        if rel is not None:
            if rel.find("isOfficer") is not None and rel.find("isOfficer").text in ["1", "true"]:
                title = rel.find("officerTitle").text if rel.find("officerTitle") is not None else "Officer"
            elif rel.find("isDirector") is not None and rel.find("isDirector").text in ["1", "true"]:
                title = "Director"
            elif rel.find("isTenPercentOwner") is not None and rel.find("isTenPercentOwner").text in ["1", "true"]:
                title = "10% Owner"

        # Look for non-derivative transactions
        for tx in root.findall(".//nonDerivativeTransaction"):
            coding = tx.find(".//transactionCoding")
            if coding is None: continue
            
            tx_type_node = coding.find("transactionCode")
            if tx_type_node is None: continue
            
            tx_code = tx_type_node.text # P = Purchase, S = Sale, A = Award, D = Disposition
            # Filter: only include open-market purchases ('P') and sales ('S')
            if tx_code not in ["P", "S"]:
                continue
                
            date_node = tx.find(".//transactionDate/value")
            amt_node = tx.find(".//transactionAmounts")
            
            if date_node is not None and amt_node is not None:
                shares_node = amt_node.find("transactionShares/value")
                price_node = amt_node.find("transactionPricePerShare/value")
                
                shares = float(shares_node.text) if shares_node is not None and shares_node.text else 0.0
                price = float(price_node.text) if price_node is not None and price_node.text else 0.0
                
                # Ownership type
                nature = tx.find(".//ownershipNature")
                direct_node = nature.find("directOrIndirectOwnership/value") if nature is not None else None
                ownership = direct_node.text if direct_node is not None else "D"
                
                transactions.append({
                    "insider": owner_name,
                    "title": title,
                    "date": date_node.text,
                    "type": tx_code,
                    "shares": shares,
                    "price": price,
                    "value": shares * price,
                    "ownership": ownership
                })
                
        return transactions
    except Exception as e:
        logger.error(f"XML Parsing Error: {e}")
        return []

def calculate_insider_signal(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculates signal metrics from a list of Form 4 transactions.
    """
    # Filter for transactions in the last 30 days for value metrics
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    buy_value = sum(tx["value"] for tx in transactions if tx["type"] == "P" and tx["date"] >= thirty_days_ago)
    sell_value = sum(tx["value"] for tx in transactions if tx["type"] == "S" and tx["date"] >= thirty_days_ago)
    
    # Cluster Buy: True if 3+ different insiders bought in last 14 days
    fourteen_days_ago = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
    recent_buyers = {tx["insider"] for tx in transactions if tx["type"] == "P" and tx["date"] >= fourteen_days_ago}
    
    return {
        "insider_buy_30d": buy_value,
        "insider_sell_30d": sell_value,
        "net_insider_flow": buy_value - sell_value,
        "buy_sell_ratio": buy_value / (buy_value + sell_value + 1),
        "cluster_buy": len(recent_buyers) >= 3,
        "transaction_count": len(transactions)
    }

def interpret_insider_signal(signal_dict: Dict[str, Any]) -> str:
    """
    Returns a human-readable interpretation of the insider signals.
    """
    ratio = signal_dict["buy_sell_ratio"]
    flow = signal_dict["net_insider_flow"]
    cluster = signal_dict["cluster_buy"]
    
    if cluster and flow > 1000000:
        return "STRONG: Multiple executives buying — historically bullish"
    elif ratio > 0.7:
        return "MODERATE: Net insider accumulation this month"
    elif ratio < 0.3 and flow < -1000000: # Threshold for "significant" selling
        return "CAUTION: Net insider selling — potential distribution"
    elif signal_dict["transaction_count"] == 0:
        return "NEUTRAL: No recent insider activity (Form 4)"
    else:
        return "NEUTRAL: Minimal or balanced insider activity"

def get_insider_summary(ticker: str) -> Dict[str, Any]:
    """
    Main entry point for the insider tracker module with Redis caching.
    
    Example Output (AAPL):
    {
        "ticker": "AAPL",
        "metrics": {
            "insider_buy_30d": 0.0,
            "insider_sell_30d": 12450000.0,
            "net_insider_flow": -12450000.0,
            "buy_sell_ratio": 0.0,
            "cluster_buy": false,
            "transaction_count": 5
        },
        "interpretation": "CAUTION: Net insider selling — potential distribution",
        "last_updated": "2024-03-04T12:00:00"
    }
    """
    ticker = ticker.upper()
    cache_key = f"insider:v1:{ticker}"
    
    if HAS_REDIS:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Redis get failed: {e}")
            
    # Fetch and process
    txs = fetch_form4_filings(ticker)
    metrics = calculate_insider_signal(txs)
    interpretation = interpret_insider_signal(metrics)
    
    summary = {
        "ticker": ticker,
        "metrics": metrics,
        "interpretation": interpretation,
        "last_updated": datetime.now().isoformat()
    }
    
    if HAS_REDIS:
        try:
            # Cache for 12 hours (43200 seconds)
            redis_client.setex(cache_key, 43200, json.dumps(summary))
        except Exception as e:
            logger.error(f"Redis set failed: {e}")
        
    return summary

if __name__ == "__main__":
    # Test script for NVDA
    print(f"--- Fetching Insider Trading Activity for NVDA ---")
    data = get_insider_summary("NVDA")
    print(json.dumps(data, indent=4))
