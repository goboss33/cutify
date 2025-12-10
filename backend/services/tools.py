from sqlalchemy.orm import Session
from models import ProjectDB, SceneDB

# --- Tool Implementations ---
# These are the actual logic functions.
# They return a string describing what happened (for the AI).

def update_project_details(db: Session, project_id: int, title: str = None, genre: str = None, pitch: str = None, visual_style: str = None, target_audience: str = None):
    """
    Updates the project metadata.
    """
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        return "Error: Project not found."
    
    updates = []
    if title:
        project.title = title
        updates.append(f"Title='{title}'")
    if genre:
        project.genre = genre
        updates.append(f"Genre='{genre}'")
    if pitch:
        project.pitch = pitch
        updates.append(f"Pitch updated")
    if visual_style:
        project.visual_style = visual_style
        updates.append(f"Visual Style updated")
    if target_audience:
        project.target_audience = target_audience
        updates.append(f"Target Audience='{target_audience}'")
        
    db.commit()
    db.refresh(project)
    
    if not updates:
        return "No changes made."
        
    return f"Successfully updated project: {', '.join(updates)}"

def add_scene(db: Session, project_id: int, title: str, summary: str = ""):
    """
    Adds a new scene to the end of the project.
    """
    # Find last sequence order
    last_scene = db.query(SceneDB).filter(SceneDB.project_id == project_id).order_by(SceneDB.sequence_order.desc()).first()
    new_order = (last_scene.sequence_order + 1) if last_scene else 1
    
    new_scene = SceneDB(
        project_id=project_id,
        sequence_order=new_order,
        title=title,
        summary=summary if summary else "No summary provided.",
        status="pending"
    )
    db.add(new_scene)
    db.commit()
    db.refresh(new_scene)
    
    return f"Successfully added scene: {title} (Order: {new_order})"

def delete_scene(db: Session, project_id: int, scene_id_or_title_or_sequence: str):
    """
    Deletes a scene by Sequence Order, ID, or title match.
    1. If digit: tries sequence_order first, then ID.
    2. If string: tries fuzzy match on title.
    """
    # Clean input
    params = scene_id_or_title_or_sequence.lower().replace("scene", "").strip()
    
    scene = None
    
    # helper to find by sequence
    def get_by_sequence(seq):
        return db.query(SceneDB).filter(SceneDB.project_id == project_id, SceneDB.sequence_order == seq).first()

    if params.isdigit():
        val = int(params)
        # Priority 1: Sequence Order (User Mental Model)
        # We assume if user says "2", they mean the 2nd scene, not ID 2 (which might be long deleted).
        # Heuristic: IDs usually grow large, sequences are usually small (1-50).
        scene = get_by_sequence(val)
        
        # Priority 2: ID (Fallback)
        if not scene:
            scene = db.query(SceneDB).filter(SceneDB.id == val, SceneDB.project_id == project_id).first()
            
    else:
        # Fuzzy match or exact match on title
        scene = db.query(SceneDB).filter(SceneDB.project_id == project_id, SceneDB.title.ilike(f"%{scene_id_or_title_or_sequence}%")).first()

    if not scene:
        return f"Could not find a scene matching '{scene_id_or_title_or_sequence}'. Please provide the exact title or scene number."
    
    deleted_title = scene.title
    db.delete(scene)
    db.commit()
    
    # Re-sequence remaining scenes? 
    # Optional but good practice: Shift everyone up.
    # For now, let's just delete. Next explicit reorder will fix gaps, or we leave gaps.
    # Leaving gaps might confuse specific "Scene N" commands later. 
    # Let's simple re-sequence for robustness.
    remaining_scenes = db.query(SceneDB).filter(SceneDB.project_id == project_id).order_by(SceneDB.sequence_order).all()
    for i, s in enumerate(remaining_scenes):
        s.sequence_order = i + 1
    db.commit()
    
    return f"Successfully deleted scene: {deleted_title}"

def reorder_scenes(db: Session, project_id: int, moved_scene_query: str, target_position: int):
    """
    Moves a scene to a new numeric position (1-based).
    """
    # 1. Find the scene
    if moved_scene_query.isdigit():
         scene = db.query(SceneDB).filter(SceneDB.id == int(moved_scene_query), SceneDB.project_id == project_id).first()
    else:
         scene = db.query(SceneDB).filter(SceneDB.project_id == project_id, SceneDB.title.ilike(f"%{moved_scene_query}%")).first()
         
    if not scene:
        return f"Scene '{moved_scene_query}' not found."
    
    # 2. Get all scenes ordered
    all_scenes = db.query(SceneDB).filter(SceneDB.project_id == project_id).order_by(SceneDB.sequence_order).all()
    
    if scene not in all_scenes:
        return "Critical Error: Scene not in project list."
        
    current_index = all_scenes.index(scene)
    target_index = target_position - 1 # 1-based to 0-based
    
    if target_index < 0: target_index = 0
    if target_index >= len(all_scenes): target_index = len(all_scenes) - 1
    
    # 3. Move in list
    all_scenes.pop(current_index)
    all_scenes.insert(target_index, scene)
    
    # 4. Reassign sequence_orders
    for i, s in enumerate(all_scenes):
        s.sequence_order = i + 1
        
    db.commit()
    return f"Successfully moved '{scene.title}' to position {target_position}."
