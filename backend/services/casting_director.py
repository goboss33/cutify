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
    title: str,
    pitch: str,
    category_slug: str,
    visual_style: str,
    onboarding_context: dict,
    existing_assets: list
) -> dict:
    """
    Reconciles existing assets with narrative roles needed for the project.
    
    Returns:
        {
            "narrative_roles": [...],
            "cast": [...],
            "missing_roles": [...],
            "unused_assets": [...],
            "best_cast": [...]  # Deduplicated: only best match per role
        }
    """
    
    # Build asset list string with details
    assets_str = "Aucun asset existant"
    if existing_assets:
        assets_list = []
        for a in existing_assets:
            asset_type = a.get("type", "unknown").upper()
            name = a.get("name", "Unnamed")
            desc = a.get("description", "") or "Pas de description"
            asset_id = a.get("id", 0)
            assets_list.append(f"- ID:{asset_id} [{asset_type}] \"{name}\": {desc}")
        assets_str = "\n".join(assets_list)
    
    # Build context string from onboarding
    context_str = ""
    if onboarding_context:
        tags = onboarding_context.get("detected_tags", [])
        answers = onboarding_context.get("ai_answers", {})
        if tags:
            context_str += f"\nMOTS-CLÉS DÉTECTÉS: {', '.join(tags)}"
        if answers:
            context_str += "\nCONTEXTE ADDITIONNEL:"
            for q_id, answer in answers.items():
                context_str += f"\n  - {answer}"
    
    # Template with placeholders for RAW view
    prompt_template = """Tu es le DIRECTEUR DE CASTING pour une production vidéo.

═══════════════════════════════════════════════════
PROJET: "{{title}}"
CATÉGORIE: {{category_slug}}
STYLE VISUEL: {{visual_style}}
═══════════════════════════════════════════════════

PITCH:
{{pitch}}
{{context_str}}

═══════════════════════════════════════════════════
ASSETS EXISTANTS DANS LA BASE:
═══════════════════════════════════════════════════
{{assets_str}}

═══════════════════════════════════════════════════
TA MISSION:
═══════════════════════════════════════════════════

1. **ANALYSE** le titre et le pitch pour identifier les rôles narratifs nécessaires:
   - Personnages (protagonistes, antagonistes, secondaires)
   - Lieux (décors, environnements)
   - Objets clés (accessoires importants)

2. **CAST** les assets existants vers les rôles:
   - Pour chaque rôle, choisis UN SEUL asset (le meilleur match)
   - Évite les doublons: si "Corbeau" et "Crow" existent, choisis un seul
   - match_confidence: 0.0 (aucun rapport) à 1.0 (correspondance parfaite)

3. **LISTE** les rôles manquants (aucun asset ne correspond)

4. **LISTE** les assets inutilisés

RÈGLES IMPORTANTES:
- UN asset par rôle maximum (pas de doublons)
- Préfère les assets dans la langue du titre du projet
- Si un asset a une description plus complète, préfère-le

═══════════════════════════════════════════════════
FORMAT DE RÉPONSE (JSON STRICT):
═══════════════════════════════════════════════════
{
  "narrative_roles": [
    {"id": "char_1", "type": "character", "name": "Nom", "description": "Description"}
  ],
  "cast": [
    {"role_id": "char_1", "asset_id": 123, "asset_name": "Nom exact", "match_confidence": 0.95}
  ],
  "missing_roles": [
    {"id": "char_2", "type": "character", "name": "Nom", "description": "Description", "suggested_prompt": "Prompt style {{visual_style}}"}
  ],
  "unused_assets": [
    {"asset_id": 456, "asset_name": "Nom", "reason": "Pourquoi non utilisé"}
  ]
}"""

    # Interpolated prompt for actual API call
    prompt = f"""Tu es le DIRECTEUR DE CASTING pour une production vidéo.

═══════════════════════════════════════════════════
PROJET: "{title}"
CATÉGORIE: {category_slug}
STYLE VISUEL: {visual_style or "Non défini"}
═══════════════════════════════════════════════════

PITCH:
{pitch}
{context_str}

═══════════════════════════════════════════════════
ASSETS EXISTANTS DANS LA BASE:
═══════════════════════════════════════════════════
{assets_str}

═══════════════════════════════════════════════════
TA MISSION:
═══════════════════════════════════════════════════

1. **ANALYSE** le titre et le pitch pour identifier les rôles narratifs nécessaires:
   - Personnages (protagonistes, antagonistes, secondaires)
   - Lieux (décors, environnements)
   - Objets clés (accessoires importants)

2. **CAST** les assets existants vers les rôles:
   - Pour chaque rôle, choisis UN SEUL asset (le meilleur match)
   - Évite les doublons: si "Corbeau" et "Crow" existent, choisis un seul
   - match_confidence: 0.0 (aucun rapport) à 1.0 (correspondance parfaite)

3. **LISTE** les rôles manquants (aucun asset ne correspond)

4. **LISTE** les assets inutilisés

RÈGLES IMPORTANTES:
- UN asset par rôle maximum (pas de doublons)
- Préfère les assets dans la langue du titre du projet
- Si un asset a une description plus complète, préfère-le

═══════════════════════════════════════════════════
FORMAT DE RÉPONSE (JSON STRICT):
═══════════════════════════════════════════════════
{{
  "narrative_roles": [
    {{"id": "char_1", "type": "character", "name": "Nom", "description": "Description"}}
  ],
  "cast": [
    {{"role_id": "char_1", "asset_id": 123, "asset_name": "Nom exact", "match_confidence": 0.95}}
  ],
  "missing_roles": [
    {{"id": "char_2", "type": "character", "name": "Nom", "description": "Description", "suggested_prompt": "Prompt style {visual_style or 'cinématique'}"}}
  ],
  "unused_assets": [
    {{"asset_id": 456, "asset_name": "Nom", "reason": "Pourquoi non utilisé"}}
  ]
}}"""

    try:
        log_id = AILogger.log_interaction(
            service="CastingDirector",
            prompt=prompt,
            prompt_template=prompt_template,
            project_id=project_id
        )

        response = await model.generate_content_async(prompt)
        result_text = response.text.strip()
        result = json.loads(result_text)
        
        # Post-process: deduplicate cast (keep only best match per role)
        result["best_cast"] = deduplicate_cast(result.get("cast", []))

        AILogger.update_interaction(log_id, response=result_text)
        return result

    except Exception as e:
        print(f"Error in casting call: {e}")
        return {
            "narrative_roles": [],
            "cast": [],
            "best_cast": [],
            "missing_roles": [],
            "unused_assets": [],
            "error": str(e)
        }


def deduplicate_cast(cast_list: list) -> list:
    """
    Keep only the best match (highest confidence) for each role.
    """
    best_by_role = {}
    for item in cast_list:
        role_id = item.get("role_id", "")
        confidence = item.get("match_confidence", 0)
        
        if role_id not in best_by_role or confidence > best_by_role[role_id].get("match_confidence", 0):
            best_by_role[role_id] = item
    
    return list(best_by_role.values())


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
        suggested_prompt = role.get("suggested_prompt", description)
        
        if role_type == "character":
            new_asset = CharacterDB(
                project_id=project_id,
                name=name,
                description=f"{description}\n\nPrompt: {suggested_prompt}",
                traits=""
            )
            db.add(new_asset)
            db.commit()
            db.refresh(new_asset)
            created_assets.append({"type": "character", "id": new_asset.id, "name": name})
            
        elif role_type == "location":
            new_asset = LocationDB(
                project_id=project_id,
                name=name,
                description=f"{description}\n\nPrompt: {suggested_prompt}"
            )
            db.add(new_asset)
            db.commit()
            db.refresh(new_asset)
            created_assets.append({"type": "location", "id": new_asset.id, "name": name})
    
    return created_assets
