import os

def search_flex(root_dir):
    print(f"Searching for 'flex' in {root_dir}...")
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(('.py', '.pyi', '.pyd', '.dll')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'rb') as f:
                        if b'flex' in f.read().lower():
                            print(f"MATCH: {path}")
                except:
                    pass

search_flex('d:/AI-Stock-market-prediction-master/AI-Stock-market-prediction-master/venv/Lib/site-packages/tensorflow/lite')
search_flex('d:/AI-Stock-market-prediction-master/AI-Stock-market-prediction-master/venv/Lib/site-packages/ai_edge_litert')
