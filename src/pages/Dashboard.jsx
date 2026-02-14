import React, { useState } from 'react';
import { db } from '@/services/supabase-data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  TrendingUp,
  Target,
  RefreshCw,
  ArrowRight,
  Plus,
  Sparkles,
  Search
} from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import JobCard from '@/components/jobs/JobCard';
import ResumeManager from '@/components/dashboard/ResumeManager';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data
  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => db.userPreferences.list(),
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => db.jobs.list('-created_date', 100),
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => db.jobMatches.list('-score_total', 100),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.applications.list(),
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: () => db.jobSources.list(),
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => db.resumes.list(),
  });

  // Calculate simple keyword match score
  const calculateMatchScore = (job, resume) => {
    if (!resume || !job) return 0;
    const jobSkills = (job.required_skills || job.skills || []).map(s => s.toLowerCase());
    const resumeSkills = (resume.skills || []).map(s => s.toLowerCase());
    const matches = jobSkills.filter(s => resumeSkills.includes(s));
    return Math.round((matches.length / Math.max(jobSkills.length, 1)) * 100);
  };

  // Handle fetching jobs from Tavily via Edge Function
  const handleFetchJobs = async () => {
    setRefreshing(true);
    try {
      const { supabase } = await import('@/api/base44Client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        const { toast } = await import('sonner');
        toast.error('Not authenticated', { description: 'Please log in to fetch jobs' });
        return;
      }
      
      // Get user's roles and preferences for job search
      const resume = resumes[0] || await db.resumes.list().then(r => r[0]);
      const roles = resume?.target_roles || ['Software Engineer'];
      const role = roles[0] || 'Software Engineer';
      
      // Call fetch-jobs Edge Function
      const { data, error } = await supabase.functions.invoke('fetch-jobs', {
        body: {
          role,
          states: [],
          cities: [],
          workTypes: ['Remote', 'Hybrid', 'Onsite'],
          daysAgo: 7,
        },
      });
      
      if (error) throw error;
      
      // Invalidate queries to refresh job list
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      
      const { toast } = await import('sonner');
      toast.success('Jobs refreshed', {
        description: `Found ${data?.jobsFound || 0} new jobs`,
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to fetch jobs', {
        description: error.message || 'Please try again later',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Mutations
  const createApplicationMutation = useMutation({
    mutationFn: (jobId) => db.applications.create({
      job_id: jobId,
      status: 'saved',
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: (id) => db.applications.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  // NOTE: Onboarding redirection is handled by ProtectedRoute in App.jsx
  // which checks profiles.onboarding_completed from the DB.
  // No redundant check needed here — user_preferences does NOT have onboarding_completed.

  // Calculate stats
  const minScore = preferences?.[0]?.min_score_threshold || 50;
  const topMatches = matches.filter(m => m.score_total >= minScore);
  const appliedCount = applications.filter(a =>
    a.status === 'applied' || a.status === 'interview' || a.status === 'offer'
  ).length;
  const interviewCount = applications.filter(a => a.status === 'interview').length;

  const userResume = resumes[0];

  // Get top matched jobs with calculated scores
  const topJobsWithMatches = topMatches
    .slice(0, 5)
    .map(match => ({
      match,
      job: jobs.find(j => j.id === match.job_id),
      application: applications.find(a => a.job_id === match.job_id),
    }))
    .filter(item => item.job);

  // Get all jobs with calculated match scores (for grid display)
  const jobsWithScores = jobs.slice(0, 12).map(job => {
    const match = matches.find(m => m.job_id === job.id);
    const score = match?.score_total || calculateMatchScore(job, userResume);
    return {
      job,
      match: match ? { ...match, score_total: score } : { score_total: score },
      application: applications.find(a => a.job_id === job.id),
    };
  }).sort((a, b) => b.match.score_total - a.match.score_total);

  if (prefsLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Your job hunting command center</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleFetchJobs}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Jobs
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/jobs">
                <Search className="w-4 h-4 mr-2" />
                Explore Jobs
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Jobs Found"
            value={jobs.length}
            icon={Sparkles}
            subtitle="total in database"
          />
          <StatsCard
            title="Top Matches"
            value={topMatches.length}
            icon={Target}
            subtitle={`score ≥ ${minScore}`}
          />
          <StatsCard
            title="Applied"
            value={appliedCount}
            icon={Briefcase}
            subtitle="this month"
          />
          <StatsCard
            title="Interviews"
            value={interviewCount}
            icon={TrendingUp}
            subtitle="scheduled"
          />
        </div>

        {/* Resume Manager */}
        <div className="mb-8">
          <ResumeManager 
            resume={userResume} 
            onResumeUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['resumes'] });
              queryClient.invalidateQueries({ queryKey: ['jobs'] });
              queryClient.invalidateQueries({ queryKey: ['matches'] });
            }}
          />
        </div>

        {/* Jobs Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Recommended Jobs</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/jobs">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
          
          {jobsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : jobsWithScores.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobsWithScores.map(({ job, match, application }) => (
                <JobCard
                  key={job.id}
                  job={job}
                  match={match}
                  application={application}
                  compact={true}
                  onSave={(jobId) => createApplicationMutation.mutate(jobId)}
                  onUnsave={(appId) => deleteApplicationMutation.mutate(appId)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-foreground font-medium">No jobs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Refresh Jobs" to fetch new job listings
                </p>
                <Button onClick={handleFetchJobs} className="mt-4 bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Fetch Jobs
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Top Matches */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Top Matches</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/jobs">
                    View all <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {jobsLoading ? (
                  [1,2,3].map(i => <Skeleton key={i} className="h-32" />)
                ) : topJobsWithMatches.length > 0 ? (
                  topJobsWithMatches.map(({ job, match, application }) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      match={match}
                      application={application}
                      onSave={(jobId) => createApplicationMutation.mutate(jobId)}
                      onUnsave={(appId) => deleteApplicationMutation.mutate(appId)}
                      compact
                    />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Search className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium">No matches yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Complete onboarding to get personalized matches
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Activity */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/jobs">
                    <Search className="w-4 h-4 mr-3" />
                    Browse Jobs
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/pipeline">
                    <Briefcase className="w-4 h-4 mr-3" />
                    View Pipeline
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/settings">
                    <Plus className="w-4 h-4 mr-3" />
                    Add Job Source
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Sources Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Job Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {sources.length > 0 ? (
                  <div className="space-y-2">
                    {sources.slice(0, 5).map(source => (
                      <div key={source.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate">{source.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {source.jobs_found || 0} jobs
                        </span>
                      </div>
                    ))}
                    {sources.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{sources.length - 5} more sources
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sources configured
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {applications.length > 0 ? (
                  <div className="space-y-3">
                    {applications.slice(0, 5).map(app => {
                      const job = jobs.find(j => j.id === app.job_id);
                      return (
                        <div key={app.id} className="flex items-center gap-3 text-sm">
                          <div className={`w-2 h-2 rounded-full ${
                            app.status === 'applied' ? 'bg-blue-500' :
                            app.status === 'interview' ? 'bg-emerald-500' :
                            app.status === 'rejected' ? 'bg-red-500' :
                            'bg-muted'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground truncate">{job?.title || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground capitalize">{app.status}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No activity yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
