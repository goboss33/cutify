import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load .env variables
from pathlib import Path
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GENAI_API_KEY")
if not api_key:
    print("Warning: GOOGLE_API_KEY not found in .env")

genai.configure(api_key=api_key, transport='rest')

# Initialize the model
model = genai.GenerativeModel('gemini-2.0-flash-exp')

from sqlalchemy.orm import Session
from services.tools import update_project_details, add_scene, delete_scene, reorder_scenes
from services.ai_logger import AILogger

SHOWRUNNER_SYSTEM_PROMPT = """You are the 'Showrunner Agent', a world-class video producer and creative director for the CUTIFY platform. 
Your goal is to guide the user from an initial vague idea to a concrete video concept. 

CORE BEHAVIORS:
1. **Onboarding**: If the project is titled "Untitled Project" or has no genre/pitch, assume the user is starting fresh. Ask what kind of video they want to make. Offer simple examples (e.g., "A YouTube Short, a Music Video, or a Documentary?").
2. **Interactive Concepting**: Don't ask for everything at once. Build the concept step-by-step.
   - First, get the Genre and basic Idea.
   - Then, ask about the Tone/Visual Style.
   - Then, ask about the Target Audience.
3. **Live Updates**: As soon as you have a piece of information (e.g., the user says "It's a horror movie"), USE THE `update_project_metadata` tool to save it. Do not wait for the full concept to be ready. Update incrementally.
4. **Professional & Encouraging**: Be enthusiastic but efficient. Keep responses concise.

Tool Usage:
- Use `update_project_metadata` whenever the user provides new details (Title, Genre, Pitch, etc.).
- Use `add_new_scene` when the user starts describing specific scenes.
"""

async def generate_showrunner_response(user_message: str, chat_history: list = [], db: Session = None, project_id: int = None) -> tuple[str, bool]:
    """
    Generates a response using Gemini Pro with the Showrunner persona.
    Returns: (text_response, action_taken_flag)
    """
    combined_prompt = f"{SHOWRUNNER_SYSTEM_PROMPT}\n\nUser: {user_message}"
    
    log_id = AILogger.log_interaction(
        service="Showrunner (Chat)",
        prompt=f"User: {user_message}"
    )
    
    try:
        if not api_key:
             return "Error: GOOGLE_API_KEY not found. Please check backend/.env.", False

        # --- Tool Configuration ---
        tools_config = []
        
        # We define closures/functions that match the signature Gemini sees (without db/project_id)
        # But we need them to execute with the current db/project_id.
        
        # NOTE: Google GenAI Python SDK's `enable_automatic_function_calling` might struggle with 
        # closures if not strictly typed or global. To be robust, we'll wrap them in a helper 
        # that binds the context if we were doing manual dispatch, OR we update the main Loop.
        
        # For simplicity with the standard SDK, we provide the functions specifically tailored.
        # But wait, we can't easily curry 'db' into them for the SDK's auto-call 
        # effectively unless we define them inside here and pass them.
        
        # Let's try defining them here.
        
        action_taken_container = {"flag": False}
        tools_to_pass = None

        if db and project_id and project_id != 0:
            def update_project_metadata(title: str = None, genre: str = None, pitch: str = None, visual_style: str = None, target_audience: str = None):
                """Updates the project's title, genre, pitch, visual style, or target audience."""
                action_taken_container["flag"] = True
                return update_project_details(db, project_id, title, genre, pitch, visual_style, target_audience)

            def add_new_scene(title: str, summary: str = ""):
                """Adds a new scene to the end of the project. If summary is not provided, uses a default."""
                action_taken_container["flag"] = True
                return add_scene(db, project_id, title, summary)
            
            def delete_existing_scene(scene_id_or_title_or_sequence: str):
                """Deletes a scene by Sequence Number (e.g. '2'), ID, or title."""
                action_taken_container["flag"] = True
                return delete_scene(db, project_id, scene_id_or_title_or_sequence)

            def move_scene(scene_query: str, target_position: int):
                """Moves a scene (found by Sequence Number or Title) to a new numeric position."""
                action_taken_container["flag"] = True
                return reorder_scenes(db, project_id, scene_query, target_position)
            
            tools_to_pass = [update_project_metadata, add_new_scene, delete_existing_scene, move_scene]

        # Initialize model for this request (to bind tools properly)
        # We use the same model name
        if tools_to_pass:
            active_model = genai.GenerativeModel('gemini-2.0-flash-exp', tools=tools_to_pass)
            chat = active_model.start_chat(history=chat_history, enable_automatic_function_calling=True)
        else:
            active_model = genai.GenerativeModel('gemini-2.0-flash-exp')
            chat = active_model.start_chat(history=chat_history)
        
        # Send message (SDK handles tool loop if enabled)
        response = await chat.send_message_async(combined_prompt)
        
        tools_used = "with tools" if action_taken_container["flag"] else "no tools"
        AILogger.update_interaction(
            log_id=log_id,
            response=response.text
        )
        
        return response.text, action_taken_container["flag"]

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        AILogger.update_interaction(
            log_id=log_id,
            error=str(e)
        )
        return f"I'm having trouble connecting to my creative brain right now. Error details: {str(e)}", False

