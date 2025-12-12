import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
from services.ai_logger import AILogger

# Load env variables (robust path loading)
env_path = Path(__file__).resolve().parent.parent.parent / 'backend/.env'
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent / '.env'
    
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key, transport='rest')

# Initialize Extraction Model (can use Flash for speed/cost)
model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})

EXTRACTOR_SYSTEM_PROMPT = """You are a Video Concept Analyst. Your job is to read a conversation between a user and a Showrunner Agent and extract a structured video concept. 
You must output strictly valid JSON and nothing else. 
The JSON schema must be: 
{
    "title": "string", 
    "genre": "string", 
    "pitch": "string (max 50 words)", 
    "visual_style": "string", 
    "target_audience": "string"
}
If any field is missing information, infer it or use 'TBD'."""

async def extract_concept_from_chat(chat_history_str: str, project_id: int = None) -> dict:
    """
    Analyzes chat history and returns a structured JSON concept.
    """
    # Template with placeholder for RAW view
    prompt_template = f"{EXTRACTOR_SYSTEM_PROMPT}\n\nCHAT HISTORY:\n{{chat_history}}\n\nJSON OUTPUT:"
    
    # Interpolated prompt
    combined_prompt = f"{EXTRACTOR_SYSTEM_PROMPT}\n\nCHAT HISTORY:\n{chat_history_str}\n\nJSON OUTPUT:"
    
    log_id = AILogger.log_interaction(
        service="ConceptExtractor",
        prompt=combined_prompt[:1000] + "..." if len(combined_prompt) > 1000 else combined_prompt,
        prompt_template=prompt_template,
        project_id=project_id
    )
    
    try:
        if not api_key:
            return {"error": "GOOGLE_API_KEY not found."}

        # Check for empty history
        if not chat_history_str.strip() or len(chat_history_str) < 10:
            return {
                "title": "New Project", 
                "genre": "General", 
                "pitch": "No concept discussed yet.", 
                "visual_style": "TBD", 
                "target_audience": "General"
            }

        # Call Gemini API
        response = model.generate_content(combined_prompt)
        
        # Parse JSON
        try:
            concept_data = json.loads(response.text)
            AILogger.update_interaction(
                log_id=log_id,
                response=response.text
            )
            return concept_data
        except json.JSONDecodeError:
            print("Error parsing JSON from AI response")
            AILogger.update_interaction(
                log_id=log_id,
                error="Failed to parse concept JSON"
            )
            return {"error": "Failed to parse concept JSON", "raw": response.text}
            
    except Exception as e:
        print(f"Error calling Gemini API for extraction: {e}")
        AILogger.update_interaction(
            log_id=log_id,
            error=str(e)
        )
        return {"error": f"Extraction failed: {str(e)}"}

