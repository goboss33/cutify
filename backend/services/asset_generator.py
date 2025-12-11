import google.generativeai as genai
import os
import uuid
from pathlib import Path

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)

async def generate_asset_image(prompt: str, asset_type: str, asset_name: str) -> str | None:
    """
    Generates an image for a character or location asset using Gemini.
    Returns the URL of the saved image.
    """
    
    # Build a cinematic prompt
    if asset_type == "character":
        full_prompt = f"""
Generate a cinematic portrait image:

Subject: {asset_name}
Details: {prompt}

Requirements:
- High quality cinematic portrait
- Professional film still aesthetic
- Realistic lighting
- Suitable for a movie character reference
- 3:4 portrait aspect ratio
- Photorealistic style

OUTPUT: Generate ONE high-quality portrait image.
"""
    else:
        full_prompt = f"""
Generate a cinematic location/scene image:

Location: {asset_name}
Details: {prompt}

Requirements:
- Cinematic wide shot or establishing shot
- Professional film still aesthetic
- Atmospheric lighting
- Suitable for a movie location reference
- 16:9 landscape aspect ratio
- Photorealistic style

OUTPUT: Generate ONE high-quality environment image.
"""
    
    try:
        # Use the SAME model as storyboard generation (gemini-3-pro-image-preview)
        # This is the only model that generates images natively
        model = genai.GenerativeModel('gemini-3-pro-image-preview')
        
        response = await model.generate_content_async(full_prompt)
        
        # Extract image from response
        if response.parts:
            for part in response.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    # Save image to static folder
                    image_data = part.inline_data.data
                    
                    # Create unique filename
                    filename = f"asset_{asset_type}_{uuid.uuid4().hex[:8]}.png"
                    static_dir = Path(__file__).parent.parent / "static" / "assets"
                    static_dir.mkdir(parents=True, exist_ok=True)
                    
                    filepath = static_dir / filename
                    with open(filepath, "wb") as f:
                        f.write(image_data)
                    
                    # Return URL path
                    return f"/static/assets/{filename}"
        
        print(f"No image in Gemini response for asset. Text: {response.text[:200] if response.text else 'None'}")
        return None
        
    except Exception as e:
        print(f"Error generating asset image: {e}")
        return None
