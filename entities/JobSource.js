{
  "name": "JobSource",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Source name (e.g., Google Careers)"
    },
    "type": {
      "type": "string",
      "enum": [
        "greenhouse",
        "lever",
        "career_page",
        "other"
      ],
      "description": "Type of job source"
    },
    "url": {
      "type": "string",
      "description": "Base URL for the job source"
    },
    "is_active": {
      "type": "boolean",
      "default": true
    },
    "last_fetched": {
      "type": "string",
      "format": "date-time"
    },
    "jobs_found": {
      "type": "number",
      "default": 0
    }
  },
  "required": [
    "name",
    "type",
    "url"
  ]
}