"""
JSON Validator Service V6
Validates and extracts JSON from AI responses.
"""
import json
import re
from typing import Any, Dict, List, Tuple, Optional


class JSONValidator:
    """
    Validates and extracts JSON from AI responses.
    
    Features:
    - Extracts JSON from markdown code blocks
    - Validates against expected schema (required/optional fields)
    - Adds default values for missing optional fields
    - Reports warnings for missing or invalid fields
    
    Usage:
        validator = JSONValidator()
        result, warnings = validator.validate_and_extract(
            raw_response="```json\n{\"tone\": \"dramatic\"}\n```",
            schema={
                "required": ["tone", "characters_detected"],
                "optional": ["mood"],
                "defaults": {"mood": "neutral"}
            },
            service_name="context_analyzer"
        )
    """
    
    def validate_and_extract(
        self,
        raw_response: str,
        schema: dict,
        service_name: str
    ) -> Tuple[dict, List[str]]:
        """
        Validate and extract JSON from an AI response.
        
        Args:
            raw_response: The raw text response from the AI
            schema: Expected output schema with 'required', 'optional', 'types', 'defaults'
            service_name: Name of the service (for error messages)
        
        Returns:
            Tuple of (validated_data, list_of_warnings)
        """
        warnings: List[str] = []
        
        # Step 1: Extract JSON from response
        try:
            data = self._extract_json(raw_response)
        except json.JSONDecodeError as e:
            warnings.append(f"[{service_name}] Failed to parse JSON: {str(e)}")
            return {}, warnings
        except ValueError as e:
            warnings.append(f"[{service_name}] {str(e)}")
            return {}, warnings
        
        if not isinstance(data, dict):
            warnings.append(f"[{service_name}] Expected JSON object, got {type(data).__name__}")
            return {}, warnings
        
        # Step 2: Validate required fields
        required_fields = schema.get("required", [])
        for field in required_fields:
            if field not in data:
                warnings.append(f"[{service_name}] Missing required field: {field}")
        
        # Step 3: Validate field types
        type_specs = schema.get("types", {})
        for field, expected_type in type_specs.items():
            if field in data:
                if not self._check_type(data[field], expected_type):
                    warnings.append(
                        f"[{service_name}] Field '{field}' should be {expected_type}, "
                        f"got {type(data[field]).__name__}"
                    )
        
        # Step 4: Add defaults for missing optional fields
        defaults = schema.get("defaults", {})
        for field, default_value in defaults.items():
            if field not in data:
                data[field] = default_value
        
        return data, warnings
    
    def _extract_json(self, text: str) -> dict:
        """
        Extract JSON from text, handling markdown code blocks.
        
        Handles:
        - Plain JSON: {"key": "value"}
        - Markdown: ```json\n{"key": "value"}\n```
        - Mixed text with JSON embedded
        """
        if not text or not text.strip():
            raise ValueError("Empty response received")
        
        text = text.strip()
        
        # Try 1: Direct JSON parse
        if text.startswith("{") or text.startswith("["):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                pass
        
        # Try 2: Extract from markdown code block
        # Matches ```json ... ``` or ``` ... ```
        code_block_pattern = r"```(?:json)?\s*\n?([\s\S]*?)\n?```"
        matches = re.findall(code_block_pattern, text)
        
        for match in matches:
            match = match.strip()
            if match.startswith("{") or match.startswith("["):
                try:
                    return json.loads(match)
                except json.JSONDecodeError:
                    continue
        
        # Try 3: Find JSON object in text
        # Look for content between first { and last }
        first_brace = text.find("{")
        last_brace = text.rfind("}")
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            potential_json = text[first_brace:last_brace + 1]
            try:
                return json.loads(potential_json)
            except json.JSONDecodeError:
                pass
        
        # Try 4: Find JSON array in text
        first_bracket = text.find("[")
        last_bracket = text.rfind("]")
        
        if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
            potential_json = text[first_bracket:last_bracket + 1]
            try:
                return json.loads(potential_json)
            except json.JSONDecodeError:
                pass
        
        # Nothing worked
        raise ValueError(f"Could not find valid JSON in response (length: {len(text)})")
    
    def _check_type(self, value: Any, expected_type: str) -> bool:
        """
        Check if a value matches the expected type.
        
        Supported types:
        - "string"
        - "number" (int or float)
        - "integer"
        - "array" (list)
        - "object" (dict)
        - "boolean"
        """
        type_mapping = {
            "string": str,
            "number": (int, float),
            "integer": int,
            "array": list,
            "object": dict,
            "boolean": bool,
        }
        
        expected = type_mapping.get(expected_type.lower())
        if expected is None:
            return True  # Unknown type, skip validation
        
        return isinstance(value, expected)
    
    def repair_json(self, text: str) -> Optional[str]:
        """
        Attempt to repair malformed JSON.
        
        Common fixes:
        - Missing closing braces
        - Trailing commas
        - Single quotes instead of double quotes
        """
        if not text:
            return None
        
        text = text.strip()
        
        # Fix 1: Replace single quotes with double quotes
        # Be careful not to replace inside strings
        fixed = re.sub(r"(?<!\\)'", '"', text)
        
        # Fix 2: Remove trailing commas before } or ]
        fixed = re.sub(r",\s*([}\]])", r"\1", fixed)
        
        # Fix 3: Add missing closing braces
        open_braces = fixed.count("{") - fixed.count("}")
        if open_braces > 0:
            fixed += "}" * open_braces
        
        open_brackets = fixed.count("[") - fixed.count("]")
        if open_brackets > 0:
            fixed += "]" * open_brackets
        
        # Try to parse
        try:
            json.loads(fixed)
            return fixed
        except json.JSONDecodeError:
            return None
    
    def get_missing_fields(self, data: dict, schema: dict) -> List[str]:
        """Get list of missing required fields."""
        required = schema.get("required", [])
        return [field for field in required if field not in data]
    
    def is_valid(self, data: dict, schema: dict) -> bool:
        """Check if data satisfies all required fields."""
        missing = self.get_missing_fields(data, schema)
        return len(missing) == 0


# Singleton instance
json_validator = JSONValidator()
