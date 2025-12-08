import os
from PIL import Image
from io import BytesIO
from pathlib import Path

def slice_grid_image(image_bytes: bytes, output_dir: str = "static/shots", scene_id: int = 0) -> tuple[list[str], str | None]:
    """
    Slices a 3x3 grid image into 9 individual images.
    
    Args:
        image_bytes: The raw bytes of the master grid image.
        output_dir: Directory relative to backend (or absolute) to save shots.
        scene_id: Used for naming convenience (e.g., scene_{id}_shot_{i}.png).
        
    Returns:
        List of relative file paths or URLs to the saved images.
    """
    try:
        # Load image from bytes
        img = Image.open(BytesIO(image_bytes))
        
        # Ensure output directory exists
        # Assuming we are running from backend root, so output_dir should be relative or abs
        # Let's make it robust
        base_path = Path(os.getcwd())
        target_dir = base_path / output_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        
        width, height = img.size
        
        # Calculate cell size
        # We assume 3x3 grid strictly
        cell_width = width // 3
        cell_height = height // 3
        
        saved_paths = []
        
        # Save master grid
        master_filename = f"scene_{scene_id}_master_grid.png"
        master_path = target_dir / master_filename
        img.save(master_path, format="PNG")
        master_url = f"/static/shots/{master_filename}"

        shot_count = 1
        for row in range(3):
            for col in range(3):
                left = col * cell_width
                upper = row * cell_height
                right = left + cell_width
                lower = upper + cell_height
                
                # Crop
                # Optional: Crop slightly inward to avoid borders if they exist?
                # For now, exact cut.
                cell_img = img.crop((left, upper, right, lower))
                
                # Filename
                filename = f"scene_{scene_id}_shot_{shot_count}.png"
                file_path = target_dir / filename
                
                # Save
                cell_img.save(file_path, format="PNG")
                
                # We return the URL path expected by frontend
                # If we save to 'static/shots', and mount 'static' at /static
                # Then URL is /static/shots/filename
                # NOTE: main.py mounts 'static' -> app.mount("/static", StaticFiles(directory="static"), name="static")
                # We need to ensure that mount exists or create it.
                # Assuming standard FastAPI static mount pattern.
                
                # Let's return relative path from 'static'
                # The frontend will likely prepend the backend URL.
                # Or we return full relative URL "/static/shots/..."
                saved_paths.append(f"/static/shots/{filename}")
                
                shot_count += 1
                
        return saved_paths, master_url
        
    except Exception as e:
        print(f"Error slicing image: {e}")
        # Return empty list or raise
        return [], None
