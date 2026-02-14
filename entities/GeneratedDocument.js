{
  "name": "GeneratedDocument",
  "type": "object",
  "properties": {
    "job_id": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "cover_letter",
        "answers",
        "resume_variant"
      ]
    },
    "content": {
      "type": "string",
      "description": "Document content (text or JSON)"
    },
    "file_url": {
      "type": "string",
      "description": "URL to generated PDF if applicable"
    },
    "answers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "question": {
            "type": "string"
          },
          "answer": {
            "type": "string"
          }
        }
      },
      "description": "For answers type - question/answer pairs"
    },
    "bullet_tweaks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "original": {
            "type": "string"
          },
          "suggested": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          }
        }
      },
      "description": "For resume_variant type"
    }
  },
  "required": [
    "job_id",
    "type"
  ]
}