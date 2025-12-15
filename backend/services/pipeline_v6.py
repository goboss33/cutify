"""
Pipeline V6 Service
New architecture with context accumulation, JSON validation, and dynamic service execution.
"""
import json
import os
import google.generativeai as genai
from typing import Optional

from services.ai_logger import AILogger
from services.pipeline_context import PipelineContext
from services.json_validator import JSONValidator
from services.template_loader import (
    load_template,
    get_prompt_template,
    get_output_schema,
    get_pipeline_order,
    interpolate_template,
    schema_to_prompt_suffix,
    clear_template_cache,
)
from models import ProjectDB

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp', generation_config={"response_mime_type": "application/json"})


async def run_pipeline_v6(
    project_id: int,
    video_type: str,
    inputs: dict,
    existing_assets: list,
    db
) -> dict:
    """
    Run the V6 pipeline with context accumulation and JSON validation.
    
    This pipeline:
    1. Loads the template for the video type
    2. Creates a PipelineContext with initial variables
    3. Runs each service in order, accumulating variables
    4. Validates each service's output against its schema
    5. Saves results to the database
    
    Args:
        project_id: The project ID
        video_type: The type of video (e.g., 'cinematic', 'podcast')
        inputs: Initial inputs from onboarding
        existing_assets: List of existing assets in the project
        db: Database session
    
    Returns:
        Dict with final results including scenes
    """
    # 1. Load template
    template = load_template(video_type)
    if not template:
        template = load_template("cinematic")  # Fallback
    
    # 2. Get project from DB
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        raise ValueError(f"Project {project_id} not found")
    
    # 3. Create pipeline context
    context = PipelineContext(project, template, inputs)
    validator = JSONValidator()
    
    # Add existing assets info to context
    if existing_assets:
        existing_str = "\n".join([
            f"  - ID:{a['id']} [{a['type']}] \"{a['name']}\""
            for a in existing_assets
        ])
    else:
        existing_str = "  AUCUN"
    context.variables["existing_str"] = existing_str
    context.variables["existing_assets"] = existing_assets
    
    # 4. Get pipeline order from template
    pipeline_order = get_pipeline_order(template)
    
    # 5. Run each service
    all_warnings = []
    
    for service_name in pipeline_order:
        print(f"[Pipeline V6] Running service: {service_name}")
        
        # Get prompt template
        prompt_template_str = get_prompt_template(template, service_name)
        if not prompt_template_str:
            print(f"[Pipeline V6] Warning: No template for {service_name}, skipping")
            continue
        
        # Interpolate with current variables
        prompt_raw, prompt_filled = interpolate_template(
            prompt_template_str,
            context.get_variables()
        )
        
        # Get output schema and append to prompt
        schema = get_output_schema(template, service_name)
        schema_suffix = schema_to_prompt_suffix(schema, context.get_variables())
        
        # Final prompt = instructions + schema
        prompt_filled_with_schema = prompt_filled + schema_suffix
        prompt_raw_with_schema = prompt_raw + schema_suffix
        
        # Call Gemini
        try:
            response = model.generate_content(prompt_filled_with_schema)
            response_text = response.text
        except Exception as e:
            error_msg = f"AI call failed for {service_name}: {str(e)}"
            print(f"[Pipeline V6] {error_msg}")
            AILogger.log_interaction(
                project_id=project_id,
                service=service_name,
                prompt=prompt_filled_with_schema,
                prompt_template=prompt_raw_with_schema,
                response="",
                error=error_msg
            )
            continue
        
        # Log to AI Console
        AILogger.log_interaction(
            project_id=project_id,
            service=service_name,
            prompt=prompt_filled_with_schema,
            prompt_template=prompt_raw_with_schema,
            response=response_text
        )
        
        # Validate and extract JSON (schema already fetched above)
        validated_output, warnings = validator.validate_and_extract(
            response_text,
            schema,
            service_name
        )
        
        if warnings:
            all_warnings.extend(warnings)
            for w in warnings:
                print(f"[Pipeline V6] {w}")
        
        # Merge into context for next service
        if validated_output:
            context.merge_service_output(service_name, validated_output)
            print(f"[Pipeline V6] {service_name} output: {list(validated_output.keys())}")
    
    # 6. Save results to database
    _save_pipeline_results(project, context, db)
    
    # 7. Create database entities (scenes, characters, locations)
    scenes = _create_database_entities(project_id, context, db)
    
    return {
        "context": context.get_service_output("context_analyzer") or {},
        "scene_plan": context.get_service_output("scene_planner") or {},
        "asset_plan": context.get_service_output("asset_reconciler") or {},
        "scenes": scenes,
        "warnings": all_warnings,
    }


