"""
Scene Planner Service
Calculates optimal scene count and duration based on context and narrative template.
"""
import json
import google.generativeai as genai
import os
from services.ai_logger import AILogger

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp', generation_config={"response_mime_type": "application/json"})


async def plan_scenes(
    project_id: int,
    context: dict,
    narrative_template: dict = None
) -> list:
    """
    Creates a detailed scene plan with exact durations.
    """
    
    # Extract context values
    visual_style = context.get("fused_visual_style", "Cinematic")
    tone = context.get("tone", "Neutre")
    pacing = context.get("pacing", "Modéré")
    target_duration = context.get("target_duration_seconds", 60)
    suggested_count = context.get("suggested_scene_count", 4)
    narrative_arc = context.get("narrative_arc_type", "standard")
    audience = context.get("target_audience", "Grand public")
    key_elements = context.get("key_narrative_elements", [])
    
    # Build narrative structure string
    structure_str = "Pas de template spécifique"
    if narrative_template:
        structure = narrative_template.get("structure", [])
        if structure:
            parts = []
            for s in structure:
                parts.append(f"- {s.get('type', 'scene')}: {s.get('description', '')}")
            structure_str = "\n".join(parts)
    
    elements_str = ", ".join(key_elements) if key_elements else "Non spécifiés"
    
    # Template with placeholders for RAW view
    prompt_template = """Planifie les scènes pour cette vidéo.

CONTEXTE:
- Style: {{visual_style}}
- Ton: {{tone}}
- Rythme: {{pacing}}
- Durée TOTALE: {{target_duration}} secondes
- Nombre de scènes suggéré: {{suggested_count}}
- Arc narratif: {{narrative_arc}}
- Public: {{audience}}
- Éléments clés: {{elements_str}}

TEMPLATE NARRATIF:
{{structure_str}}

CONTRAINTES STRICTES:
- La somme des durées DOIT égaler EXACTEMENT {{target_duration}} secondes
- Minimum 5 secondes par scène, maximum 45 secondes
- Chaque scène doit avoir un but clair

GÉNÈRE UN TABLEAU DE SCÈNES CONCRET:
{
  "scene_plan": [
    {"index": 1, "type": "setup", "title_suggestion": "Titre", "duration_seconds": 20, "purpose": "But", "key_action": "Action"},
    ...
  ],
  "total_duration_seconds": DOIT_ÉGALER_{{target_duration}},
  "pacing_notes": "Notes sur le rythme"
}"""

    # Interpolated prompt
    prompt = f"""Planifie les scènes pour cette vidéo.

CONTEXTE:
- Style: {visual_style}
- Ton: {tone}
- Rythme: {pacing}
- Durée TOTALE: {target_duration} secondes
- Nombre de scènes suggéré: {suggested_count}
- Arc narratif: {narrative_arc}
- Public: {audience}
- Éléments clés: {elements_str}

TEMPLATE NARRATIF:
{structure_str}

CONTRAINTES STRICTES:
- La somme des durées DOIT égaler EXACTEMENT {target_duration} secondes
- Minimum 5 secondes par scène, maximum 45 secondes
- Chaque scène doit avoir un but clair

GÉNÈRE UN TABLEAU DE SCÈNES CONCRET:
{{
  "scene_plan": [
    {{"index": 1, "type": "setup", "title_suggestion": "Titre", "duration_seconds": 20, "purpose": "But", "key_action": "Action"}},
    ...
  ],
  "total_duration_seconds": DOIT_ÉGALER_{target_duration},
  "pacing_notes": "Notes sur le rythme"
}}"""

    try:
        log_id = AILogger.log_interaction(
            service="ScenePlanner",
            prompt=prompt,
            prompt_template=prompt_template,
            project_id=project_id
        )

        response = await model.generate_content_async(prompt)
        result_text = response.text.strip()
        result = json.loads(result_text)

        AILogger.update_interaction(log_id, response=result_text)
        
        return result.get("scene_plan", [])

    except Exception as e:
        print(f"Error in scene planner: {e}")
        # Fallback: distribute duration across scenes
        scene_count = max(3, target_duration // 20)
        base_duration = target_duration // scene_count
        remainder = target_duration % scene_count
        
        plan = []
        for i in range(scene_count):
            duration = base_duration + (1 if i < remainder else 0)
            scene_type = "setup" if i == 0 else ("resolution" if i == scene_count - 1 else "conflict")
            plan.append({
                "index": i + 1,
                "type": scene_type,
                "title_suggestion": f"Scène {i + 1}",
                "duration_seconds": duration,
                "purpose": "À définir",
                "key_action": "À définir"
            })
        return plan
