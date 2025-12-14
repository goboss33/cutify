"""
Template Loader Service V5.1
Fixed: Clearer prompts that tell AI to FILL values, not echo schema.
"""
import json
import os
from pathlib import Path
from typing import Optional

TEMPLATES_DIR = Path(__file__).parent.parent / "prompt_templates"
_template_cache: dict = {}


def load_template(video_type: str) -> Optional[dict]:
    """Load a prompt template by video type slug."""
    if video_type in _template_cache:
        return _template_cache[video_type]
    
    template_path = TEMPLATES_DIR / f"{video_type}.json"
    
    if not template_path.exists():
        template_path = TEMPLATES_DIR / "cinematic.json"
        if not template_path.exists():
            return None
    
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = json.load(f)
            _template_cache[video_type] = template
            return template
    except Exception as e:
        print(f"Error loading template {video_type}: {e}")
        return None


def build_context_prompt(template: dict, inputs: dict) -> tuple[str, str]:
    """
    Build context analyzer prompt - CLEAR instruction to fill values.
    """
    video_type = template.get("type", "general")
    
    # Get values from inputs
    title = inputs.get("title", "")
    pitch = inputs.get("pitch", "")
    visual_style = inputs.get("visual_style", "")
    duration = inputs.get("duration_seconds", 60)
    tags = inputs.get("detected_tags", [])
    answers = inputs.get("user_answers", {})
    
    tags_str = ", ".join(tags) if tags else "Aucun"
    answers_str = "\n".join([f"- {v}" for v in answers.values()]) if answers else "Aucune"
    
    prompt_template = f'''Tu es un analyste de contexte vidéo. Analyse ce projet et retourne UNIQUEMENT un JSON avec les valeurs remplies.

TYPE DE VIDÉO: {video_type}

ENTRÉES:
- Titre: "{{{{title}}}}"
- Pitch: "{{{{pitch}}}}"
- Style visuel demandé: "{{{{visual_style}}}}"
- Durée cible: {{{{duration}}}} secondes
- Tags détectés: {{{{tags_str}}}}
- Réponses utilisateur: {{{{answers_str}}}}

INSTRUCTIONS:
1. Analyse le pitch pour extraire les personnages, lieux, ton, etc.
2. Fusionne le style visuel (pitch + demandé). Ex: si pitch dit "ghibli" et style="Cinematic" → "Ghibli + Cinematic"
3. Calcule le nombre de scènes suggéré (durée / 15 secondes environ)

RETOURNE CE JSON REMPLI (remplace les ... par des vraies valeurs):
{{
  "fused_visual_style": "...",
  "tone": "...",
  "pacing": "...",
  "language": "French",
  "target_duration_seconds": {{{{duration}}}},
  "suggested_scene_count": ...,
  "key_narrative_elements": ["...", "..."],
  "characters_detected": ["...", "..."],
  "locations_detected": ["...", "..."],
  "narrative_arc_type": "...",
  "target_audience": "...",
  "mood": "..."
}}'''

    prompt_payload = f'''Tu es un analyste de contexte vidéo. Analyse ce projet et retourne UNIQUEMENT un JSON avec les valeurs remplies.

TYPE DE VIDÉO: {video_type}

ENTRÉES:
- Titre: "{title}"
- Pitch: "{pitch}"
- Style visuel demandé: "{visual_style}"
- Durée cible: {duration} secondes
- Tags détectés: {tags_str}
- Réponses utilisateur: {answers_str}

INSTRUCTIONS:
1. Analyse le pitch pour extraire les personnages, lieux, ton, etc.
2. Fusionne le style visuel (pitch + demandé). Ex: si pitch dit "ghibli" et style="Cinematic" → "Ghibli + Cinematic"
3. Calcule le nombre de scènes suggéré (durée / 15 secondes environ)

RETOURNE CE JSON REMPLI (remplace les ... par des vraies valeurs):
{{
  "fused_visual_style": "...",
  "tone": "...",
  "pacing": "...",
  "language": "French",
  "target_duration_seconds": {duration},
  "suggested_scene_count": ...,
  "key_narrative_elements": ["...", "..."],
  "characters_detected": ["...", "..."],
  "locations_detected": ["...", "..."],
  "narrative_arc_type": "...",
  "target_audience": "...",
  "mood": "..."
}}'''

    return prompt_template, prompt_payload


