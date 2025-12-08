from PIL import Image
import os

shots_dir = "static/shots"
files = os.listdir(shots_dir)

print(f"Found {len(files)} files in {shots_dir}")

for f in sorted(files):
    if f.endswith(".png"):
        path = os.path.join(shots_dir, f)
        img = Image.open(path)
        print(f"{f}: {img.size} mode={img.mode} format={img.format}")
