{
  "name": "Application",
  "type": "object",
  "properties": {
    "job_id": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "saved",
        "applying",
        "applied",
        "interview",
        "offer",
        "rejected"
      ],
      "default": "saved"
    },
    "applied_date": {
      "type": "string",
      "format": "date"
    },
    "followup_date": {
      "type": "string",
      "format": "date"
    },
    "notes": {
      "type": "string"
    },
    "interview_dates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "format": "date-time"
          },
          "type": {
            "type": "string"
          },
          "notes": {
            "type": "string"
          }
        }
      }
    },
    "timeline": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "format": "date-time"
          },
          "action": {
            "type": "string"
          },
          "details": {
            "type": "string"
          }
        }
      }
    }
  },
  "required": [
    "job_id",
    "status"
  ]
}