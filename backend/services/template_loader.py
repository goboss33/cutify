"""
Template Loader Service V6
Reads prompt templates from JSON files and interpolates variables.
The Template Editor now controls the actual prompts sent to the AI.
"""
import json
import os
import re
from pathlib import Path
from typing import Optional, Tuple

TEMPLATES_DIR = Path(__file__).parent.parent / "prompt_templates"
_template_cache: dict = {}


def clear_template_cache():
    """Clear the template cache to reload templates from disk."""
    global _template_cache
    _template_cache = {}


def load_template(video_type: str) -> Optional[dict]:
    """Load a prompt template by video type slug."""
    if video_type in _template_cache:
        return _template_cache[video_type]
    
    template_path = TEMPLATES_DIR / f"{video_type}.json"
    
    if not template_path.exists():
        template_path = TEMPLATES_DIR / "cinematic.json"
        if not template_path.exists():
            return None
    
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = json.load(f)
            _template_cache[video_type] = template
            return template
    except Exception as e:
        print(f"Error loading template {video_type}: {e}")
        return None


def interpolate_template(template_str: str, variables: dict) -> Tuple[str, str]:
    """
    Interpolate a template string with variables.
    
    Takes a template with {{variable}} placeholders and a variables dict.
    Returns a tuple of (prompt_template, prompt_payload):
    - prompt_template: Original template with {{variable}} intact (for RAW mode)
    - prompt_payload: Template with {{variable}} replaced by actual values (for AI)
    
    Example:
        template = "Hello {{name}}, you are {{age}} years old."
        variables = {"name": "Alice", "age": 30}
        result = interpolate_template(template, variables)
        # Returns:
        # ("Hello {{name}}, you are {{age}} years old.",
        #  "Hello Alice, you are 30 years old.")
    """
    # The template itself is already the RAW version with {{placeholders}}
    prompt_template = template_str
    
    # Create the payload by replacing all {{variable}} with actual values
    prompt_payload = template_str
    
    # Find all {{variable}} patterns
    pattern = r'\{\{(\w+)\}\}'
    
    def replace_var(match):
        var_name = match.group(1)
        if var_name in variables:
            value = variables[var_name]
            # Handle different types
            if isinstance(value, (list, dict)):
                return json.dumps(value, ensure_ascii=False)
            return str(value)
        # If variable not found, leave placeholder as-is
        return match.group(0)
    
    prompt_payload = re.sub(pattern, replace_var, prompt_payload)
    
    return prompt_template, prompt_payload


def get_prompt_template(template: dict, prompt_name: str) -> Optional[str]:
    """Get the template string for a specific prompt from the JSON template."""
    prompts = template.get("prompts", {})
    prompt_config = prompts.get(prompt_name, {})
    return prompt_config.get("template")


def get_output_schema(template: dict, service_name: str) -> dict:
    """
    Get the output schema for a service from the template.
    
    Returns a dict with 'required', 'optional', 'types', 'defaults' keys.
    """
    prompts = template.get("prompts", {})
    service_config = prompts.get(service_name, {})
    return service_config.get("output_schema", {})


def get_input_variables(template: dict, service_name: str) -> list[str]:
    """
    Get list of input variables for a service.
    
    These are the {{variable}} placeholders used in the service's prompt template.
    """
    prompts = template.get("prompts", {})
    service_config = prompts.get(service_name, {})
    return service_config.get("input_variables", [])


def get_pipeline_order(template: dict) -> list[str]:
    """
    Get the ordered list of services to run in the pipeline.
    
    Defaults to the standard order if not specified in the template.
    """
    return template.get("pipeline_order", [
        "context_analyzer",
        "scene_planner",
        "asset_reconciler",
        "screenwriter"
    ])


def is_json_schema(schema: dict) -> bool:
    """
    Check if the schema is in JSON Schema format.
    JSON Schema typically has 'type', 'properties', or '$schema' keys.
    """
    return (
        schema.get("type") in ["object", "array", "string", "number", "boolean", "integer"] or
        "properties" in schema or
        "$schema" in schema or
        "items" in schema
    )


