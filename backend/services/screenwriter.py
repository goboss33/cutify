import google.generativeai as genai
import os
import json

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
# Using gemini-2.0-flash-exp as it is fast and capable
model = genai.GenerativeModel('gemini-2.0-flash-exp')

async def generate_scenes_breakdown(project_data: dict) -> list[dict]:
    """
    Uses Gemini to break down a project concept into a list of scenes.
    
    Args:
        project_data (dict): Contains 'title', 'pitch', 'visual_style', etc.
        
    Returns:
        list[dict]: A list of scene objects strictly following the schema:
                    {"title": str, "summary": str, "estimated_duration": str}
    """
    
    prompt = f"""
    You are an expert Screenwriter. Your job is to take a high-level video concept and break it down into a logical sequence of 5 to 8 distinct scenes.
    
    PROJECT TITLE: {project_data.get('title')}
    GENRE: {project_data.get('genre')}
    PITCH: {project_data.get('pitch')}
    VISUAL STYLE: {project_data.get('visual_style')}
    
    Output STRICT JSON ONLY as a list of objects. Do not include markdown formatting like ```json ... ```.
    Each object must have:
    {{
        "title": "string",
        "summary": "string (approx 2 sentences describing the action)",
        "estimated_duration": "string (e.g. '~30s')"
    }}
    
    Do not include sequence_order, it will be added programmatically.
    """
    
    try:
        response = await model.generate_content_async(prompt)
        text_response = response.text
        
        # Cleanup potential markdown code blocks if the model ignores the instruction
        clean_text = text_response.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
            
        scenes_list = json.loads(clean_text)
        
        if not isinstance(scenes_list, list):
            raise ValueError("AI response is not a list")
            
        return scenes_list
        
    except Exception as e:
        print(f"Error in generate_scenes_breakdown: {e}")
        # Return a fallback or re-raise
        raise e


async def generate_scenes_with_assets(project_data: dict) -> dict:
    """
    Uses Gemini to break down a project concept into scenes WITH characters and locations.
    Also determines which characters/locations appear in each scene.
    
    Args:
        project_data (dict): Contains 'title', 'pitch', 'visual_style', etc.
        
    Returns:
        dict: {
            "scenes": [...],
            "characters": [...],
            "locations": [...],
            "scene_character_map": {scene_index: [character_indices]},
            "scene_location_map": {scene_index: location_index}
        }
    """
    
    prompt = f"""
You are an expert Screenwriter and Production Designer. Your job is to:
1. Break down a video concept into 5-8 distinct scenes
2. Identify ALL characters in the story
3. Identify ALL locations/settings in the story
4. Map which characters and locations appear in each scene

PROJECT TITLE: {project_data.get('title')}
GENRE: {project_data.get('genre')}
PITCH: {project_data.get('pitch')}
VISUAL STYLE: {project_data.get('visual_style')}

Output STRICT JSON ONLY (no markdown). The structure must be:
{{
    "scenes": [
        {{
            "title": "Scene title",
            "summary": "2 sentences describing the action",
            "estimated_duration": "~30s",
            "character_names": ["Character Name 1", "Character Name 2"],
            "location_name": "Location Name"
        }}
    ],
    "characters": [
        {{
            "name": "Character Name",
            "description": "Brief physical description (age, appearance, clothing)"
        }}
    ],
    "locations": [
        {{
            "name": "Location Name",
            "description": "Brief description of the place (ambiance, key visual elements)"
        }}
    ]
}}

IMPORTANT:
- Character names and location names in scenes MUST match exactly those in the characters/locations arrays
- Every character and location must appear in at least one scene
- Be consistent with naming throughout
"""
    
    try:
        response = await model.generate_content_async(prompt)
        text_response = response.text
        
        # Cleanup potential markdown code blocks
        clean_text = text_response.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
            
        result = json.loads(clean_text)
        
        # Validate structure
        if not isinstance(result, dict):
            raise ValueError("AI response is not a dict")
        if "scenes" not in result or "characters" not in result or "locations" not in result:
            raise ValueError("Missing required keys in AI response")
            
        return result
        
    except Exception as e:
        print(f"Error in generate_scenes_with_assets: {e}")
        raise e

