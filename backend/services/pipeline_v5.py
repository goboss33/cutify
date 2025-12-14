"""
Pipeline V5.1 Service
Fixed: Context propagation, duration handling, cleaner flow.
"""
import json
import google.generativeai as genai
import os
from services.ai_logger import AILogger
from services.template_loader import (
    load_template,
    build_context_prompt,
    build_scene_planner_prompt,
    build_asset_prompt,
    build_screenwriter_prompt
)

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp', generation_config={"response_mime_type": "application/json"})


async def run_pipeline_v5(
    project_id: int,
    video_type: str,
    inputs: dict,
    existing_assets: list,
    db
) -> dict:
    """
    Run the complete V5 pipeline with dynamic templates.
    """
    
    # Load template
    template = load_template(video_type)
    if not template:
        template = load_template("cinematic")
    
    result = {
        "video_type": video_type,
        "template_name": template.get("name", video_type) if template else "Unknown"
    }
    
    # ═══════════════════════════════════════════════════
    # STEP 1: Context Analyzer
    # ═══════════════════════════════════════════════════
    context = await _run_context_analyzer(project_id, template, inputs)
    
    # IMPORTANT: Merge original inputs into context for downstream steps
    context["title"] = inputs.get("title", "")
    context["pitch"] = inputs.get("pitch", "")
    
    # Ensure duration is correct
    if "target_duration_seconds" not in context or not isinstance(context.get("target_duration_seconds"), int):
        context["target_duration_seconds"] = inputs.get("duration_seconds", 60)
    
    result["context"] = context
    
    # ═══════════════════════════════════════════════════
    # STEP 2: Scene Planner
    # ═══════════════════════════════════════════════════
    scene_plan = await _run_scene_planner(project_id, template, context)
    result["scene_plan"] = scene_plan
    
    # ═══════════════════════════════════════════════════
    # STEP 3: Asset Reconciler
    # ═══════════════════════════════════════════════════
    asset_plan = await _run_asset_reconciler(project_id, template, context, existing_assets)
    
    # Create missing assets in DB
    asset_mapping = await _create_assets(project_id, asset_plan, db)
    result["asset_mapping"] = asset_mapping
    
    # ═══════════════════════════════════════════════════
    # STEP 4: Screenwriter
    # ═══════════════════════════════════════════════════
    scenes = await _run_screenwriter(project_id, template, context, scene_plan, asset_mapping)
    result["scenes"] = scenes
    
    # ═══════════════════════════════════════════════════
    # STEP 5: Validation
    # ═══════════════════════════════════════════════════
    validation = _validate_output(context, scene_plan, scenes)
    result["validation"] = validation
    
    return result


