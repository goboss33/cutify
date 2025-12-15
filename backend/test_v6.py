"""
Test script to debug Pipeline V6
"""
import asyncio
from database import SessionLocal
from services.pipeline_v6 import run_pipeline_v6

async def test():
    db = SessionLocal()
    
    try:
        print("Testing Pipeline V6...")
        
        inputs = {
            "title": "Test Project",
            "pitch": "A short test video",
            "visual_style": "Cinematic",
            "duration_seconds": 60,
            "language": "French",
            "detected_tags": [],
            "user_answers": {}
        }
        
        result = await run_pipeline_v6(
            project_id=1,  # Use existing project
            video_type="cinematic",
            inputs=inputs,
            existing_assets=[],
            db=db
        )
        
        print(f"Success! Result: {result.keys()}")
        
    except Exception as e:
        import traceback
        print(f"ERROR: {type(e).__name__}: {e}")
        traceback.print_exc()
    finally:
        db.close()

asyncio.run(test())
