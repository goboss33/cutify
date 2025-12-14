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
    
    Args:
        context: Output from context_analyzer
        narrative_template: Template from category preset (optional)
    
    Returns:
        List of scene plans with durations
    """
    
    # Extract context values
    title = context.get("key_narrative_elements", [])
    visual_style = context.get("fused_visual_style", "Cinematic")
    tone = context.get("tone", "Neutre")
    pacing = context.get("pacing", "Modéré")
    target_duration = context.get("target_duration_seconds", 60)
    suggested_count = context.get("suggested_scene_count", 4)
    narrative_arc = context.get("narrative_arc_type", "standard")
    audience = context.get("target_audience", "Grand public")
    
    # Build narrative structure string
    structure_str = "Pas de template"
    if narrative_template:
        structure = narrative_template.get("structure", [])
        if structure:
            parts = []
            for s in structure:
                parts.append(f"{s.get('type', 'scene')} (~{s.get('duration', 10)}s): {s.get('description', '')}")
            structure_str = "\n    ".join(parts)
    
    # Template with placeholders for RAW view
    prompt_template = """{
  "role": "scene_planner",
  "task": "Planifier les scènes avec durées exactes pour respecter la durée cible",
  
  "context": {
    "visual_style": "{{visual_style}}",
    "tone": "{{tone}}",
    "pacing": "{{pacing}}",
    "target_duration_seconds": {{target_duration}},
    "suggested_scene_count": {{suggested_count}},
    "narrative_arc_type": "{{narrative_arc}}",
    "target_audience": "{{audience}}"
  },
  
  "narrative_template": "{{structure_str}}",
  
  "constraints": {
    "total_duration_must_equal": {{target_duration}},
    "tolerance_percent": 5,
    "min_scene_duration": 5,
    "max_scene_duration": 30
  },
  
  "output_required": {
    "scene_plan": [
      {
        "index": 1,
        "type": "setup|conflict|resolution|hook|content|cta|etc",
        "title_suggestion": "string - Titre suggéré pour cette scène",
        "duration_seconds": "number - Durée exacte",
        "purpose": "string - But narratif de cette scène",
        "key_action": "string - Action principale"
      }
    ],
    "total_duration_seconds": "number - Somme des durées (doit = target)",
    "pacing_notes": "string - Notes sur le rythme"
  }
}"""

    # Interpolated prompt for actual API call
    prompt = f"""{{
  "role": "scene_planner",
  "task": "Planifier les scènes avec durées exactes pour respecter la durée cible",
  
  "context": {{
    "visual_style": "{visual_style}",
    "tone": "{tone}",
    "pacing": "{pacing}",
    "target_duration_seconds": {target_duration},
    "suggested_scene_count": {suggested_count},
    "narrative_arc_type": "{narrative_arc}",
    "target_audience": "{audience}"
  }},
  
  "narrative_template": "{structure_str}",
  
  "constraints": {{
    "total_duration_must_equal": {target_duration},
    "tolerance_percent": 5,
    "min_scene_duration": 5,
    "max_scene_duration": 30
  }},
  
  "output_required": {{
    "scene_plan": [
      {{
        "index": 1,
        "type": "setup|conflict|resolution|hook|content|cta|etc",
        "title_suggestion": "string - Titre suggéré pour cette scène",
        "duration_seconds": "number - Durée exacte",
        "purpose": "string - But narratif de cette scène",
        "key_action": "string - Action principale"
      }}
    ],
    "total_duration_seconds": "number - Somme des durées (doit = target)",
    "pacing_notes": "string - Notes sur le rythme"
  }}
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
        # Fallback: simple equal distribution
        scene_duration = target_duration // suggested_count
        return [
            {
                "index": i + 1,
                "type": "scene",
                "title_suggestion": f"Scène {i + 1}",
                "duration_seconds": scene_duration,
                "purpose": "À définir",
                "key_action": "À définir"
            }
            for i in range(suggested_count)
        ]
