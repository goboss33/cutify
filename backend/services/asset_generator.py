import google.generativeai as genai
import os
import uuid
from pathlib import Path
from services.ai_logger import AILogger

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)

async def generate_asset_image(prompt: str, asset_type: str, asset_name: str, style: str = "") -> str | None:
    """
    Generates an image for a character or location asset using Gemini.
    Returns the URL of the saved image.
    """
    
    style_instruction = f"Visual Style: {style}" if style else "Visual Style: Cinematic, Photorealistic"

    # Build a cinematic prompt
    if asset_type == "character":
        full_prompt = f"""
Generate a specific character asset image based on the following requirements:

Subject: {asset_name}
Description: {prompt}
{style_instruction}

COMPOSITION RULES:
- Shot Type: Wide Shot (Full body shot). Ensure the character is fully visible from head to toe.
- Environment: PURE WHITE STUDIO BACKGROUND. Infinite white void.
- Lighting: Soft studio 3-point lighting, flat shading, no cast shadows.
- Props: NONE. Subject stands on the invisible white floor.

Requirements:
- High quality character design
- Professional concept art or film still aesthetic (matching the Visual Style)
- 3:4 portrait aspect ratio
- Focus solely on the character design
- Sharp details, neutral pose appropriate for a character sheet.

OUTPUT: Generate ONE high-quality full-body character image.
"""
    else:
        full_prompt = f"""
Generate a cinematic location/scene image:

Location: {asset_name}
Description: {prompt}
{style_instruction}

Requirements:
- Cinematic wide shot or establishing shot
- Professional film still aesthetic
- Atmospheric lighting
- Suitable for a movie location reference
- 16:9 landscape aspect ratio
- Match the requested Visual Style exactly.

OUTPUT: Generate ONE high-quality environment image.
"""
    
    log_id = None
    try:
        # Use the SAME model as storyboard generation (gemini-3-pro-image-preview)
        # This is the only model that generates images natively
        model = genai.GenerativeModel('gemini-3-pro-image-preview')
        

        
        # Log Interaction
        log_id = AILogger.log_interaction(
            service=f"AssetGenerator ({asset_type})", 
            prompt=full_prompt
        )
        
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
                    url = f"/static/assets/{filename}"
                    AILogger.update_interaction(
                        log_id=log_id,
                        response="Image generated successfully",
                        images=[url]
                    )
                    return url
        
        print(f"No image in Gemini response for asset. Text: {response.text[:200] if response.text else 'None'}")
        return None
        
    except Exception as e:
        print(f"Error generating asset image: {e}")
        if log_id:
            AILogger.update_interaction(
                log_id=log_id,
                error=str(e)
            )
        else:
             AILogger.log_interaction(
                service=f"AssetGenerator ({asset_type})",
                prompt="Pre-execution Error",
                error=str(e)
            )
        return None
