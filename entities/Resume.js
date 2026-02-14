{
  "name": "Resume",
  "type": "object",
  "properties": {
    "resume_text": {
      "type": "string",
      "description": "Full resume text content"
    },
    "file_url": {
      "type": "string",
      "description": "URL to uploaded resume PDF"
    },
    "target_roles": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Target role types (e.g., Data Engineer Intern, ML Intern)"
    },
    "skills": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Extracted skills from resume"
    },
    "experience_bullets": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Key experience bullets for matching"
    },
    "education": {
      "type": "string",
      "description": "Education summary"
    },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "technologies": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      }
    }
  },
  "required": [
    "resume_text"
  ]
}