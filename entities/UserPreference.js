{
  "name": "UserPreferences",
  "type": "object",
  "properties": {
    "onboarding_completed": {
      "type": "boolean",
      "default": false
    },
    "location_filters": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Preferred locations"
    },
    "remote_preference": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "remote",
          "hybrid",
          "onsite"
        ]
      }
    },
    "min_score_threshold": {
      "type": "number",
      "default": 50
    },
    "exclude_keywords": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Keywords to avoid (e.g., security clearance)"
    },
    "require_sponsorship": {
      "type": "boolean",
      "default": false
    },
    "target_start_date": {
      "type": "string",
      "description": "e.g., Summer 2026"
    }
  },
  "required": []
}