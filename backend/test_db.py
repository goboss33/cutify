"""
Test script to debug the /api/projects endpoint
"""
from database import SessionLocal
from models import ProjectDB

print("Testing database query...")
db = SessionLocal()

try:
    # Try to query projects
    projects = db.query(ProjectDB).all()
    print(f"Found {len(projects)} projects")
    
    if projects:
        p = projects[0]
        print(f"First project: id={p.id}, title={p.title}")
        print(f"  - user_id: {getattr(p, 'user_id', 'N/A')}")
        print(f"  - language: {getattr(p, 'language', 'N/A')}")
        print(f"  - context_data: {getattr(p, 'context_data', 'N/A')[:50] if getattr(p, 'context_data', None) else 'None'}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
finally:
    db.close()

print("Test complete!")
