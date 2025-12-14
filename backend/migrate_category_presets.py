"""
Migration script to create category_presets table and seed initial data.
Run this once to set up the category presets.
"""
from database import engine, Base, SessionLocal
from models import CategoryPresetDB

def migrate():
    """Create the category_presets table if it doesn't exist."""
    print("Creating category_presets table...")
    Base.metadata.create_all(bind=engine, tables=[CategoryPresetDB.__table__])
    print("Table created successfully!")

def seed_presets():
    """Seed the 7 initial category presets."""
    db = SessionLocal()
    
    presets = [
        {
            "slug": "cinematic",
            "name": "Cinematic",
            "icon": "🎥",
            "description": "Films, courts-métrages, trailers",
            "default_aspect_ratio": "16:9",
            "default_duration": 60,
            "default_language": "French",
            "default_visual_style": "Cinematic",
        },
        {
            "slug": "social_content",
            "name": "Social Content",
            "icon": "📱",
            "description": "Reels, TikToks, YouTube Shorts",
            "default_aspect_ratio": "9:16",
            "default_duration": 30,
            "default_language": "French",
            "default_visual_style": "Bright, Trendy",
        },
        {
            "slug": "advertising",
            "name": "Advertising",
            "icon": "🛒",
            "description": "Pubs produit, brand content",
            "default_aspect_ratio": "16:9",
            "default_duration": 30,
            "default_language": "French",
            "default_visual_style": "Clean, Product-focus",
        },
        {
            "slug": "music",
            "name": "Music",
            "icon": "🎵",
            "description": "Clips musicaux, visualizers",
            "default_aspect_ratio": "16:9",
            "default_duration": 60,
            "default_language": "French",
            "default_visual_style": "Stylized, Abstract",
        },
        {
            "slug": "podcast",
            "name": "Podcast / Talk",
            "icon": "🎙️",
            "description": "Clips de podcast, interviews",
            "default_aspect_ratio": "16:9",
            "default_duration": 60,
            "default_language": "French",
            "default_visual_style": "Minimal, Typography",
        },
        {
            "slug": "tutorial",
            "name": "Tutorial / Explainer",
            "icon": "📚",
            "description": "Tutos, formations, How-to",
            "default_aspect_ratio": "16:9",
            "default_duration": 120,
            "default_language": "French",
            "default_visual_style": "Clean, Educational",
        },
        {
            "slug": "motion_design",
            "name": "Motion Design",
            "icon": "🎨",
            "description": "Motion graphics, animations",
            "default_aspect_ratio": "16:9",
            "default_duration": 30,
            "default_language": "French",
            "default_visual_style": "Graphic, Animated",
        },
    ]
    
    try:
        # Check if presets already exist
        existing = db.query(CategoryPresetDB).first()
        if existing:
            print("Presets already exist, skipping seed.")
            return
        
        for preset_data in presets:
            preset = CategoryPresetDB(**preset_data)
            db.add(preset)
        
        db.commit()
        print(f"Successfully seeded {len(presets)} category presets!")
        
    except Exception as e:
        print(f"Error seeding presets: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
    seed_presets()
