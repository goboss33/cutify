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
        answers_str = "Aucune réponse"
    
    # Template with placeholders for RAW view (variables in orange)
    prompt_template = """{
  "role": "context_analyzer",
  "task": "Fusionne intelligemment toutes les sources de contexte pour créer un brief unifié",
  
  "inputs": {
    "project_title": "{{title}}",
    "user_pitch": "{{pitch}}",
    "preset_category": "{{preset_name}}",
    "preset_visual_style": "{{preset_visual_style}}",
    "preset_duration_seconds": {{preset_duration}},
    "user_target_duration_seconds": {{target_duration_seconds}},
    "detected_tags": "{{tags_str}}",
    "user_answers": "{{answers_str}}"
  },
  
  "fusion_rules": {
    "visual_style": "Si le pitch contient un style explicite (ex: 'ghibli', 'pixar', 'noir et blanc'), FUSIONNER avec le preset, ne pas écraser. Format: 'Style1 + Style2'",
    "tone": "Déduire du pitch et des tags. Ex: 'enfant' → ton enfantin, 'thriller' → ton sombre",
    "language": "Détecter depuis le titre du projet",
    "duration": "Utiliser user_target_duration_seconds si fourni, sinon preset_duration_seconds"
  },
  
  "output_required": {
    "fused_visual_style": "string - Style fusionné (pitch + preset)",
    "tone": "string - Ton déduit",
    "pacing": "string - Rythme adapté au type de contenu",
    "language": "string - Langue détectée (French/English/etc)",
    "target_duration_seconds": "number - Durée cible finale",
    "suggested_scene_count": "number - Nombre de scènes recommandé (durée / ~15s par scène)",
    "key_narrative_elements": "array - Éléments clés de l'histoire extraits du titre et pitch",
    "narrative_arc_type": "string - Type d'arc narratif (fable, action, tutorial, etc)",
    "target_audience": "string - Public cible déduit"
  }
}"""

    # Interpolated prompt for actual API call (variables in green when displayed)
    prompt = f"""{{
  "role": "context_analyzer",
  "task": "Fusionne intelligemment toutes les sources de contexte pour créer un brief unifié",
  
  "inputs": {{
    "project_title": "{title}",
    "user_pitch": "{pitch}",
    "preset_category": "{preset_name}",
    "preset_visual_style": "{preset_visual_style}",
    "preset_duration_seconds": {preset_duration},
    "user_target_duration_seconds": {target_duration_seconds},
    "detected_tags": "{tags_str}",
    "user_answers": "{answers_str}"
  }},
  
  "fusion_rules": {{
    "visual_style": "Si le pitch contient un style explicite (ex: 'ghibli', 'pixar', 'noir et blanc'), FUSIONNER avec le preset, ne pas écraser. Format: 'Style1 + Style2'",
    "tone": "Déduire du pitch et des tags. Ex: 'enfant' → ton enfantin, 'thriller' → ton sombre",
    "language": "Détecter depuis le titre du projet",
    "duration": "Utiliser user_target_duration_seconds si fourni, sinon preset_duration_seconds"
  }},
  
  "output_required": {{
    "fused_visual_style": "string - Style fusionné (pitch + preset)",
    "tone": "string - Ton déduit",
    "pacing": "string - Rythme adapté au type de contenu",
    "language": "string - Langue détectée (French/English/etc)",
    "target_duration_seconds": "number - Durée cible finale",
    "suggested_scene_count": "number - Nombre de scènes recommandé (durée / ~15s par scène)",
    "key_narrative_elements": "array - Éléments clés de l'histoire extraits du titre et pitch",
    "narrative_arc_type": "string - Type d'arc narratif (fable, action, tutorial, etc)",
    "target_audience": "string - Public cible déduit"
  }}
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
        # Fallback to basic fusion
        return {
            "fused_visual_style": f"{pitch} + {preset_visual_style}" if preset_visual_style else pitch,
            "tone": "Neutre",
            "pacing": "Modéré",
            "language": "French",
            "target_duration_seconds": target_duration_seconds or preset_duration or 60,
            "suggested_scene_count": max(3, (target_duration_seconds or 60) // 15),
            "key_narrative_elements": [],
            "narrative_arc_type": "standard",
            "target_audience": "Grand public",
            "error": str(e)
        }
