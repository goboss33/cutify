"""
Casting Director Service
Handles asset-to-narrative-role reconciliation before scene generation.
"""
import json
import google.generativeai as genai
import os
from services.ai_logger import AILogger

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp', generation_config={"response_mime_type": "application/json"})


async def run_casting_call(
    project_id: int,
    pitch: str,
    category_slug: str,
    onboarding_context: dict,
    existing_assets: list
) -> dict:
    """
    Reconciles existing assets with narrative roles needed for the project.
    
    Returns:
        {
            "narrative_roles": [...],   # All roles needed for the story
            "cast": [...],             # Matched: {role, asset_id, asset_name}
            "missing_roles": [...],    # Roles with no matching asset
            "unused_assets": [...]     # Assets that don't fit the narrative
        }
    """
    
    # Build asset list string
    assets_str = "Aucun asset existant"
    if existing_assets:
        assets_list = []
        for a in existing_assets:
            asset_type = a.get("type", "unknown")
            name = a.get("name", "Unnamed")
            desc = a.get("description", "")
            assets_list.append(f"- [{asset_type}] {name}: {desc}")
        assets_str = "\n".join(assets_list)
    
    # Build context string
    context_str = ""
    if onboarding_context:
        tags = onboarding_context.get("detected_tags", [])
        answers = onboarding_context.get("ai_answers", {})
        if tags:
            context_str += f"\nTags détectés: {', '.join(tags)}"
        if answers:
            context_str += f"\nRéponses onboarding: {json.dumps(answers, ensure_ascii=False)}"
    
    prompt = f"""Tu es un directeur de casting pour la production vidéo. 
Analyse le projet et détermine quels rôles narratifs sont nécessaires, puis fait correspondre les assets existants à ces rôles.

CATÉGORIE: {category_slug}
PITCH: "{pitch}"
{context_str}

ASSETS EXISTANTS:
{assets_str}

TÂCHE:
1. Identifie les rôles narratifs nécessaires (personnages, lieux, objets clés)
2. Pour chaque rôle, vérifie s'il y a un asset existant qui correspond
3. Liste les rôles non couverts (à créer)
4. Liste les assets qui ne correspondent à aucun rôle

Réponds UNIQUEMENT en JSON valide:
{{
  "narrative_roles": [
    {{"id": "role_1", "type": "character|location|object", "name": "...", "description": "..."}}
  ],
  "cast": [
    {{"role_id": "role_1", "asset_id": 123, "asset_name": "...", "match_confidence": 0.9}}
  ],
  "missing_roles": [
    {{"id": "role_2", "type": "character", "name": "...", "description": "...", "suggested_prompt": "..."}}
  ],
  "unused_assets": [
    {{"asset_id": 456, "asset_name": "...", "reason": "Ne correspond pas au pitch"}}
  ]
}}"""

    try:
        log_id = AILogger.log_interaction(
            service="CastingDirector",
            prompt=prompt,
            project_id=project_id
        )

        response = await model.generate_content_async(prompt)
        result_text = response.text.strip()
        result = json.loads(result_text)

        AILogger.update_interaction(log_id, response=result_text)
        return result

    except Exception as e:
        print(f"Error in casting call: {e}")
        return {
            "narrative_roles": [],
            "cast": [],
            "missing_roles": [],
            "unused_assets": [],
            "error": str(e)
        }


async def auto_create_missing_assets(project_id: int, missing_roles: list, db) -> list:
    """
    Automatically creates character/location assets for missing narrative roles.
    Returns list of created asset IDs.
    """
    from models import CharacterDB, LocationDB
    
    created_assets = []
    
    for role in missing_roles:
        role_type = role.get("type", "character")
        name = role.get("name", "Unknown")
        description = role.get("description", "")
        
        if role_type == "character":
            new_asset = CharacterDB(
                project_id=project_id,
                name=name,
                description=description,
                traits="",
                visual_description=role.get("suggested_prompt", description)
            )
            db.add(new_asset)
            db.commit()
            db.refresh(new_asset)
            created_assets.append({"type": "character", "id": new_asset.id, "name": name})
            
        elif role_type == "location":
            new_asset = LocationDB(
                project_id=project_id,
                name=name,
                description=description,
                visual_description=role.get("suggested_prompt", description)
            )
            db.add(new_asset)
            db.commit()
            db.refresh(new_asset)
            created_assets.append({"type": "location", "id": new_asset.id, "name": name})
    
    return created_assets
