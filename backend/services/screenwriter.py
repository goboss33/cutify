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
