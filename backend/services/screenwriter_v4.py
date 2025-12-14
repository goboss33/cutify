"""
Screenwriter V4 Service
Generates scenes using JSON-structured prompts with all context from previous pipeline stages.
"""
import json
import google.generativeai as genai
import os
from services.ai_logger import AILogger

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp', generation_config={"response_mime_type": "application/json"})


async def generate_scenes_v4(
    project_id: int,
    title: str,
    pitch: str,
    context: dict,
    scene_plan: list,
    asset_mapping: dict
) -> dict:
    """
    Generates scenes using the complete pipeline context.
    """
    
    # Extract context
    visual_style = context.get("fused_visual_style", "Cinematic")
    tone = context.get("tone", "Neutre")
    pacing = context.get("pacing", "Modéré")
    language = context.get("language", "French")
    target_duration = context.get("target_duration_seconds", 60)
    audience = context.get("target_audience", "Grand public")
    
    # Build scene plan string
    scene_plan_str = ""
    if scene_plan:
        for s in scene_plan:
            scene_plan_str += f"\n- Scène {s.get('index', 1)}: {s.get('type', 'scene')} ({s.get('duration_seconds', 15)}s) - {s.get('purpose', '')}"
    else:
        scene_plan_str = "Pas de plan spécifique"
    
    # Build characters and locations lists
    characters_list = []
    locations_list = []
    for role_name, info in asset_mapping.items():
        asset_type = info.get("type", "unknown")
        asset_name = info.get("name", role_name)
        if asset_type == "character":
            characters_list.append(asset_name)
        elif asset_type == "location":
            locations_list.append(asset_name)
    
    characters_str = ", ".join(characters_list) if characters_list else "Aucun personnage défini"
    locations_str = ", ".join(locations_list) if locations_list else "Aucun lieu défini"
    
    # Template with placeholders for RAW view
    prompt_template = """Génère les scènes détaillées pour cette vidéo.

PROJET:
- Titre: "{{title}}"
- Pitch: "{{pitch}}"
- Style: {{visual_style}}
- Ton: {{tone}}
- Durée totale: {{target_duration}}s

PLAN DE SCÈNES À SUIVRE:
{{scene_plan_str}}

PERSONNAGES DISPONIBLES: {{characters_str}}
LIEUX DISPONIBLES: {{locations_str}}

CONTRAINTES:
- Respecte les durées du plan
- Utilise les personnages et lieux listés
- Écris en {{language}}

GÉNÈRE LES SCÈNES (valeurs concrètes, pas de descriptions):
{
  "scenes": [
    {"index": 1, "title": "Titre de la scène", "summary": "2-3 phrases", "duration_seconds": 20, "character_names": ["Nom"], "location_name": "Lieu"}
  ],
  "total_duration_seconds": {{target_duration}}
}"""

    # Interpolated prompt
    prompt = f"""Génère les scènes détaillées pour cette vidéo.

PROJET:
- Titre: "{title}"
- Pitch: "{pitch}"
- Style: {visual_style}
- Ton: {tone}
- Durée totale: {target_duration}s

PLAN DE SCÈNES À SUIVRE:
{scene_plan_str}

PERSONNAGES DISPONIBLES: {characters_str}
LIEUX DISPONIBLES: {locations_str}

CONTRAINTES:
- Respecte les durées du plan
- Utilise les personnages et lieux listés (ou inventes-en si aucun n'est disponible)
- Écris en {language}

GÉNÈRE LES SCÈNES (valeurs concrètes):
{{
  "scenes": [
    {{"index": 1, "title": "Titre concret", "summary": "Description de l'action en 2-3 phrases", "duration_seconds": 20, "character_names": ["Nom du personnage"], "location_name": "Nom du lieu"}}
  ],
  "total_duration_seconds": {target_duration}
}}"""

    try:
        log_id = AILogger.log_interaction(
            service="ScreenwriterV4",
            prompt=prompt,
            prompt_template=prompt_template,
            project_id=project_id
        )

        response = await model.generate_content_async(prompt)
        result_text = response.text.strip()
        result = json.loads(result_text)

        AILogger.update_interaction(log_id, response=result_text)
        return result

    except Exception as e:
        print(f"Error in screenwriter v4: {e}")
        # Fallback: generate basic scenes from plan
        scenes = []
        for s in scene_plan:
            scenes.append({
                "index": s.get("index", len(scenes) + 1),
                "title": s.get("title_suggestion", f"Scène {s.get('index', len(scenes) + 1)}"),
                "summary": s.get("purpose", "À écrire"),
                "duration_seconds": s.get("duration_seconds", 15),
                "character_names": characters_list[:2] if characters_list else [],
                "location_name": locations_list[0] if locations_list else "Lieu principal"
            })
        
        return {
            "scenes": scenes,
            "total_duration_seconds": sum(s.get("duration_seconds", 0) for s in scenes),
            "validation_notes": f"Fallback generation due to error: {str(e)}",
            "error": str(e)
        }