def build_scene_planner_prompt(template: dict, context: dict) -> tuple[str, str]:
    """
    Build scene planner prompt with ACTUAL context values.
    """
    video_type = template.get("type", "general")
    structure = template.get("scene_structure", {})
    scene_types = structure.get("types", ["setup", "content", "conclusion"])
    
    # Extract ONLY the values we need from context (not the whole object)
    visual_style = context.get("fused_visual_style", "Cinematic")
    tone = context.get("tone", "Neutre")
    target_duration = context.get("target_duration_seconds", 60)
    suggested_count = context.get("suggested_scene_count", 4)
    characters = context.get("characters_detected", [])
    locations = context.get("locations_detected", [])
    narrative_arc = context.get("narrative_arc_type", "standard")
    
    chars_str = ", ".join(characters) if characters else "À définir"
    locs_str = ", ".join(locations) if locations else "À définir"
    
    prompt = f'''Tu es un planificateur de scènes. Crée un plan de scènes pour cette vidéo.

TYPE DE VIDÉO: {video_type}

CONTEXTE:
- Style: {visual_style}
- Ton: {tone}
- Durée TOTALE: {target_duration} secondes (RESPECTE CETTE DURÉE)
- Nombre de scènes suggéré: {suggested_count}
- Personnages: {chars_str}
- Lieux: {locs_str}
- Arc narratif: {narrative_arc}

TYPES DE SCÈNES POSSIBLES: {json.dumps(scene_types)}

CONTRAINTES:
- La somme de toutes les durées DOIT égaler EXACTEMENT {target_duration} secondes
- Minimum 5s par scène, maximum 45s par scène
- Utilise les types de scènes listés ci-dessus

RETOURNE CE JSON REMPLI:
{{
  "scene_plan": [
    {{"index": 1, "type": "setup", "title_suggestion": "Titre ici", "duration_seconds": 20, "purpose": "But de la scène", "key_action": "Action principale"}},
    {{"index": 2, "type": "...", "title_suggestion": "...", "duration_seconds": ..., "purpose": "...", "key_action": "..."}},
    ...
  ],
  "total_duration_seconds": {target_duration}
}}'''

    return prompt, prompt


def build_asset_prompt(template: dict, context: dict, existing_assets: list) -> tuple[str, str]:
    """
    Build asset reconciler prompt.
    """
    video_type = template.get("type", "general")
    
    visual_style = context.get("fused_visual_style", "Cinematic")
    characters = context.get("characters_detected", [])
    locations = context.get("locations_detected", [])
    
    # Format existing assets
    if existing_assets:
        existing_str = "\n".join([
            f"  - ID:{a['id']} [{a['type']}] \"{a['name']}\""
            for a in existing_assets
        ])
    else:
        existing_str = "  AUCUN"
    
    chars_str = ", ".join(characters) if characters else "À déduire du pitch"
    locs_str = ", ".join(locations) if locations else "À déduire du pitch"
    
    prompt = f'''Tu es un gestionnaire d'assets. Identifie les personnages et lieux nécessaires.

TYPE DE VIDÉO: {video_type}
STYLE VISUEL: {visual_style}

PERSONNAGES DÉTECTÉS: {chars_str}
LIEUX DÉTECTÉS: {locs_str}

ASSETS EXISTANTS:
{existing_str}

RÈGLES:
- USE: si un asset existant correspond (même approximativement)
- CREATE: si l'asset n'existe pas encore
- JAMAIS créer de doublon

RETOURNE CE JSON REMPLI:
{{
  "character_plan": [
    {{"role_name": "La Cigale", "action": "USE", "existing_asset_id": 116}},
    {{"role_name": "La Fourmi", "action": "CREATE", "create_prompt": "Une fourmi style {visual_style}"}}
  ],
  "location_plan": [
    {{"role_name": "Champ d'été", "action": "CREATE", "create_prompt": "Un champ ensoleillé style {visual_style}"}}
  ],
  "object_plan": []
}}'''

    return prompt, prompt


def build_screenwriter_prompt(template: dict, context: dict, scene_plan: list, asset_mapping: dict) -> tuple[str, str]:
    """
    Build screenwriter prompt.
    """
    video_type = template.get("type", "general")
    
    title = context.get("title", "")
    pitch = context.get("pitch", "")
    visual_style = context.get("fused_visual_style", "")
    tone = context.get("tone", "")
    language = context.get("language", "French")
    target_duration = context.get("target_duration_seconds", 60)
    
    # Build scene plan text
    if scene_plan:
        plan_lines = []
        for s in scene_plan:
            plan_lines.append(f"  - Scène {s.get('index')}: {s.get('type')} ({s.get('duration_seconds')}s) - {s.get('purpose', '')}")
        plan_str = "\n".join(plan_lines)
    else:
        plan_str = "  Pas de plan fourni - crée un plan cohérent"
    
    # Build asset lists
    characters = [info.get("name", role) for role, info in asset_mapping.items() if info.get("type") == "character"]
    locations = [info.get("name", role) for role, info in asset_mapping.items() if info.get("type") == "location"]
    
    chars_str = ", ".join(characters) if characters else "Définis tes propres personnages"
    locs_str = ", ".join(locations) if locations else "Définis tes propres lieux"
    
    prompt = f'''Tu es un scénariste. Écris les scènes détaillées pour cette vidéo.

TYPE: {video_type}
TITRE: "{title}"
PITCH: "{pitch}"
STYLE: {visual_style}
TON: {tone}
DURÉE TOTALE: {target_duration} secondes

PLAN DE SCÈNES À SUIVRE:
{plan_str}

PERSONNAGES DISPONIBLES: {chars_str}
LIEUX DISPONIBLES: {locs_str}

CONTRAINTES:
- Respecte les durées du plan
- Écris en {language}
- La somme des durées DOIT égaler {target_duration}s

RETOURNE CE JSON REMPLI:
{{
  "scenes": [
    {{"index": 1, "title": "Titre de scène", "summary": "Description en 2-3 phrases", "duration_seconds": 20, "character_names": ["Personnage1"], "location_name": "Lieu"}},
    ...
  ],
  "total_duration_seconds": {target_duration}
}}'''

    return prompt, prompt
