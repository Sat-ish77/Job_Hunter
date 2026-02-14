/**
 * JobCard Component - Modern Glassmorphism Design
 * 
 * Features:
 * - Glass-style card with backdrop blur
 * - Color-coded match score ring (green/yellow/red)
 * - Clean "Apply Now" button
 * - Professional dark theme
 */

import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ScoreRing from "@/components/ui/score-ring";
import { MapPin, Building2, Calendar, Briefcase, ExternalLink, Bookmark, BookmarkCheck, ArrowRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function JobCard({ job, match, application, onSave, onUnsave, compact = false }) {
  const isSaved = !!application;
  
  // Get match score color
  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };
  
  const getRemoteBadge = (type) => {
    const styles = {
      remote: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      hybrid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      on_site: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      unknown: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };
    return styles[type] || styles.unknown;
  };

  const getVisaBadge = (status) => {
    if (status === 'yes') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (status === 'no') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return null;
  };

  const matchScore = match?.score_total || 0;

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10",
      "bg-slate-900/50 backdrop-blur-md border-white/10 hover:border-blue-500/30",
      compact ? "p-4" : "p-5"
    )}>
      <div className="flex gap-4">
        {/* Match Score Ring */}
        {match && match.score_total !== undefined ? (
          <div className="flex-shrink-0">
            <ScoreRing score={match.score_total} size={compact ? 44 : 56} />
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center justify-center w-14 h-14">
            <Badge variant="outline" className="text-xs bg-slate-800/50 text-slate-400 border-white/10">
              New
            </Badge>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link 
                to={createPageUrl(`JobDetail?id=${job.id}`)}
                className="block"
              >
                <h3 className={cn(
                  "font-semibold text-slate-100 hover:text-blue-400 transition-colors",
                  compact ? "text-sm" : "text-base"
                )}>
                  {job.title}
                </h3>
              </Link>
              <div className="flex items-center gap-2 mt-1 text-slate-400">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{job.company}</span>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "flex-shrink-0 h-8 w-8",
                isSaved ? "text-blue-400 hover:bg-blue-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              )}
              onClick={(e) => {
                e.preventDefault();
                isSaved ? onUnsave?.(application.id) : onSave?.(job.id);
              }}
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </Button>
          </div>
          
          {/* Info badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {job.location && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{job.location}</span>
              </div>
            )}
            
            {job.remote_type && job.remote_type !== 'unknown' && (
              <Badge variant="outline" className={cn("text-xs capitalize", getRemoteBadge(job.remote_type))}>
                {job.remote_type === 'on_site' ? 'On-site' : job.remote_type}
              </Badge>
            )}
            
            {job.visa_sponsorship && getVisaBadge(job.visa_sponsorship) && (
              <Badge variant="outline" className={cn("text-xs", getVisaBadge(job.visa_sponsorship))}>
                {job.visa_sponsorship === 'yes' ? '✓ Sponsors' : 'No Sponsorship'}
              </Badge>
            )}
            
            {job.internship_dates && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="w-3 h-3" />
                <span>{job.internship_dates}</span>
              </div>
            )}
          </div>
          
          {/* Description preview */}
          {!compact && job.description_clean && (
            <p className="mt-3 text-sm text-slate-400 line-clamp-2">
              {job.description_clean.substring(0, 150)}...
            </p>
          )}
          
          {/* Matching skills */}
          {!compact && match && match.matching_skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {match.matching_skills.slice(0, 5).map((skill, i) => (
                <Badge key={i} variant="secondary" className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">
                  {skill}
                </Badge>
              ))}
              {match.matching_skills.length > 5 && (
                <Badge variant="secondary" className="text-xs bg-slate-800/50 text-slate-400 border-white/10">
                  +{match.matching_skills.length - 5}
                </Badge>
              )}
            </div>
          )}
          
          {/* Required skills if no match */}
          {!compact && !match && job.required_skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {job.required_skills.slice(0, 5).map((skill, i) => (
                <Badge key={i} variant="secondary" className="text-xs bg-slate-800/50 text-slate-400 border-white/10">
                  {skill}
                </Badge>
              ))}
              {job.required_skills.length > 5 && (
                <Badge variant="secondary" className="text-xs bg-slate-800/50 text-slate-500 border-white/10">
                  +{job.required_skills.length - 5}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer with actions */}
      {!compact && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {job.ats_type && (
              <Badge variant="outline" className="text-xs capitalize bg-slate-800/30 text-slate-400 border-white/10">
                {job.ats_type}
              </Badge>
            )}
            {job.posted_date && (
              <span>Posted {new Date(job.posted_date).toLocaleDateString()}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-slate-800/50 border-white/10 text-slate-200 hover:bg-slate-700"
              asChild
            >
              <a href={job.apply_url || job.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1.5" />
                View Job
              </a>
            </Button>
            <Button
              size="sm"
              className="text-xs bg-blue-500 hover:bg-blue-600 text-white"
              asChild
            >
              <Link to={createPageUrl(`JobDetail?id=${job.id}`)}>
                Apply Now
                <ArrowRight className="w-3 h-3 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