def schema_to_prompt_suffix(output_schema: dict, variables: dict = None) -> str:
    """
    Convert an output_schema into a prompt suffix that instructs the AI to return JSON.
    
    Supports two formats:
    1. JSON Schema (standard): Has 'type', 'properties', '$schema' keys
       -> Injects as-is with strict instructions
    2. Legacy format: Has 'required', 'optional', 'types' keys
       -> Builds sample JSON from field definitions
    
    Args:
        output_schema: The output_schema dict from the template
        variables: Optional dict of variables to interpolate in the schema
        
    Returns:
        A prompt suffix with output instructions
    """
    if not output_schema:
        return ""
    
    # ═══════════════════════════════════════════════════
    # JSON SCHEMA FORMAT (new standard)
    # ═══════════════════════════════════════════════════
    if is_json_schema(output_schema):
        schema_str = json.dumps(output_schema, ensure_ascii=False, indent=2)
        
        # Interpolate variables if provided (e.g., {{duration}} -> 60)
        if variables:
            pattern = r'\{\{(\w+)\}\}'
            def replace_var(match):
                var_name = match.group(1)
                if var_name in variables:
                    value = variables[var_name]
                    if isinstance(value, (list, dict)):
                        return json.dumps(value, ensure_ascii=False)
                    return str(value)
                return match.group(0)
            schema_str = re.sub(pattern, replace_var, schema_str)
        
        return f"""

---
OUTPUT INSTRUCTIONS:
You must respond strictly with a valid JSON object.
Adhere strictly to the following JSON Schema:
{schema_str}"""
    
    # ═══════════════════════════════════════════════════
    # LEGACY FORMAT (backward compatibility)
    # ═══════════════════════════════════════════════════
    sample_json = {}
    
    # Get required and optional fields
    required = output_schema.get("required", [])
    optional = output_schema.get("optional", [])
    types = output_schema.get("types", {})
    defaults = output_schema.get("defaults", {})
    
    all_fields = list(set(required + optional))
    
    if not all_fields:
        return ""
    
    for field in all_fields:
        field_type = types.get(field, "string")
        
        # Use default if available, otherwise generate placeholder
        if field in defaults:
            sample_json[field] = defaults[field]
        elif field_type == "array":
            sample_json[field] = ["...", "..."]
        elif field_type == "number":
            sample_json[field] = "..."
        elif field_type == "object":
            sample_json[field] = {}
        else:
            sample_json[field] = "..."
    
    # Convert to pretty JSON
    json_str = json.dumps(sample_json, ensure_ascii=False, indent=2)
    
    # Interpolate variables if provided (e.g., {{duration}} -> 60)
    if variables:
        pattern = r'\{\{(\w+)\}\}'
        def replace_var(match):
            var_name = match.group(1)
            if var_name in variables:
                value = variables[var_name]
                if isinstance(value, (list, dict)):
                    return json.dumps(value, ensure_ascii=False)
                return str(value)
            return match.group(0)
        json_str = re.sub(pattern, replace_var, json_str)
    
    return f"\n\nRETOURNE CE JSON (remplace les '...' par des vraies valeurs):\n{json_str}"


def get_all_services(template: dict) -> list[dict]:
    """
    Get information about all services defined in a template.
    
    Returns a list of dicts with 'name', 'input_variables', 'output_schema'.
    """
    prompts = template.get("prompts", {})
    services = []
    
    for name, config in prompts.items():
        services.append({
            "name": name,
            "has_template": "template" in config,
            "input_variables": config.get("input_variables", []),
            "output_schema": config.get("output_schema", {}),
        })
    
    return services


def get_all_templates() -> list[dict]:
    """Get all available templates with metadata."""
    templates = []
    if TEMPLATES_DIR.exists():
        for file in sorted(TEMPLATES_DIR.glob("*.json")):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    template = json.load(f)
                    templates.append({
                        "slug": file.stem,
                        "type": template.get("type", file.stem),
                        "name": template.get("name", file.stem),
                        "description": template.get("description", ""),
                        "full_template": template
                    })
            except Exception as e:
                print(f"Error loading template {file}: {e}")
    return templates