async def _run_context_analyzer(project_id: int, template: dict, inputs: dict) -> dict:
    """Step 1: Analyze and fuse context."""
    
    prompt_template, prompt_payload = build_context_prompt(template, inputs)
    
    try:
        log_id = AILogger.log_interaction(
            service="ContextAnalyzer",
            prompt=prompt_payload,
            prompt_template=prompt_template,
            project_id=project_id
        )
        
        response = await model.generate_content_async(prompt_payload)
        result_text = response.text.strip()
        result = json.loads(result_text)
        
        AILogger.update_interaction(log_id, response=result_text)
        return result
        
    except Exception as e:
        print(f"Error in context analyzer: {e}")
        # Smart fallback
        pitch = inputs.get("pitch", "").lower()
        visual_style = inputs.get("visual_style", "Cinematic")
        
        # Detect style from pitch
        if "ghibli" in pitch:
            visual_style = f"Ghibli + {visual_style}"
        elif "minecraft" in pitch:
            visual_style = f"Minecraft + {visual_style}"
        elif "pixar" in pitch:
            visual_style = f"Pixar + {visual_style}"
        
        duration = inputs.get("duration_seconds", 60)
        
        return {
            "fused_visual_style": visual_style,
            "tone": "Neutre",
            "pacing": "Modéré",
            "language": "French",
            "target_duration_seconds": duration,
            "suggested_scene_count": max(3, duration // 15),
            "key_narrative_elements": [inputs.get("title", "")],
            "characters_detected": [],
            "locations_detected": [],
            "narrative_arc_type": "fable" if "fable" in pitch else "standard",
            "target_audience": "Grand public",
            "mood": "Léger",
            "_fallback": True,
            "_error": str(e)
        }


async def _run_scene_planner(project_id: int, template: dict, context: dict) -> list:
    """Step 2: Plan scenes with durations."""
    
    prompt_template, prompt_payload = build_scene_planner_prompt(template, context)
    
    try:
        log_id = AILogger.log_interaction(
            service="ScenePlanner",
            prompt=prompt_payload,
            prompt_template=prompt_template,
            project_id=project_id
        )
        
        response = await model.generate_content_async(prompt_payload)
        result_text = response.text.strip()
        result = json.loads(result_text)
        
        AILogger.update_interaction(log_id, response=result_text)
        
        plan = result.get("scene_plan", [])
        
        # Validate we got actual scenes
        if plan and isinstance(plan, list) and len(plan) > 0:
            # Check first scene has proper structure
            first = plan[0]
            if isinstance(first, dict) and "duration_seconds" in first:
                return plan
        
        # If invalid, raise to trigger fallback
        raise ValueError("Invalid scene plan structure")
        
    except Exception as e:
        print(f"Error in scene planner: {e}")
        # Fallback: create a sensible plan
        target = context.get("target_duration_seconds", 60)
        count = max(3, target // 20)
        base_duration = target // count
        remainder = target % count
        
        structure = template.get("scene_structure", {})
        types = structure.get("types", ["setup", "content", "conclusion"])
        
        plan = []
        for i in range(count):
            duration = base_duration + (1 if i < remainder else 0)
            scene_type = types[min(i, len(types)-1)] if i < len(types) else types[-1]
            plan.append({
                "index": i + 1,
                "type": scene_type,
                "title_suggestion": f"Scène {i + 1}",
                "duration_seconds": duration,
                "purpose": "À définir",
                "key_action": "À définir"
            })
        return plan


async def _run_asset_reconciler(project_id: int, template: dict, context: dict, existing_assets: list) -> dict:
    """Step 3: Identify and match assets."""
    
    prompt_template, prompt_payload = build_asset_prompt(template, context, existing_assets)
    
    try:
        log_id = AILogger.log_interaction(
            service="AssetReconciler",
            prompt=prompt_payload,
            prompt_template=prompt_template,
            project_id=project_id
        )
        
        response = await model.generate_content_async(prompt_payload)
        result_text = response.text.strip()
        result = json.loads(result_text)
        
        AILogger.update_interaction(log_id, response=result_text)
        
        # Validate we got actual plans
        char_plan = result.get("character_plan", [])
        loc_plan = result.get("location_plan", [])
        
        if char_plan and isinstance(char_plan, list):
            first = char_plan[0] if char_plan else {}
            if isinstance(first, dict) and "action" in first:
                return result
        
        raise ValueError("Invalid asset plan structure")
        
    except Exception as e:
        print(f"Error in asset reconciler: {e}")
        # Fallback: use detected characters/locations
        visual_style = context.get("fused_visual_style", "Cinematic")
        characters = context.get("characters_detected", [])
        locations = context.get("locations_detected", [])
        
        char_plan = []
        for char in characters:
            # Check if exists
            exists = any(a["name"].lower() == char.lower() for a in existing_assets if a["type"] == "character")
            if exists:
                existing = next(a for a in existing_assets if a["name"].lower() == char.lower() and a["type"] == "character")
                char_plan.append({"role_name": char, "action": "USE", "existing_asset_id": existing["id"]})
            else:
                char_plan.append({"role_name": char, "action": "CREATE", "create_prompt": f"{char} style {visual_style}"})
        
        loc_plan = []
        for loc in locations:
            exists = any(a["name"].lower() == loc.lower() for a in existing_assets if a["type"] == "location")
            if exists:
                existing = next(a for a in existing_assets if a["name"].lower() == loc.lower() and a["type"] == "location")
                loc_plan.append({"role_name": loc, "action": "USE", "existing_asset_id": existing["id"]})
            else:
                loc_plan.append({"role_name": loc, "action": "CREATE", "create_prompt": f"{loc} style {visual_style}"})
        
        return {"character_plan": char_plan, "location_plan": loc_plan, "object_plan": [], "_fallback": True}


async def _create_assets(project_id: int, asset_plan: dict, db) -> dict:
    """Create missing assets in database."""
    from models import CharacterDB, LocationDB
    
    mapping = {}
    
    # Create characters
    for char in asset_plan.get("character_plan", []):
        action = str(char.get("action", "")).upper()
        name = char.get("role_name", "Unknown")
        
        if action == "CREATE":
            try:
                new_char = CharacterDB(
                    project_id=project_id,
                    name=name,
                    description=char.get("create_prompt", ""),
                    traits=""
                )
                db.add(new_char)
                db.commit()
                db.refresh(new_char)
                mapping[name] = {"type": "character", "id": new_char.id, "name": name}
            except Exception as e:
                print(f"Error creating character {name}: {e}")
                db.rollback()
        elif action == "USE":
            mapping[name] = {
                "type": "character",
                "id": char.get("existing_asset_id"),
                "name": char.get("existing_asset_name", name)
            }
    
    # Create locations
    for loc in asset_plan.get("location_plan", []):
        action = str(loc.get("action", "")).upper()
        name = loc.get("role_name", "Unknown")
        
        if action == "CREATE":
            try:
                new_loc = LocationDB(
                    project_id=project_id,
                    name=name,
                    description=loc.get("create_prompt", "")
                )
                db.add(new_loc)
                db.commit()
                db.refresh(new_loc)
                mapping[name] = {"type": "location", "id": new_loc.id, "name": name}
            except Exception as e:
                print(f"Error creating location {name}: {e}")
                db.rollback()
        elif action == "USE":
            mapping[name] = {
                "type": "location",
                "id": loc.get("existing_asset_id"),
                "name": loc.get("existing_asset_name", name)
            }
    
    return mapping


async def _run_screenwriter(project_id: int, template: dict, context: dict, scene_plan: list, asset_mapping: dict) -> list:
    """Step 4: Generate detailed scenes."""
    
    prompt_template, prompt_payload = build_screenwriter_prompt(template, context, scene_plan, asset_mapping)
    
    try:
        log_id = AILogger.log_interaction(
            service="ScreenwriterV5",
            prompt=prompt_payload,
            prompt_template=prompt_template,
            project_id=project_id
        )
        
        response = await model.generate_content_async(prompt_payload)
        result_text = response.text.strip()
        result = json.loads(result_text)
        
        AILogger.update_interaction(log_id, response=result_text)
        
        scenes = result.get("scenes", [])
        if scenes and isinstance(scenes, list) and len(scenes) > 0:
            return scenes
        
        raise ValueError("No scenes in response")
        
    except Exception as e:
        print(f"Error in screenwriter: {e}")
        # Fallback: convert scene plan to basic scenes
        characters = [info.get("name") for info in asset_mapping.values() if info.get("type") == "character"]
        locations = [info.get("name") for info in asset_mapping.values() if info.get("type") == "location"]
        
        scenes = []
        for s in scene_plan:
            scenes.append({
                "index": s.get("index", len(scenes) + 1),
                "title": s.get("title_suggestion", f"Scène {s.get('index', len(scenes) + 1)}"),
                "summary": s.get("purpose", "À écrire"),
                "duration_seconds": s.get("duration_seconds", 15),
                "character_names": characters[:2] if characters else [],
                "location_name": locations[0] if locations else ""
            })
        
        return scenes


def _validate_output(context: dict, scene_plan: list, scenes: list) -> dict:
    """Step 5: Validate output."""
    errors = []
    warnings = []
    
    target = context.get("target_duration_seconds", 60)
    
    # Check total duration
    total = sum(s.get("duration_seconds", 0) for s in scenes)
    tolerance = target * 0.20  # 20% tolerance
    
    if abs(total - target) > tolerance:
        errors.append(f"Durée totale ({total}s) trop différente de la cible ({target}s)")
    
    # Check scene count
    if len(scenes) < 2:
        errors.append(f"Trop peu de scènes ({len(scenes)})")
    
    # Check for empty fields
    for i, s in enumerate(scenes):
        if not s.get("title"):
            warnings.append(f"Scène {i+1}: titre manquant")
        if not s.get("summary"):
            warnings.append(f"Scène {i+1}: résumé manquant")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "target_duration": target,
            "actual_duration": total,
            "scene_count": len(scenes)
        }
    }
