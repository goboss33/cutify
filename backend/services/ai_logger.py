import uuid
import json
from datetime import datetime
from sqlalchemy.orm import Session

# Import database models
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import AILogDB
from database import SessionLocal

class AILogger:
    @staticmethod
    def log_interaction(
        service: str, 
        prompt: str, 
        prompt_template: str = None, 
        images: list[str] = None, 
        response: str = None, 
        error: str = None,
        project_id: int = None
    ) -> str:
        """
        Logs an interaction with an AI model to the database.
        
        Args:
            service: Name of the service (e.g., "Director", "AssetGenerator")
            prompt: The interpolated prompt text (with actual values)
            prompt_template: The raw template with placeholders (e.g., "Title: {{title}}")
            images: List of image paths (served via static)
            response: The text response from the AI
            error: Error message if failed
            project_id: Optional project ID to associate with this log
            
        Returns:
            str: The UUID of the created log entry
        """
        log_uuid = str(uuid.uuid4())
        
        db = SessionLocal()
        try:
            log_entry = AILogDB(
                uuid=log_uuid,
                project_id=project_id,
                service=service,
                prompt=prompt,
                prompt_template=prompt_template,
                images=json.dumps(images or []),
                response=response,
                response_images=None,
                error=error,
                status="error" if error else ("pending" if not response else "success"),
                created_at=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()
            return log_uuid
        except Exception as e:
            print(f"AILogger.log_interaction error: {e}")
            db.rollback()
            return log_uuid
        finally:
            db.close()

    @staticmethod
    def update_interaction(
        log_id: str, 
        response: str = None, 
        images: list[str] = None, 
        error: str = None
    ):
        """Updates an existing log entry with response data."""
        db = SessionLocal()
        try:
            log_entry = db.query(AILogDB).filter(AILogDB.uuid == log_id).first()
            if log_entry:
                if response:
                    log_entry.response = response
                if images:
                    log_entry.response_images = json.dumps(images)
                if error:
                    log_entry.error = error
                    log_entry.status = "error"
                else:
                    log_entry.status = "success"
                db.commit()
        except Exception as e:
            print(f"AILogger.update_interaction error: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    def get_logs(project_id: int = None, limit: int = 50) -> list[dict]:
        """
        Returns logged interactions from the database.
        
        Args:
            project_id: Optional filter by project ID
            limit: Maximum number of logs to return (default 50)
            
        Returns:
            list[dict]: List of log entries
        """
        db = SessionLocal()
        try:
            query = db.query(AILogDB).order_by(AILogDB.created_at.desc())
            
            if project_id is not None:
                query = query.filter(AILogDB.project_id == project_id)
            
            logs = query.limit(limit).all()
            
            return [
                {
                    "id": log.uuid,
                    "timestamp": log.created_at.timestamp(),
                    "service": log.service,
                    "prompt": log.prompt,
                    "prompt_template": log.prompt_template,
                    "images": json.loads(log.images) if log.images else [],
                    "response": log.response,
                    "response_images": json.loads(log.response_images) if log.response_images else [],
                    "error": log.error,
                    "status": log.status,
                    "project_id": log.project_id
                }
                for log in logs
            ]
        except Exception as e:
            print(f"AILogger.get_logs error: {e}")
            return []
        finally:
            db.close()

    @staticmethod
    def clear_logs(project_id: int = None):
        """
        Clears logs from the database.
        
        Args:
            project_id: Optional filter to only clear logs for a specific project
        """
        db = SessionLocal()
        try:
            query = db.query(AILogDB)
            if project_id is not None:
                query = query.filter(AILogDB.project_id == project_id)
            query.delete()
            db.commit()
        except Exception as e:
            print(f"AILogger.clear_logs error: {e}")
            db.rollback()
        finally:
            db.close()