def save_template(slug: str, data: dict) -> bool:
    """Save/update a template to disk."""
    template_path = TEMPLATES_DIR / f"{slug}.json"
    
    try:
        # Clear cache for this template
        if slug in _template_cache:
            del _template_cache[slug]
        
        with open(template_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving template {slug}: {e}")
        return False


def delete_template(slug: str) -> bool:
    """Delete a template from disk."""
    template_path = TEMPLATES_DIR / f"{slug}.json"
    
    # Prevent deletion of core templates
    protected = ["cinematic", "advertising", "tutorial"]
    if slug in protected:
        return False
    
    try:
        if slug in _template_cache:
            del _template_cache[slug]
        
        if template_path.exists():
            template_path.unlink()
            return True
        return False
    except Exception as e:
        print(f"Error deleting template {slug}: {e}")
        return False


def create_template(slug: str, data: dict) -> bool:
    """Create a new template."""
    template_path = TEMPLATES_DIR / f"{slug}.json"
    
    if template_path.exists():
        return False  # Already exists
    
    # Add default structure if missing
    if "type" not in data:
        data["type"] = slug
    if "name" not in data:
        data["name"] = slug.replace("_", " ").title()
    
    return save_template(slug, data)




def build_context_prompt(template: dict, inputs: dict) -> tuple[str, str]:
    """
    Build context analyzer prompt by reading from JSON template.
    Returns: (prompt_template with {{placeholders}}, prompt_payload with values)
    """
    # Get template string from JSON
    template_str = get_prompt_template(template, "context_analyzer")
    
    if not template_str:
        # Fallback to hardcoded template if not found in JSON
        print("Warning: context_analyzer template not found in JSON, using fallback")
        template_str = "Tu es un analyste de contexte vidéo. Analyse ce projet."
    
    # Prepare all variables for interpolation
    video_type = template.get("type", "general")
    tags = inputs.get("detected_tags", [])
    answers = inputs.get("user_answers", {})
    
    variables = {
        "video_type": video_type,
        "title": inputs.get("title", ""),
        "pitch": inputs.get("pitch", ""),
        "visual_style": inputs.get("visual_style", ""),
        "duration": inputs.get("duration_seconds", 60),
        "tags_str": ", ".join(tags) if tags else "Aucun",
        "answers_str": "\n".join([f"- {v}" for v in answers.values()]) if answers else "Aucune",
        "language": inputs.get("language", "French"),
    }
    
    # Interpolate and return
    return interpolate_template(template_str, variables)


def build_scene_planner_prompt(template: dict, context: dict) -> tuple[str, str]:
    """
    Build scene planner prompt by reading from JSON template.
    Returns: (prompt_template with {{placeholders}}, prompt_payload with values)
    """
    # Get template string from JSON
    template_str = get_prompt_template(template, "scene_planner")
    
    if not template_str:
        print("Warning: scene_planner template not found in JSON, using fallback")
        template_str = "Tu es un planificateur de scènes. Planifie les scènes."
    
    # Get scene types from template config
    structure = template.get("scene_structure", {})
    scene_types = structure.get("types", ["setup", "content", "conclusion"])
    
    # Prepare variables for interpolation
    characters = context.get("characters_detected", [])
    locations = context.get("locations_detected", [])
    
    variables = {
        "video_type": template.get("type", "general"),
        "visual_style": context.get("fused_visual_style", "Cinematic"),
        "tone": context.get("tone", "Neutre"),
        "target_duration": context.get("target_duration_seconds", 60),
        "suggested_count": context.get("suggested_scene_count", 4),
        "chars_str": ", ".join(characters) if characters else "À définir",
        "locs_str": ", ".join(locations) if locations else "À définir",
        "narrative_arc": context.get("narrative_arc_type", "standard"),
        "scene_types_str": json.dumps(scene_types),
    }
    
    return interpolate_template(template_str, variables)


def build_asset_prompt(template: dict, context: dict, existing_assets: list) -> tuple[str, str]:
    """
    Build asset reconciler prompt by reading from JSON template.
    Returns: (prompt_template with {{placeholders}}, prompt_payload with values)
    """
    # Get template string from JSON
    template_str = get_prompt_template(template, "asset_reconciler")
    
    if not template_str:
        print("Warning: asset_reconciler template not found in JSON, using fallback")
        template_str = "Tu es un gestionnaire d'assets. Identifie les personnages et lieux."
    
    # Prepare variables
    characters = context.get("characters_detected", [])
    locations = context.get("locations_detected", [])
    
    # Format existing assets
    if existing_assets:
        existing_str = "\n".join([
            f"  - ID:{a['id']} [{a['type']}] \"{a['name']}\""
            for a in existing_assets
        ])
    else:
        existing_str = "  AUCUN"
    
    variables = {
        "video_type": template.get("type", "general"),
        "visual_style": context.get("fused_visual_style", "Cinematic"),
        "chars_str": ", ".join(characters) if characters else "À déduire du pitch",
        "locs_str": ", ".join(locations) if locations else "À déduire du pitch",
        "existing_str": existing_str,
    }
    
    return interpolate_template(template_str, variables)


def build_screenwriter_prompt(template: dict, context: dict, scene_plan: list, asset_mapping: dict) -> tuple[str, str]:
    """
    Build screenwriter prompt by reading from JSON template.
    Returns: (prompt_template with {{placeholders}}, prompt_payload with values)
    """
    # Get template string from JSON
    template_str = get_prompt_template(template, "screenwriter")
    
    if not template_str:
        print("Warning: screenwriter template not found in JSON, using fallback")
        template_str = "Tu es un scénariste. Écris les scènes détaillées."
    
    # Build scene plan text
    if scene_plan:
        plan_lines = []
        for s in scene_plan:
            plan_lines.append(f"  - Scène {s.get('index')}: {s.get('type')} ({s.get('duration_seconds')}s) - {s.get('purpose', '')}")
        plan_str = "\n".join(plan_lines)
    else:
        plan_str = "  Pas de plan fourni - crée un plan cohérent"
    
    # Build asset lists from mapping
    characters = [info.get("name", role) for role, info in asset_mapping.items() if info.get("type") == "character"]
    locations = [info.get("name", role) for role, info in asset_mapping.items() if info.get("type") == "location"]
    
    variables = {
        "video_type": template.get("type", "general"),
        "title": context.get("title", ""),
        "pitch": context.get("pitch", ""),
        "visual_style": context.get("fused_visual_style", ""),
        "tone": context.get("tone", ""),
        "language": context.get("language", "French"),
        "target_duration": context.get("target_duration_seconds", 60),
        "plan_str": plan_str,
        "chars_str": ", ".join(characters) if characters else "Définis tes propres personnages",
        "locs_str": ", ".join(locations) if locations else "Définis tes propres lieux",
    }
    
    return interpolate_template(template_str, variables)
