import google.generativeai as genai
import os
import json
import asyncio
from PIL import Image
from io import BytesIO

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)

# Use the image generation capable model
model = genai.GenerativeModel('gemini-2.0-flash-exp') # Fallback or Main?
# User requested 'gemini-3-pro-image-preview'.
# Note: Ensure the model name is correct for the API. 
# If 'gemini-3-pro-image-preview' is not available yet in the SDK/Env, we might need a fallback.
# But I will use the requested name.
image_model_name = 'gemini-2.0-flash-exp' # User said gemini-3, but usually it's better to stick to known working one or try strict.
# Wait, user *specifically* asked for `gemini-3-pro-image-preview`.
image_model_name = 'gemini-2.0-flash-exp' 
# IMPORTANT: The user said "le modèle ... doit être modifié pour gemini-3-pro-image-preview".
# I MUST use that name. However, if it fails, the app crashes.
# I'll try to use it, assuming the environment supports it.
# Actually, 'gemini-2.0-flash-exp' is the latest widely known. 'gemini-3-pro-image-preview' sounds like a very specific experimental tag.
# I will use it.

async def generate_storyboard(scene_script: str, project_context: dict, assets: list = []) -> bytes:
    """
    Generates a single 3x3 storyboard grid image using Gemini.
    Returns the image bytes.
    """
    
    style = project_context.get('visual_style', 'Cinematic')
    genre = project_context.get('genre', 'General')
    
    # Build asset context string
    asset_context_str = ""
    if assets:
        asset_context_str = "<reference_assets>\nThe following images are provided as RIGID VISUAL REFERENCES. You MUST respect them for character and location consistency:\n"
        for asset in assets:
            type_label = asset.get('type', 'Asset').capitalize()
            name = asset.get('name', 'Unknown')
            asset_context_str += f"- {type_label}: {name}\n"
        asset_context_str += "</reference_assets>\n"

    prompt = f"""
<role>
You are an award-winning trailer director + cinematographer + storyboard artist. Your job: turn ONE reference image concept into a cohesive cinematic short sequence, then output AI-video-ready keyframes.
</role>

<input>
Context: {style} / {genre}
Scene Script: {scene_script}
{asset_context_str}
</input>

<non-negotiable rules - continuity & truthfulness>
1) First, analyze the full composition: identify ALL key subjects and describe spatial relationships.
2) Strict continuity across ALL shots: same subjects (MATCH PROVIDED REFERENCE IMAGES), same wardrobe, same environment.
3) Depth of field must be realistic.
4) Do NOT introduce new characters not present in the script.
5) USE THE ATTACHED IMAGES AS THE SOURCE OF TRUTH for characters and locations.
</non-negotiable rules - continuity & truthfulness>

<goal>
Expand the scene into a 9-panel cinematic storyboard (3x3 grid).
</goal>

<step 1 - scene breakdown>
Analyze the scene for Subjects, Environment, and Visual Anchors.
</step 1 - scene breakdown>

<step 2 - theme & story>
Propose Theme, Logline, and Emotional Arc.
</step 2 - theme & story>

<step 3 - cinematic approach>
Decide Shot progression, Camera movement, and Light & color.
</step 3 - cinematic approach>

<step 4 - keyframes for AI video>
Plan 9 Keyframes.
</step 4 - keyframes for AI video>

<step 5 - contact sheet output (MUST OUTPUT ONE BIG GRID IMAGE)>
You MUST output ONE single master image: a Cinematic Contact Sheet / Storyboard Grid containing ALL 9 keyframes in one large image.
- Grid: 3x3.
- Requirements:
1) The single master image must include every keyframe as a separate panel.
2) Strict continuity across ALL panels.
3) This image is the FINAL OUTPUT.
</step 5 - contact sheet output>

<final output format>
First, provide the text breakdown (Scene Breakdown, Story, Approach, KFs).
Then, Generate the ONE Master Contact Sheet Image.
</final output format>
    """
    
    try:
        # Prepare content list (Prompt + Images)
        contents = [prompt]
        
        # Load asset images
        for asset in assets:
            path = asset.get('image_path')
            if path and os.path.exists(path):
                try:
                    img = Image.open(path)
                    contents.append(img)
                    print(f"Loaded reference image for {asset.get('name')}: {path}")
                except Exception as e:
                    print(f"Failed to load asset image {path}: {e}")
        
        # Use the specific experimental model requested by the user
        storyboard_model = genai.GenerativeModel('gemini-3-pro-image-preview') 
        
        response = await storyboard_model.generate_content_async(contents)
        
        # Extract Image
        # Look for inline_data
        if response.parts:
            for part in response.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    return part.inline_data.data
                
        # If no image found, print the text to debug rejection
        print(f"No image found in Gemini response. Text content: {response.text}")
        return None

    except Exception as e:
        print(f"Error generating storyboard: {e}")
        return None

