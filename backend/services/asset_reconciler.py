"""
Asset Reconciler Service (formerly Casting Director)
Intelligently matches existing assets to narrative roles with fuzzy matching.
NO duplicates: uses existing assets when confidence > 0.7
"""
import json
import google.generativeai as genai
import os
from services.ai_logger import AILogger

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp', generation_config={"response_mime_type": "application/json"})


async def reconcile_assets(
    project_id: int,
    context: dict,
    existing_assets: list
) -> dict:
    """
    Matches existing assets to narrative roles. Returns action plan (USE/CREATE/SKIP).
    
    Args:
        context: Output from context_analyzer
        existing_assets: List of existing characters and locations
        
    Returns:
        {
            "character_plan": [...],
            "location_plan": [...],
            "object_plan": [...]
        }
    """
    
    # Extract context
    title = context.get("key_narrative_elements", [])
    visual_style = context.get("fused_visual_style", "Cinematic")
    narrative_elements = context.get("key_narrative_elements", [])
    narrative_arc = context.get("narrative_arc_type", "standard")
    language = context.get("language", "French")
    
    # Build existing assets string
    assets_str = "Aucun asset existant"
    if existing_assets:
        assets_list = []
        for a in existing_assets:
            asset_type = a.get("type", "unknown").upper()
            name = a.get("name", "Unnamed")
            desc = a.get("description", "") or "Pas de description"
            asset_id = a.get("id", 0)
            assets_list.append(f'{{ "id": {asset_id}, "type": "{asset_type}", "name": "{name}", "description": "{desc[:100]}" }}')
        assets_str = ",\n      ".join(assets_list)
    
    elements_str = ", ".join(narrative_elements) if narrative_elements else "Non définis"
    
    # Template with placeholders for RAW view
    prompt_template = """{
  "role": "asset_reconciler",
  "task": "Identifier les assets nécessaires et matcher avec les existants. ANTI-DOUBLONS.",
  
  "context": {
    "visual_style": "{{visual_style}}",
    "narrative_arc": "{{narrative_arc}}",
    "language": "{{language}}",
    "key_elements": "{{elements_str}}"
  },
  
  "existing_assets": [
    {{assets_str}}
  ],
  
  "rules": {
    "fuzzy_matching": "Même si les noms diffèrent légèrement (Renard/renard/Fox), considère comme match si même concept",
    "confidence_threshold": 0.7,
    "action_USE": "Si confidence >= 0.7, utiliser l'asset existant",
    "action_CREATE": "Si aucun match ou confidence < 0.7, créer un nouvel asset", 
    "action_SKIP": "Si l'élément n'est pas essentiel pour l'histoire",
    "no_duplicates": "JAMAIS créer un asset si un similaire existe"
  },
  
  "output_required": {
    "character_plan": [
      {
        "role_name": "string - Nom du rôle narratif",
        "action": "USE | CREATE | SKIP",
        "existing_asset_id": "number | null - ID si action=USE",
        "existing_asset_name": "string | null - Nom exact de l'asset existant",
        "match_confidence": "number 0-1",
        "create_prompt": "string | null - Prompt si action=CREATE, style {{visual_style}}"
      }
    ],
    "location_plan": [...],
    "object_plan": [...]
  }
}"""

    # Interpolated prompt
    prompt = f"""{{
  "role": "asset_reconciler",
  "task": "Identifier les assets nécessaires et matcher avec les existants. ANTI-DOUBLONS.",
  
  "context": {{
    "visual_style": "{visual_style}",
    "narrative_arc": "{narrative_arc}",
    "language": "{language}",
    "key_elements": "{elements_str}"
  }},
  
  "existing_assets": [
    {assets_str}
  ],
  
  "rules": {{
    "fuzzy_matching": "Même si les noms diffèrent légèrement (Renard/renard/Fox), considère comme match si même concept",
    "confidence_threshold": 0.7,
    "action_USE": "Si confidence >= 0.7, utiliser l'asset existant",
    "action_CREATE": "Si aucun match ou confidence < 0.7, créer un nouvel asset", 
    "action_SKIP": "Si l'élément n'est pas essentiel pour l'histoire",
    "no_duplicates": "JAMAIS créer un asset si un similaire existe"
  }},
  
  "output_required": {{
    "character_plan": [
      {{
        "role_name": "string - Nom du rôle narratif",
        "action": "USE | CREATE | SKIP",
        "existing_asset_id": "number | null - ID si action=USE",
        "existing_asset_name": "string | null - Nom exact de l'asset existant",
        "match_confidence": "number 0-1",
        "create_prompt": "string | null - Prompt si action=CREATE, style {visual_style}"
      }}
    ],
    "location_plan": [...],
    "object_plan": [...]
  }}
}}"""

    try:
        log_id = AILogger.log_interaction(
            service="AssetReconciler",
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
        print(f"Error in asset reconciler: {e}")
        return {
            "character_plan": [],
            "location_plan": [],
            "object_plan": [],
            "error": str(e)
        }


async def create_missing_assets(project_id: int, asset_plan: dict, db) -> dict:
    """
    Creates only the assets marked with action=CREATE.
    Returns mapping of role_name to asset_id.
    """
    from models import CharacterDB, LocationDB
    
    created_mapping = {}
    
    # Create characters
    for char in asset_plan.get("character_plan", []):
        if char.get("action") == "CREATE":
            name = char.get("role_name", "Unknown")
            prompt = char.get("create_prompt", "")
            
            new_char = CharacterDB(
                project_id=project_id,
                name=name,
                description=prompt,
                traits=""
            )
            db.add(new_char)
            db.commit()
            db.refresh(new_char)
            created_mapping[name] = {"type": "character", "id": new_char.id}
        elif char.get("action") == "USE":
            created_mapping[char.get("role_name")] = {
                "type": "character",
                "id": char.get("existing_asset_id"),
                "name": char.get("existing_asset_name")
            }
    
    # Create locations
    for loc in asset_plan.get("location_plan", []):
        if loc.get("action") == "CREATE":
            name = loc.get("role_name", "Unknown")
            prompt = loc.get("create_prompt", "")
            
            new_loc = LocationDB(
                project_id=project_id,
                name=name,
                description=prompt
            )
            db.add(new_loc)
            db.commit()
            db.refresh(new_loc)
            created_mapping[name] = {"type": "location", "id": new_loc.id}
        elif loc.get("action") == "USE":
            created_mapping[loc.get("role_name")] = {
                "type": "location",
                "id": loc.get("existing_asset_id"),
                "name": loc.get("existing_asset_name")
            }
    
    return created_mapping
