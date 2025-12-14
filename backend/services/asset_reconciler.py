"""
Asset Reconciler Service
Intelligently matches existing assets to narrative roles with fuzzy matching.
Creates missing assets (characters, locations) when needed.
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
    Matches existing assets to narrative roles. Returns action plan (USE/CREATE).
    """
    
    # Extract context
    visual_style = context.get("fused_visual_style", "Cinematic")
    narrative_arc = context.get("narrative_arc_type", "standard")
    key_elements = context.get("key_narrative_elements", [])
    language = context.get("language", "French")
    
    # Build existing assets string
    assets_str = "AUCUN ASSET EXISTANT"
    if existing_assets:
        assets_list = []
        for a in existing_assets:
            asset_type = a.get("type", "unknown").upper()
            name = a.get("name", "Unnamed")
            desc = a.get("description", "") or "Pas de description"
            asset_id = a.get("id", 0)
            assets_list.append(f"- ID:{asset_id} [{asset_type}] \"{name}\": {desc[:80]}")
        assets_str = "\n".join(assets_list)
    
    elements_str = ", ".join(key_elements) if key_elements else "Non spécifiés"
    
    # Template with placeholders for RAW view
    prompt_template = """Identifie les personnages et lieux nécessaires pour cette histoire.

CONTEXTE:
- Éléments narratifs: {{elements_str}}
- Style visuel: {{visual_style}}
- Arc: {{narrative_arc}}

ASSETS EXISTANTS:
{{assets_str}}

TÂCHE:
1. Liste TOUS les personnages nécessaires pour l'histoire
2. Liste TOUS les lieux nécessaires
3. Pour chaque, indique: USE (si asset existe) ou CREATE (si à créer)

RÉPONDS AVEC DES VALEURS CONCRÈTES:
{
  "character_plan": [
    {"role_name": "Nom du personnage", "action": "CREATE", "create_prompt": "Description visuelle style {{visual_style}}"}
  ],
  "location_plan": [
    {"role_name": "Nom du lieu", "action": "CREATE", "create_prompt": "Description visuelle style {{visual_style}}"}
  ],
  "object_plan": []
}"""

    # Interpolated prompt
    prompt = f"""Identifie les personnages et lieux nécessaires pour cette histoire.

CONTEXTE:
- Éléments narratifs: {elements_str}
- Style visuel: {visual_style}
- Arc: {narrative_arc}

ASSETS EXISTANTS:
{assets_str}

TÂCHE:
1. Liste TOUS les personnages nécessaires pour l'histoire (ex: La Cigale, La Fourmi)
2. Liste TOUS les lieux nécessaires (ex: Champ d'été, Maison de la fourmi)
3. Pour chaque, indique: USE (si un asset existant correspond) ou CREATE (si à créer)

RÉPONDS AVEC DES VALEURS CONCRÈTES (PAS de descriptions de champs):
{{
  "character_plan": [
    {{"role_name": "La Cigale", "action": "CREATE", "create_prompt": "Une cigale joyeuse style {visual_style}"}},
    {{"role_name": "La Fourmi", "action": "CREATE", "create_prompt": "Une fourmi travailleuse style {visual_style}"}}
  ],
  "location_plan": [
    {{"role_name": "Champ d'été", "action": "CREATE", "create_prompt": "Un champ ensoleillé style {visual_style}"}}
  ],
  "object_plan": []
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
        # Fallback: extract from key_elements if available
        characters = []
        locations = []
        
        for elem in key_elements:
            if any(word in elem.lower() for word in ["cigale", "fourmi", "renard", "corbeau", "loup", "agneau"]):
                characters.append({
                    "role_name": elem,
                    "action": "CREATE",
                    "create_prompt": f"{elem} style {visual_style}"
                })
        
        if not characters:
            characters = [
                {"role_name": "Personnage principal", "action": "CREATE", "create_prompt": f"Personnage principal style {visual_style}"}
            ]
        
        return {
            "character_plan": characters,
            "location_plan": locations,
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
        action = char.get("action", "").upper()
        role_name = char.get("role_name", "Unknown")
        
        if action == "CREATE":
            prompt = char.get("create_prompt", "")
            
            new_char = CharacterDB(
                project_id=project_id,
                name=role_name,
                description=prompt,
                traits=""
            )
            db.add(new_char)
            db.commit()
            db.refresh(new_char)
            created_mapping[role_name] = {"type": "character", "id": new_char.id, "name": role_name}
            
        elif action == "USE":
            existing_id = char.get("existing_asset_id")
            existing_name = char.get("existing_asset_name", role_name)
            if existing_id:
                created_mapping[role_name] = {"type": "character", "id": existing_id, "name": existing_name}
    
    # Create locations
    for loc in asset_plan.get("location_plan", []):
        action = loc.get("action", "").upper()
        role_name = loc.get("role_name", "Unknown")
        
        if action == "CREATE":
            prompt = loc.get("create_prompt", "")
            
            new_loc = LocationDB(
                project_id=project_id,
                name=role_name,
                description=prompt
            )
            db.add(new_loc)
            db.commit()
            db.refresh(new_loc)
            created_mapping[role_name] = {"type": "location", "id": new_loc.id, "name": role_name}
            
        elif action == "USE":
            existing_id = loc.get("existing_asset_id")
            existing_name = loc.get("existing_asset_name", role_name)
            if existing_id:
                created_mapping[role_name] = {"type": "location", "id": existing_id, "name": existing_name}
    
    return created_mapping
