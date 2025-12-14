"""
Scene Validator Service
Validates generated scenes before saving to database.
"""


def validate_generation(
    scenes: list,
    context: dict,
    asset_mapping: dict,
    scene_plan: list
) -> dict:
    """
    Validates that generated scenes meet all constraints.
    
    Returns:
        {
            "valid": bool,
            "errors": [],
            "warnings": []
        }
    """
    errors = []
    warnings = []
    
    target_duration = context.get("target_duration_seconds", 60)
    tolerance = target_duration * 0.10  # 10% tolerance
    
    # 1. Check total duration
    total_duration = sum(s.get("duration_seconds", 0) for s in scenes)
    if abs(total_duration - target_duration) > tolerance:
        errors.append(f"Durée totale ({total_duration}s) trop différente de la cible ({target_duration}s)")
    
    # 2. Check scene count matches plan
    if len(scenes) != len(scene_plan):
        warnings.append(f"Nombre de scènes ({len(scenes)}) différent du plan ({len(scene_plan)})")
    
    # 3. Check character names exist in asset_mapping
    available_chars = set()
    available_locs = set()
    
    for role_name, info in asset_mapping.items():
        asset_name = info.get("name", role_name)
        if info.get("type") == "character":
            available_chars.add(asset_name.lower())
            available_chars.add(role_name.lower())
        elif info.get("type") == "location":
            available_locs.add(asset_name.lower())
            available_locs.add(role_name.lower())
    
    for scene in scenes:
        # Check characters
        for char_name in scene.get("character_names", []):
            if char_name.lower() not in available_chars and len(available_chars) > 0:
                warnings.append(f"Personnage '{char_name}' non trouvé dans les assets disponibles")
        
        # Check location
        loc_name = scene.get("location_name", "")
        if loc_name.lower() not in available_locs and len(available_locs) > 0:
            warnings.append(f"Lieu '{loc_name}' non trouvé dans les assets disponibles")
    
    # 4. Check individual scene durations
    for i, scene in enumerate(scenes):
        scene_duration = scene.get("duration_seconds", 0)
        if i < len(scene_plan):
            planned_duration = scene_plan[i].get("duration_seconds", 0)
            if abs(scene_duration - planned_duration) > 5:
                warnings.append(f"Scène {i+1}: durée ({scene_duration}s) diffère du plan ({planned_duration}s)")
    
    # 5. Check for empty scenes
    for i, scene in enumerate(scenes):
        if not scene.get("title"):
            errors.append(f"Scène {i+1}: titre manquant")
        if not scene.get("summary"):
            warnings.append(f"Scène {i+1}: résumé manquant")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "total_duration": total_duration,
            "target_duration": target_duration,
            "scene_count": len(scenes),
            "planned_scene_count": len(scene_plan)
        }
    }
