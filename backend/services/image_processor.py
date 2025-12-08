import os
from PIL import Image
from io import BytesIO
from pathlib import Path
from supabase import create_client, Client

# Initialize Supabase Client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase: {e}")

def upload_to_supabase(image: Image.Image, filename: str) -> str | None:
    """Uploads a PIL image to Supabase Storage and returns the public URL."""
    try:
        if not supabase:
            return None
            
        # Convert to bytes
        buff = BytesIO()
        image.save(buff, format="PNG")
        buff.seek(0)
        file_bytes = buff.read()
        
        # Upload
        bucket = "shots"
        # content-type is important for browsers to display it
        supabase.storage.from_(bucket).upload(
            path=filename,
            file=file_bytes,
            file_options={"content-type": "image/png", "upsert": "true"}
        )
        
        # Get Public URL
        # The method varies slightly by SDK version, usually get_public_url
        public_url = supabase.storage.from_(bucket).get_public_url(filename)
        return public_url
    except Exception as e:
        print(f"Supabase Upload Error ({filename}): {e}")
        return None

def slice_grid_image(image_bytes: bytes, output_dir: str = "static/shots", scene_id: int = 0) -> tuple[list[str], str | None]:
    """
    Slices a 3x3 grid image into 9 individual images.
    Supports Local Filesystem AND Supabase Storage.
    """
    try:
        # Load image from bytes
        img = Image.open(BytesIO(image_bytes))
        width, height = img.size
        
        # Determine strict 3x3 cell size
        cell_width = width // 3
        cell_height = height // 3
        
        saved_paths = []
        master_url = None
        
        # --- 1. Handle Master Grid ---
        master_filename = f"scene_{scene_id}_master_grid.png"
        
        # Try Supabase First
        if supabase:
            print(f"Uploading master grid to Supabase: {master_filename}")
            master_url = upload_to_supabase(img, master_filename)
            
        # Fallback to Local if Supabase failed or not configured
        if not master_url:
            # Local Save Logic
            base_path = Path(os.getcwd())
            target_dir = base_path / output_dir
            target_dir.mkdir(parents=True, exist_ok=True)
            
            master_path = target_dir / master_filename
            img.save(master_path, format="PNG")
            master_url = f"/static/shots/{master_filename}"

        # --- 2. Handle Slices ---
        shot_count = 1
        for row in range(3):
            for col in range(3):
                left = col * cell_width
                upper = row * cell_height
                right = left + cell_width
                lower = upper + cell_height
                
                cell_img = img.crop((left, upper, right, lower))
                filename = f"scene_{scene_id}_shot_{shot_count}.png"
                
                shot_url = None
                
                # Try Supabase
                if supabase:
                    shot_url = upload_to_supabase(cell_img, filename)
                    
                # Fallback Local
                if not shot_url:
                    # Ensure dir exists (might be redundant but safe)
                    base_path = Path(os.getcwd())
                    target_dir = base_path / output_dir
                    target_dir.mkdir(parents=True, exist_ok=True)
                    
                    file_path = target_dir / filename
                    cell_img.save(file_path, format="PNG")
                    shot_url = f"/static/shots/{filename}"
                
                saved_paths.append(shot_url)
                shot_count += 1
                
        return saved_paths, master_url
        
    except Exception as e:
        print(f"Error slicing/uploading image: {e}")
        return [], None
