{
  "name": "JobMatch",
  "type": "object",
  "properties": {
    "job_id": {
      "type": "string",
      "description": "Reference to Job"
    },
    "score_total": {
      "type": "number",
      "description": "Overall match score 0-100"
    },
    "score_breakdown": {
      "type": "object",
      "properties": {
        "skill_overlap": {
          "type": "number"
        },
        "semantic_similarity": {
          "type": "number"
        },
        "project_relevance": {
          "type": "number"
        },
        "risk_penalty": {
          "type": "number"
        }
      }
    },
    "matching_skills": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "missing_skills": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "matching_bullets": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Resume bullets that match this job"
    },
    "recommended_projects": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Projects to highlight for this job"
    },
    "why_match": {
      "type": "string",
      "description": "AI explanation of why this is a good match"
    },
    "risk_flags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "job_id",
    "score_total"
  ]
}