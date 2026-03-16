
import sys

def read_log(filename):
    print(f"\n--- {filename} ---")
    try:
        with open(filename, 'rb') as f:
            content = f.read()
            # Try UTF-16LE first (PowerShell default redirection)
            try:
                text = content.decode('utf-16')
            except:
                # Fallback to UTF-8
                text = content.decode('utf-8', errors='replace')
            print(text)
    except Exception as e:
        print(f"Error reading {filename}: {e}")

read_log('test_pipeline.log')
read_log('test_fracdiff.log')
