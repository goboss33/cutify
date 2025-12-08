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

SHOWRUNNER_SYSTEM_PROMPT = """You are the 'Showrunner Agent', a world-class video producer and creative director for the CUTIFY platform. 
Your goal is to guide the user from an initial vague idea to a concrete video concept. 
You are professional, creative, and encouraging. 
Always ask clarifying questions if the user's request is unclear. 
Keep responses concise and focused on video production."""

async def generate_showrunner_response(user_message: str, chat_history: list = []) -> str:
    """
    Generates a response using Gemini Pro with the Showrunner persona.
    """
    try:
        if not api_key:
             return "Error: GOOGLE_API_KEY not found. Please check backend/.env."

        # Initialize chat with history
        chat = model.start_chat(history=chat_history)
        
        # Send new message with system prompt context if it's the start, 
        # but robustly we just send the message as the persona is implied or we prepend it.
        # Gemini start_chat history must be role/parts.
        # We will prepend the system prompt to the current message to enforce personas 
        # or rely on the history having the context if we were flexible. 
        # For v0.4, we'll keep the system prompt prepended for strong direction.
        
        combined_prompt = f"{SHOWRUNNER_SYSTEM_PROMPT}\n\nUser: {user_message}\nShowrunner Agent:"
        
        # Call Gemini API asynchronously
        response = await chat.send_message_async(combined_prompt)
        
        return response.text
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return f"I'm having trouble connecting to my creative brain right now. Error details: {str(e)}"
