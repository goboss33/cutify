import os
from dotenv import load_dotenv
from pathlib import Path

# Load env FIRST
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from PIL import Image, ImageDraw
from services.image_processor import upload_to_supabase, supabase

def test_upload():
    print("Testing Supabase Storage Upload...")
    
    if not supabase:
        print("FAIL: Supabase client not initialized (check keys)")
        return

    # Create dummy image
    img = Image.new('RGB', (100, 100), color = 'red')
    d = ImageDraw.Draw(img)
    d.text((10,10), "Test", fill=(255,255,255))
    
    filename = "test_upload_verify.png"
    
    try:
        url = upload_to_supabase(img, filename)
        if url:
            print(f"SUCCESS! Uploaded to: {url}")
        else:
            print("FAILED: No URL returned (Upload might have failed silently check logs)")
            
    except Exception as e:
        print(f"CRASH: {e}")

if __name__ == "__main__":
    test_upload()
