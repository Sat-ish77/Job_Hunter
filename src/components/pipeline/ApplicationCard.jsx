import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ScoreRing from "@/components/ui/score-ring";
import { Building2, Calendar, MoreVertical, ExternalLink, FileText, Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, isAfter, isBefore, addDays } from 'date-fns';

export default function ApplicationCard({ application, job, match, onStatusChange, onDelete }) {
  const isFollowupSoon = application.followup_date && 
    isAfter(new Date(application.followup_date), new Date()) &&
    isBefore(new Date(application.followup_date), addDays(new Date(), 3));

  return (
    <Card className="p-3 mb-2 bg-white hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {match && <ScoreRing score={match.score_total} size={32} strokeWidth={3} />}
          <div className="min-w-0">
            <Link 
              to={createPageUrl(`JobDetail?id=${job?.id}`)}
              className="text-sm font-medium text-slate-900 hover:text-indigo-600 line-clamp-1"
            >
              {job?.title || 'Unknown Job'}
            </Link>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <Building2 className="w-3 h-3" />
              <span className="truncate">{job?.company}</span>
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={createPageUrl(`JobDetail?id=${job?.id}`)}>
                <FileText className="w-3.5 h-3.5 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={job?.apply_url || job?.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Open Job
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onStatusChange(application.id, 'applied')}>
              Mark as Applied
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(application.id, 'interview')}>
              Mark as Interview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(application.id, 'rejected')} className="text-red-600">
              Mark as Rejected
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(application.id)} className="text-red-600">
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex items-center gap-2 mt-2">
        {application.applied_date && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(application.applied_date), 'MMM d')}</span>
          </div>
        )}
        
        {isFollowupSoon && (
          <Badge className="text-xs bg-amber-50 text-amber-700 border-amber-200">
            <Bell className="w-3 h-3 mr-1" />
            Follow-up
          </Badge>
        )}
      </div>
      
      {application.notes && (
        <p className="mt-2 text-xs text-slate-500 line-clamp-2">{application.notes}</p>
      )}
    </Card>
  );
}