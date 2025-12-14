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
    
    Args:
        context: Output from context_analyzer
        scene_plan: Output from scene_planner
        asset_mapping: Output from asset_reconciler (role_name -> asset info)
    
    Returns:
        {
            "scenes": [...],
            "validation_notes": "..."
        }
    """
    
    # Extract context
    visual_style = context.get("fused_visual_style", "Cinematic")
    tone = context.get("tone", "Neutre")
    pacing = context.get("pacing", "Modéré")
    language = context.get("language", "French")
    target_duration = context.get("target_duration_seconds", 60)
    audience = context.get("target_audience", "Grand public")
    
    # Build scene plan string
    scene_plan_str = "Pas de plan"
    if scene_plan:
        scenes = []
        for s in scene_plan:
            scenes.append(f'{{ "index": {s.get("index", 1)}, "type": "{s.get("type", "scene")}", "duration_seconds": {s.get("duration_seconds", 10)}, "purpose": "{s.get("purpose", "")}" }}')
        scene_plan_str = ",\n      ".join(scenes)
    
    # Build available characters string
    characters = []
    locations = []
    for role_name, info in asset_mapping.items():
        asset_type = info.get("type", "unknown")
        asset_name = info.get("name", role_name)
        asset_id = info.get("id", 0)
        if asset_type == "character":
            characters.append(f'{{ "name": "{asset_name}", "id": {asset_id} }}')
        elif asset_type == "location":
            locations.append(f'{{ "name": "{asset_name}", "id": {asset_id} }}')
    
    characters_str = ",\n        ".join(characters) if characters else '"Aucun"'
    locations_str = ",\n        ".join(locations) if locations else '"Aucun"'
    
    # Template with placeholders for RAW view
    prompt_template = """{
  "role": "screenwriter",
  "task": "Générer les scènes détaillées en suivant EXACTEMENT le plan fourni",
  
  "project": {
    "title": "{{title}}",
    "pitch": "{{pitch}}",
    "visual_style": "{{visual_style}}",
    "tone": "{{tone}}",
    "pacing": "{{pacing}}",
    "language": "{{language}}",
    "target_audience": "{{audience}}"
  },
  
  "scene_plan_to_follow": [
    {{scene_plan_str}}
  ],
  
  "available_assets": {
    "characters": [
      {{characters_str}}
    ],
    "locations": [
      {{locations_str}}
    ]
  },
  
  "strict_rules": {
    "duration": "Chaque scène DOIT respecter la durée du plan (±2s)",
    "total_duration": "La somme des durées DOIT = {{target_duration}}s",
    "characters": "Utiliser UNIQUEMENT les noms exacts des characters disponibles",
    "locations": "Utiliser UNIQUEMENT les noms exacts des locations disponibles",
    "no_new_assets": "NE PAS inventer de nouveaux personnages ou lieux",
    "language": "Écrire dans la langue: {{language}}"
  },
  
  "output_required": {
    "scenes": [
      {
        "index": "number - Doit correspondre au plan",
        "title": "string - Titre de la scène",
        "summary": "string - 2-3 phrases décrivant l'action",
        "duration_seconds": "number - Doit correspondre au plan",
        "character_names": ["array - Noms EXACTS des personnages"],
        "location_name": "string - Nom EXACT du lieu"
      }
    ],
    "total_duration_seconds": "number - Somme des durées",
    "validation_notes": "string - Notes sur le respect des contraintes"
  }
}"""

    # Interpolated prompt
    prompt = f"""{{
  "role": "screenwriter",
  "task": "Générer les scènes détaillées en suivant EXACTEMENT le plan fourni",
  
  "project": {{
    "title": "{title}",
    "pitch": "{pitch}",
    "visual_style": "{visual_style}",
    "tone": "{tone}",
    "pacing": "{pacing}",
    "language": "{language}",
    "target_audience": "{audience}"
  }},
  
  "scene_plan_to_follow": [
    {scene_plan_str}
  ],
  
  "available_assets": {{
    "characters": [
      {characters_str}
    ],
    "locations": [
      {locations_str}
    ]
  }},
  
  "strict_rules": {{
    "duration": "Chaque scène DOIT respecter la durée du plan (±2s)",
    "total_duration": "La somme des durées DOIT = {target_duration}s",
    "characters": "Utiliser UNIQUEMENT les noms exacts des characters disponibles",
    "locations": "Utiliser UNIQUEMENT les noms exacts des locations disponibles",
    "no_new_assets": "NE PAS inventer de nouveaux personnages ou lieux",
    "language": "Écrire dans la langue: {language}"
  }},
  
  "output_required": {{
    "scenes": [
      {{
        "index": "number - Doit correspondre au plan",
        "title": "string - Titre de la scène",
        "summary": "string - 2-3 phrases décrivant l'action",
        "duration_seconds": "number - Doit correspondre au plan",
        "character_names": ["array - Noms EXACTS des personnages"],
        "location_name": "string - Nom EXACT du lieu"
      }}
    ],
    "total_duration_seconds": "number - Somme des durées",
    "validation_notes": "string - Notes sur le respect des contraintes"
  }}
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
        return {
            "scenes": [],
            "total_duration_seconds": 0,
            "validation_notes": f"Error: {str(e)}",
            "error": str(e)
        }
