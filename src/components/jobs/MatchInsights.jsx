import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ScoreRing from "@/components/ui/score-ring";
import { CheckCircle2, XCircle, AlertTriangle, Lightbulb, Target, Brain, Zap } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function MatchInsights({ match, job }) {
  if (!match) return null;

  const breakdown = match.score_breakdown || {};
  
  const scoreItems = [
    { label: 'Skill Overlap', value: breakdown.skill_overlap || 0, max: 35, icon: Target, color: 'bg-blue-500' },
    { label: 'Semantic Match', value: breakdown.semantic_similarity || 0, max: 35, icon: Brain, color: 'bg-purple-500' },
    { label: 'Project Relevance', value: breakdown.project_relevance || 0, max: 20, icon: Zap, color: 'bg-amber-500' },
    { label: 'Risk Penalty', value: -(breakdown.risk_penalty || 0), max: 10, icon: AlertTriangle, color: 'bg-red-500', inverted: true },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card className="bg-gradient-to-br from-indigo-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Match Score</h3>
              <p className="text-sm text-slate-500 mt-1">Based on your resume and preferences</p>
            </div>
            <ScoreRing score={match.score_total} size={80} strokeWidth={6} />
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreItems.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <item.icon className={cn("w-4 h-4", item.inverted ? "text-red-500" : "text-slate-500")} />
                  <span className="text-slate-700">{item.label}</span>
                </div>
                <span className={cn("font-medium", item.inverted ? "text-red-600" : "text-slate-900")}>
                  {item.inverted ? item.value : `+${item.value}`}
                </span>
              </div>
              <Progress 
                value={(Math.abs(item.value) / item.max) * 100} 
                className={cn("h-1.5", item.inverted && Math.abs(item.value) > 0 && "bg-red-100")}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Why Match */}
      {match.why_match && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Why This is a Good Match
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 leading-relaxed">{match.why_match}</p>
          </CardContent>
        </Card>
      )}

      {/* Matching Skills */}
      {match.matching_skills?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Matching Skills ({match.matching_skills.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {match.matching_skills.map((skill, i) => (
                <Badge key={i} className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Skills */}
      {match.missing_skills?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              Skills to Develop ({match.missing_skills.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {match.missing_skills.map((skill, i) => (
                <Badge key={i} variant="outline" className="text-red-600 border-red-200">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Projects */}
      {match.recommended_projects?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              Projects to Highlight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {match.recommended_projects.map((project, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-indigo-500 mt-1">•</span>
                  {project}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Matching Resume Bullets */}
      {match.matching_bullets?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Relevant Experience</CardTitle>
            <p className="text-sm text-slate-500">Resume bullets that match this role</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {match.matching_bullets.map((bullet, i) => (
                <li key={i} className="text-sm text-slate-700 pl-4 border-l-2 border-indigo-200">
                  {bullet}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Risk Flags */}
      {match.risk_flags?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              Potential Concerns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {match.risk_flags.map((flag, i) => (
                <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="mt-1">⚠️</span>
                  {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}