import os
import re

target_dir = r"d:\AI-Stock-market-prediction-master\AI-Stock-market-prediction-master\frontend\src"
pattern = re.compile(r"http://localhost:8000/api")
replacement = "/api"

for root, dirs, files in os.walk(target_dir):
    for file in files:
        if file.endswith((".tsx", ".ts")):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            if pattern.search(content):
                new_content = pattern.sub(replacement, content)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated: {path}")
