"""
Context Analyzer Service
Intelligently fuses all context sources (pitch, preset, tags) into a unified context.
"""
import json
import google.generativeai as genai
import os
from services.ai_logger import AILogger

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp', generation_config={"response_mime_type": "application/json"})


async def analyze_context(
    project_id: int,
    title: str,
    pitch: str,
    preset_name: str,
    preset_visual_style: str,
    preset_duration: int,
    detected_tags: list,
    ai_answers: dict,
    target_duration_seconds: int
) -> dict:
    """
    Fuses all context sources into a unified, intelligent context.
    Priority: User explicit input > Tags > Preset defaults
    """
    
    # Build tags string
    tags_str = ", ".join(detected_tags) if detected_tags else "Aucun"
    
    # Build answers string
    answers_str = ""
    if ai_answers:
        for q_id, answer in ai_answers.items():
            answers_str += f"\n  - {answer}"
    else:
        answers_str = "Aucune"
    
    # Template with placeholders for RAW view (variables in orange)
    prompt_template = """Analyse le projet et génère un contexte fusionné.

ENTRÉES:
- Titre: "{{title}}"
- Pitch: "{{pitch}}"
- Preset: {{preset_name}} (style: {{preset_visual_style}})
- Durée preset: {{preset_duration}}s
- Durée demandée: {{target_duration_seconds}}s
- Tags: {{tags_str}}
- Réponses: {{answers_str}}

RÈGLES DE FUSION:
1. visual_style: Si le pitch mentionne un style (minecraft, ghibli, etc), FUSIONNER avec le preset. Ex: "Minecraft + Cinematic"
2. tone: Déduire du pitch ("humoristique" → "Humoristique et léger")
3. duration: Utiliser la durée demandée ({{target_duration_seconds}}s)
4. scene_count: durée / 15s environ

RÉPONDS UNIQUEMENT AVEC CES VALEURS CONCRÈTES (pas de descriptions):
{
  "fused_visual_style": "LE STYLE FUSIONNÉ ICI",
  "tone": "LE TON DÉDUIT ICI",
  "pacing": "LE RYTHME ICI",
  "language": "French ou English",
  "target_duration_seconds": NOMBRE_ENTIER,
  "suggested_scene_count": NOMBRE_ENTIER,
  "key_narrative_elements": ["élément1", "élément2"],
  "narrative_arc_type": "fable/action/tutorial/etc",
  "target_audience": "Public cible"
}"""

    # Interpolated prompt for actual API call
    prompt = f"""Analyse le projet et génère un contexte fusionné.

ENTRÉES:
- Titre: "{title}"
- Pitch: "{pitch}"
- Preset: {preset_name} (style: {preset_visual_style})
- Durée preset: {preset_duration}s
- Durée demandée: {target_duration_seconds}s
- Tags: {tags_str}
- Réponses: {answers_str}

RÈGLES DE FUSION:
1. visual_style: Si le pitch mentionne un style (minecraft, ghibli, etc), FUSIONNER avec le preset. Ex: "Minecraft + Cinematic"
2. tone: Déduire du pitch ("humoristique" → "Humoristique et léger")
3. duration: Utiliser la durée demandée ({target_duration_seconds}s)
4. scene_count: durée / 15s environ

RÉPONDS UNIQUEMENT AVEC CES VALEURS CONCRÈTES (pas de descriptions):
{{
  "fused_visual_style": "LE STYLE FUSIONNÉ ICI",
  "tone": "LE TON DÉDUIT ICI",
  "pacing": "LE RYTHME ICI",
  "language": "French ou English",
  "target_duration_seconds": NOMBRE_ENTIER,
  "suggested_scene_count": NOMBRE_ENTIER,
  "key_narrative_elements": ["élément1", "élément2"],
  "narrative_arc_type": "fable/action/tutorial/etc",
  "target_audience": "Public cible"
}}"""

    try:
        log_id = AILogger.log_interaction(
            service="ContextAnalyzer",
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
        print(f"Error in context analyzer: {e}")
        # Fallback with detected values
        fused_style = preset_visual_style or "Cinematic"
        if "minecraft" in pitch.lower():
            fused_style = f"Minecraft + {fused_style}"
        elif "ghibli" in pitch.lower():
            fused_style = f"Ghibli + {fused_style}"
            
        return {
            "fused_visual_style": fused_style,
            "tone": "Humoristique" if "humoristique" in pitch.lower() else "Neutre",
            "pacing": "Modéré",
            "language": "French",
            "target_duration_seconds": target_duration_seconds,
            "suggested_scene_count": max(3, target_duration_seconds // 15),
            "key_narrative_elements": [title],
            "narrative_arc_type": "fable" if "fable" in pitch.lower() else "standard",
            "target_audience": "Grand public",
            "error": str(e)
        }
