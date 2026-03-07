import os

def find_large_binaries(root_dir, size_limit_mb=5):
    print(f"Searching for binaries > {size_limit_mb}MB in {root_dir}...")
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(('.dll', '.pyd')):
                path = os.path.join(root, file)
                try:
                    size_mb = os.path.getsize(path) / (1024 * 1024)
                    if size_mb > size_limit_mb:
                        print(f"{path}: {size_mb:.2f} MB")
                except:
                    pass

find_large_binaries('d:/AI-Stock-market-prediction-master/AI-Stock-market-prediction-master/venv/Lib/site-packages/tensorflow')
find_large_binaries('d:/AI-Stock-market-prediction-master/AI-Stock-market-prediction-master/venv/Lib/site-packages/ai_edge_litert')
