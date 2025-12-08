import google.generativeai as genai
import os
import json
import asyncio
import replicate

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
# Use a model good at following JSON instructions
model = genai.GenerativeModel('gemini-2.0-flash-exp')

async def generate_shot_prompts(scene_script: str, project_context: dict) -> list[str]:
    """
    Analyzes the script and generates 9 distinct visual prompts for a storyboard.
    Returns a list of 9 strings.
    """
    
    prompt = f"""
    You are an expert Director of Photography and Storyboard Artist.
    Your task is to visualize the following scene script and break it down into exactly 9 key shots (thumbnails) that tell the story visually.
    
    PROJECT CONTEXT:
    Style: {project_context.get('visual_style')}
    Genre: {project_context.get('genre')}
    
    SCENE SCRIPT:
    {scene_script}
    
    INSTRUCTIONS:
    - Generate EXACTLY 9 distinct visual descriptions (prompts) for an image generator (like Midjourney/Flux).
    - Focus on Composition, Lighting, Subject, and Action.
    - Output STRICT JSON ONLY as a list of strings.
    - Example: ["Close up of eye...", "Wide shot of city...", ...]
    """
    
    try:
        response = await model.generate_content_async(prompt)
        text_response = response.text.strip()
        
        if text_response.startswith("```json"):
            text_response = text_response[7:]
        if text_response.startswith("```"):
            text_response = text_response[3:]
        if text_response.endswith("```"):
            text_response = text_response[:-3]
            
        prompts = json.loads(text_response)
        
        # Ensure we have 9 prompts (pad or slice)
        if len(prompts) > 9:
            prompts = prompts[:9]
        while len(prompts) < 9:
            prompts.append(f"Generic shot matching style: {project_context.get('visual_style')}")
            
        return prompts
    except Exception as e:
        print(f"Error generating shot prompts: {e}")
        # Fallback
        return [f"Shot {i+1} for scene" for i in range(9)]

async def generate_images(prompts: list[str]) -> list[str]:
    """
    Takes a list of prompts and returns a list of image URLs.
    Uses Replicate if available, otherwise placeholders.
    """
    replicate_token = os.getenv("REPLICATE_API_TOKEN")
    print(f"DEBUG: Replicate Token: {replicate_token[:5]}..." if replicate_token else "DEBUG: Replicate Token is None")
    
    image_urls = []
    
    if replicate_token:
        print("Using Replicate for image generation...")
        # We process sequentially for safety/rate limits, or parallel if robust. 
        # For v0.8 simplicity, let's do parallel tasks.
        
        async def generate_single_image(prompt):
            try:
                # Run Replicate in a thread executor because it is synchronous logic usually
                # Or use replicate's async client if available? Standard client is sync.
                # We'll use run_in_executor.
                loop = asyncio.get_event_loop()
                output = await loop.run_in_executor(None, lambda: replicate.run(
                    "black-forest-labs/flux-schnell",
                    input={"prompt": prompt}
                ))
                # Output is usually a list of URIs or single URI
                if isinstance(output, list) and len(output) > 0:
                    return str(output[0])
                return str(output)
            except Exception as e:
                print(f"Replicate error for prompt '{prompt[:20]}...': {e}")
                return "https://placehold.co/1024x576/1a1a1a/FFF?text=Gen+Failed"

        tasks = [generate_single_image(p) for p in prompts]
        image_urls = await asyncio.gather(*tasks)
        
    else:
        print("No Replicate token found. Using placeholders.")
        image_urls = [
            f"https://placehold.co/1024x576/1a1a1a/FFF?text=Shot+{i+1}" 
            for i in range(len(prompts))
        ]
        
    return image_urls
