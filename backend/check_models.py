import os
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

# Load env correctly
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key, transport='rest')

print("Listing available models...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error: {e}")
