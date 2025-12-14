"""
Migration script to add narrative templates to existing category presets.
"""
from database import SessionLocal
from models import CategoryPresetDB
import json

NARRATIVE_TEMPLATES = {
    "advertising": {
        "structure": [
            {"type": "hook", "duration": 3, "description": "Accroche visuelle forte, captiver l'attention"},
            {"type": "problem", "duration": 5, "description": "Présenter un besoin ou problème"},
            {"type": "solution", "duration": 15, "description": "Le produit en action, démonstration"},
            {"type": "cta", "duration": 2, "description": "Call-to-action clair"}
        ],
        "tone": "Persuasif, dynamique",
        "pacing": "Rapide, cuts fréquents"
    },
    "social_content": {
        "structure": [
            {"type": "hook", "duration": 2, "description": "Hook immédiat, question ou statement choc"},
            {"type": "content", "duration": 20, "description": "Contenu principal, valeur ajoutée"},
            {"type": "cta", "duration": 3, "description": "Engagement: like, follow, comment"}
        ],
        "tone": "Authentique, énergique",
        "pacing": "Très rapide, attention courte"
    },
    "cinematic": {
        "structure": [
            {"type": "setup", "duration": 15, "description": "Introduction du monde et des personnages"},
            {"type": "conflict", "duration": 30, "description": "Tension, enjeu central"},
            {"type": "resolution", "duration": 15, "description": "Climax et conclusion"}
        ],
        "tone": "Immersif, émotionnel",
        "pacing": "Mesuré, breathing room"
    },
    "music": {
        "structure": [
            {"type": "intro", "duration": 10, "description": "Build-up visuel, ambiance"},
            {"type": "verse", "duration": 20, "description": "Narration visuelle, mouvement"},
            {"type": "chorus", "duration": 20, "description": "Climax visuel, énergie maximale"},
            {"type": "outro", "duration": 10, "description": "Résolution, fade out"}
        ],
        "tone": "Artistique, expressif",
        "pacing": "Synchronisé à la musique"
    },
    "podcast": {
        "structure": [
            {"type": "intro", "duration": 5, "description": "Logo, titre, présentation rapide"},
            {"type": "content", "duration": 50, "description": "Extrait clé, moment fort"},
            {"type": "outro", "duration": 5, "description": "Teaser pour l'épisode complet"}
        ],
        "tone": "Conversationnel, accessible",
        "pacing": "Modéré, focus sur la parole"
    },
    "tutorial": {
        "structure": [
            {"type": "intro", "duration": 10, "description": "Présentation du problème à résoudre"},
            {"type": "steps", "duration": 90, "description": "Étapes détaillées, screen capture"},
            {"type": "recap", "duration": 20, "description": "Résumé des points clés"}
        ],
        "tone": "Pédagogique, clair",
        "pacing": "Lent, pausé pour compréhension"
    },
    "motion_design": {
        "structure": [
            {"type": "intro", "duration": 5, "description": "Animation du logo ou titre"},
            {"type": "message", "duration": 20, "description": "Animation principale, message clé"},
            {"type": "outro", "duration": 5, "description": "Logo final, tagline"}
        ],
        "tone": "Moderne, graphique",
        "pacing": "Fluide, transitions smooth"
    }
}

def update_narrative_templates():
    """Update existing category presets with narrative templates."""
    print("Updating narrative templates for category presets...")
    
    db = SessionLocal()
    try:
        for slug, template in NARRATIVE_TEMPLATES.items():
            preset = db.query(CategoryPresetDB).filter(CategoryPresetDB.slug == slug).first()
            if preset:
                preset.narrative_template = json.dumps(template, ensure_ascii=False)
                print(f"  [OK] Updated {slug}")
            else:
                print(f"  [SKIP] Preset '{slug}' not found")
        
        db.commit()
        print("All templates updated successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_narrative_templates()