def _save_pipeline_results(project: ProjectDB, context: PipelineContext, db) -> None:
    """Save pipeline results to project's JSONB fields."""
    db_updates = context.to_db_fields()
    
    for field, value in db_updates.items():
        if hasattr(project, field):
            setattr(project, field, value)
    
    db.commit()
    print(f"[Pipeline V6] Saved results to DB: {list(db_updates.keys())}")


def _create_database_entities(project_id: int, context: PipelineContext, db) -> list:
    """Create scenes, characters, and locations from pipeline results."""
    from models import SceneDB, CharacterDB, LocationDB, scene_characters
    from sqlalchemy import insert
    
    scenes_output = []
    
    # Get screenplay output
    screenplay = context.get_service_output("screenwriter") or {}
    scenes_data = screenplay.get("scenes", [])
    
    if not scenes_data:
        # Fallback to scene_plan if no screenplay
        scene_plan = context.get_service_output("scene_planner") or {}
        scenes_data = scene_plan.get("scene_plan", [])
    
    # Get asset plan for character/location creation
    asset_plan = context.get_service_output("asset_reconciler") or {}
    
    # Create characters if needed
    character_map = {}
    for char_info in asset_plan.get("character_plan", []):
        if char_info.get("action") == "CREATE":
            char_name = char_info.get("role_name", "Unknown")
            existing = db.query(CharacterDB).filter(
                CharacterDB.project_id == project_id,
                CharacterDB.name == char_name
            ).first()
            
            if not existing:
                new_char = CharacterDB(
                    project_id=project_id,
                    name=char_name,
                    description=char_info.get("create_prompt", "")
                )
                db.add(new_char)
                db.flush()
                character_map[char_name.lower()] = new_char
            else:
                character_map[char_name.lower()] = existing
        elif char_info.get("action") == "USE":
            char_name = char_info.get("role_name", "")
            asset_id = char_info.get("existing_asset_id")
            if asset_id:
                existing = db.query(CharacterDB).filter(CharacterDB.id == asset_id).first()
                if existing:
                    character_map[char_name.lower()] = existing
    
    # Create locations if needed
    location_map = {}
    for loc_info in asset_plan.get("location_plan", []):
        if loc_info.get("action") == "CREATE":
            loc_name = loc_info.get("role_name", "Unknown")
            existing = db.query(LocationDB).filter(
                LocationDB.project_id == project_id,
                LocationDB.name == loc_name
            ).first()
            
            if not existing:
                new_loc = LocationDB(
                    project_id=project_id,
                    name=loc_name,
                    description=loc_info.get("create_prompt", "")
                )
                db.add(new_loc)
                db.flush()
                location_map[loc_name.lower()] = new_loc
            else:
                location_map[loc_name.lower()] = existing
        elif loc_info.get("action") == "USE":
            loc_name = loc_info.get("role_name", "")
            asset_id = loc_info.get("existing_asset_id")
            if asset_id:
                existing = db.query(LocationDB).filter(LocationDB.id == asset_id).first()
                if existing:
                    location_map[loc_name.lower()] = existing
    
    # Delete existing scenes for this project
    db.query(SceneDB).filter(SceneDB.project_id == project_id).delete()
    db.flush()
    
    # Create scenes
    for i, scene_data in enumerate(scenes_data):
        if not isinstance(scene_data, dict):
            continue
        
        # Find location for this scene
        location_name = scene_data.get("location_name", "")
        scene_location = location_map.get(location_name.lower()) if location_name else None
        
        # Parse duration
        estimated_duration = scene_data.get("duration_seconds", 15)
        if isinstance(estimated_duration, str):
            try:
                estimated_duration = int(estimated_duration)
            except ValueError:
                estimated_duration = 15
        
        # Create scene
        new_scene = SceneDB(
            project_id=project_id,
            sequence_order=i + 1,
            title=scene_data.get("title", scene_data.get("title_suggestion", f"Scene {i+1}")),
            summary=scene_data.get("summary", scene_data.get("purpose", "")),
            estimated_duration=estimated_duration,
            status="pending",
            location_id=scene_location.id if scene_location else None
        )
        db.add(new_scene)
        db.flush()
        
        # Associate characters
        for char_name in scene_data.get("character_names", []):
            char = character_map.get(char_name.lower())
            if char:
                db.execute(
                    insert(scene_characters).values(
                        scene_id=new_scene.id,
                        character_id=char.id
                    )
                )
        
        scenes_output.append({
            "id": new_scene.id,
            "title": new_scene.title,
            "summary": new_scene.summary,
            "duration": new_scene.estimated_duration,
            "location": scene_location.name if scene_location else None,
        })
    
    db.commit()
    print(f"[Pipeline V6] Created {len(scenes_output)} scenes")
    
    return scenes_output


# For backwards compatibility, keep the old function signature
async def run_pipeline(project_id: int, video_type: str, inputs: dict, existing_assets: list, db):
    """Alias for run_pipeline_v6 for backwards compatibility."""
    return await run_pipeline_v6(project_id, video_type, inputs, existing_assets, db)
