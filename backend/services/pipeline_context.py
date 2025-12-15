"""
Pipeline Context Service V6
Accumulates variables from each service for the next one.
"""
import json
import re
from typing import Any, Dict, Optional


class PipelineContext:
    """
    Accumulates variables from each AI service for the next one.
    
    This allows the output of ContextAnalyzer (e.g., 'tone', 'characters_detected')
    to be used as input variables in ScenePlanner's prompt template.
    
    Usage:
        context = PipelineContext(project, template)
        
        # After ContextAnalyzer runs
        context.merge_service_output("context_analyzer", {"tone": "Moralistic", ...})
        
        # ScenePlanner can now use {{tone}} in its prompt
        vars = context.get_variables()  # includes 'tone'
    """
    
    def __init__(self, project, template: dict, initial_inputs: dict = None):
        """
        Initialize the context with project data and template.
        
        Args:
            project: The ProjectDB instance
            template: The loaded template dict (from JSON)
            initial_inputs: Optional additional inputs (e.g., onboarding data)
        """
        self.template = template
        self.project = project
        
        # Core variables from project
        self.variables: Dict[str, Any] = {
            # Video type from template
            "video_type": template.get("type", "general"),
            
            # User inputs
            "title": getattr(project, "title", "") or "",
            "pitch": getattr(project, "pitch", "") or "",
            "visual_style": getattr(project, "visual_style", "") or "",
            "target_audience": getattr(project, "target_audience", "") or "",
            "language": getattr(project, "language", "French") or "French",
            "duration": self._parse_duration(getattr(project, "target_duration", "60s")),
            "aspect_ratio": getattr(project, "aspect_ratio", "16:9") or "16:9",
        }
        
        # Add onboarding context if available
        onboarding = getattr(project, "onboarding_context", None)
        if onboarding:
            try:
                onboarding_data = json.loads(onboarding) if isinstance(onboarding, str) else onboarding
                tags = onboarding_data.get("detected_tags", [])
                answers = onboarding_data.get("ai_answers", {})
                
                self.variables["tags_str"] = ", ".join(tags) if tags else "Aucun"
                self.variables["answers_str"] = "\n".join([f"- {v}" for v in answers.values()]) if answers else "Aucune"
                self.variables["detected_tags"] = tags
                self.variables["user_answers"] = answers
            except (json.JSONDecodeError, TypeError):
                self.variables["tags_str"] = "Aucun"
                self.variables["answers_str"] = "Aucune"
                self.variables["detected_tags"] = []
                self.variables["user_answers"] = {}
        else:
            self.variables["tags_str"] = "Aucun"
            self.variables["answers_str"] = "Aucune"
            self.variables["detected_tags"] = []
            self.variables["user_answers"] = {}
        
        # Merge any additional inputs
        if initial_inputs:
            for key, value in initial_inputs.items():
                if value is not None:
                    self.variables[key] = value
        
        # Track outputs by service (for saving to DB later)
        self.service_outputs: Dict[str, dict] = {}
        
        # Track which variables came from which service
        self.variable_sources: Dict[str, str] = {}
    
    def _parse_duration(self, duration_str: str) -> int:
        """Parse duration string like '60s' or '2m30s' to seconds."""
        if isinstance(duration_str, int):
            return duration_str
        
        if not duration_str:
            return 60
        
        # Handle "60s" format
        match = re.match(r"(\d+)s?$", str(duration_str))
        if match:
            return int(match.group(1))
        
        # Handle "2m30s" or "2m" format
        minutes = 0
        seconds = 0
        
        m_match = re.search(r"(\d+)m", str(duration_str))
        if m_match:
            minutes = int(m_match.group(1))
        
        s_match = re.search(r"(\d+)s", str(duration_str))
        if s_match:
            seconds = int(s_match.group(1))
        
        if minutes or seconds:
            return minutes * 60 + seconds
        
        # Fallback: try to parse as integer
        try:
            return int(duration_str)
        except (ValueError, TypeError):
            return 60
    
    def merge_service_output(self, service_name: str, output: dict) -> None:
        """
        Merge output from a service into available variables.
        
        Args:
            service_name: Name of the service (e.g., 'context_analyzer')
            output: The validated JSON output from the service
        """
        if not output or not isinstance(output, dict):
            return
        
        # Store the raw output for DB persistence
        self.service_outputs[service_name] = output
        
        # Merge each key into variables
        for key, value in output.items():
            self.variables[key] = value
            self.variable_sources[key] = service_name
        
        # Create convenience string representations for arrays
        if "characters_detected" in output and isinstance(output["characters_detected"], list):
            self.variables["chars_str"] = ", ".join(output["characters_detected"]) or "À définir"
        
        if "locations_detected" in output and isinstance(output["locations_detected"], list):
            self.variables["locs_str"] = ", ".join(output["locations_detected"]) or "À définir"
        
        if "scene_plan" in output and isinstance(output["scene_plan"], list):
            plan_lines = []
            for s in output["scene_plan"]:
                if isinstance(s, dict):
                    plan_lines.append(
                        f"  - Scène {s.get('index', '?')}: {s.get('type', '?')} "
                        f"({s.get('duration_seconds', 0)}s) - {s.get('purpose', '')}"
                    )
            self.variables["plan_str"] = "\n".join(plan_lines) if plan_lines else "Pas de plan"
    
    def get_variables(self) -> Dict[str, Any]:
        """Get all available variables for template interpolation."""
        return self.variables.copy()
    
    def get_variable(self, name: str, default: Any = None) -> Any:
        """Get a specific variable by name."""
        return self.variables.get(name, default)
    
    def get_service_output(self, service_name: str) -> Optional[dict]:
        """Get the raw output from a specific service."""
        return self.service_outputs.get(service_name)
    
    def get_all_outputs(self) -> Dict[str, dict]:
        """Get all service outputs (for DB persistence)."""
        return self.service_outputs.copy()
    
    def get_variable_source(self, variable_name: str) -> Optional[str]:
        """Get which service generated a variable."""
        return self.variable_sources.get(variable_name)
    
    def to_db_fields(self) -> dict:
        """
        Convert service outputs to database fields.
        
        Returns a dict that can be used to update ProjectDB:
        {
            'context_data': json_string,
            'scene_plan_data': json_string,
            ...
        }
        """
        field_mapping = {
            "context_analyzer": "context_data",
            "scene_planner": "scene_plan_data",
            "asset_reconciler": "asset_plan_data",
            "screenwriter": "screenplay_data",
        }
        
        result = {}
        for service_name, db_field in field_mapping.items():
            if service_name in self.service_outputs:
                result[db_field] = json.dumps(self.service_outputs[service_name], ensure_ascii=False)
        
        return result
    
    def __repr__(self) -> str:
        return f"<PipelineContext variables={list(self.variables.keys())} outputs={list(self.service_outputs.keys())}>"
