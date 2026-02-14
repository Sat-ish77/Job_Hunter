{
  "name": "Job",
  "type": "object",
  "properties": {
    "source_id": {
      "type": "string",
      "description": "Reference to JobSource"
    },
    "external_id": {
      "type": "string",
      "description": "External job ID from source"
    },
    "title": {
      "type": "string"
    },
    "company": {
      "type": "string"
    },
    "location": {
      "type": "string"
    },
    "remote_type": {
      "type": "string",
      "enum": [
        "remote",
        "hybrid",
        "onsite",
        "unknown"
      ]
    },
    "url": {
      "type": "string",
      "description": "Job listing URL"
    },
    "apply_url": {
      "type": "string",
      "description": "Direct application URL"
    },
    "description_raw": {
      "type": "string",
      "description": "Raw job description"
    },
    "description_clean": {
      "type": "string",
      "description": "Cleaned description text"
    },
    "required_skills": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "preferred_skills": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "years_experience": {
      "type": "string"
    },
    "education_requirement": {
      "type": "string"
    },
    "internship_dates": {
      "type": "string"
    },
    "salary_range": {
      "type": "string"
    },
    "visa_sponsorship": {
      "type": "string",
      "enum": [
        "yes",
        "no",
        "unknown"
      ]
    },
    "visa_keywords_found": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "ats_type": {
      "type": "string"
    },
    "posted_date": {
      "type": "string",
      "format": "date"
    },
    "last_seen": {
      "type": "string",
      "format": "date-time"
    },
    "is_active": {
      "type": "boolean",
      "default": true
    }
  },
  "required": [
    "title",
    "company",
    "url"
  ]
}