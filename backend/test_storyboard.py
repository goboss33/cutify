import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path

# Load env FIRST
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from services.director import generate_storyboard

async def test():
    print("Testing Storyboard Generation...")
    
    script = "EXT. FOREST - DAY. A small fox looks up at a crow holding a cheese."
    context = {"visual_style": "Pixar 3D", "genre": "Fable"}
    
    try:
        result = await generate_storyboard(script, context)
        if result:
            print("Success! Image bytes received.")
        else:
            print("Failed: No image bytes returned.")
    except Exception as e:
        print(f"CRASH: {e}")

if __name__ == "__main__":
    asyncio.run(test())
