import google.generativeai as genai
import os
from services.ai_logger import AILogger

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp')

async def generate_scene_script(scene_title: str, scene_summary: str, project_context: dict) -> str:
    """
    Generates a detailed script for a specific scene.
    
    Args:
        scene_title (str): The title of the scene.
        scene_summary (str): The summary/logline of the scene.
        project_context (dict): Context about the project (title, genre, style).
        
    Returns:
        str: The generated script content (Markdown formatted).
    """
    
    prompt = f"""
    You are an expert Screenwriter. Your job is to write a DETAILED SCRIPT for a specific scene in a video project.
    
    PROJECT CONTEXT:
    Title: {project_context.get('title')}
    Genre: {project_context.get('genre')}
    Visual Style: {project_context.get('visual_style')}
    
    SCENE TO WRITE:
    Title: {scene_title}
    Summary: {scene_summary}
    
    INSTRUCTIONS:
    - Write a standard screenplay format script.
    - Include Scene Heading (EXT/INT).
    - Include Action Descriptions (Visuals).
    - Include Dialogue (if applicable).
    - Be creative and detailed.
    - Return ONLY the script content.
    """
    
    log_id = AILogger.log_interaction(
        service="Scriptwriter",
        prompt=prompt
    )
    
    try:
        response = await model.generate_content_async(prompt)
        AILogger.update_interaction(
            log_id=log_id,
            response=response.text
        )
        return response.text
    except Exception as e:
        print(f"Error in generate_scene_script: {e}")
        AILogger.update_interaction(
            log_id=log_id,
            error=str(e)
        )
        raise e

