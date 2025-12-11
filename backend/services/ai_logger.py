from collections import deque
import time
import uuid
import json

# Store last 50 logs in memory
LOG_BUFFER = deque(maxlen=50)

class AILogger:
    @staticmethod
    def log_interaction(service: str, prompt: str, images: list[str] = None, response: str = None, error: str = None):
        """
        Logs an interaction with an AI model.
        
        Args:
            service: Name of the service (e.g., "Director", "AssetGenerator")
            prompt: Reduced or full prompt text
            images: List of image paths (served via static)
            response: The text response from the AI
            error: Error message if failed
        """
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "service": service,
            "prompt": prompt,
            "images": images or [],
            "response": response,
            "error": error,
            "status": "error" if error else "success"
        }
        
        # Prepend to buffer (newest first)
        LOG_BUFFER.appendleft(entry)
        return entry["id"]

    @staticmethod
    def update_interaction(log_id: str, response: str = None, images: list[str] = None, error: str = None):
        """Updates an existing log entry with response data."""
        for entry in LOG_BUFFER:
            if entry["id"] == log_id:
                if response:
                    entry["response"] = response
                if images:
                    # Append or replace? Let's extend input images with output images if distinct? 
                    # Actually, input images are Refs. Output images are Result.
                    # Frontend separates them by prompt vs response currently?
                    # No, frontend uses `images` field for `Prompt` images (Refs).
                    # If I add result images to `images` list, they will show up in "Ref Image" section in current UI.
                    # WE NEED TO FIX THIS in the logger and frontend.
                    
                    # Log structure improvement: split input_images and output_images?
                    # Or just keep `images` list and Frontend logic handles it?
                    # If I use `update_interaction`, the resulting entry will have ONE `images` list.
                    # Currently `images` is strictly used for Refs in prompt phase.
                    
                    # I should add `response_images` to the log structure to be clean.
                    # This requires updating AILog in frontend too.
                    pass
                
                if images:
                     # Check if we should add to 'response_images' (new field)
                     entry["response_images"] = images
                
                if error:
                    entry["error"] = error
                    entry["status"] = "error"
                else:
                    entry["status"] = "success"
                break

    @staticmethod
    def get_logs():
        """Returns all logged interactions."""
        return list(LOG_BUFFER)

    @staticmethod
    def clear_logs():
        LOG_BUFFER.clear()
