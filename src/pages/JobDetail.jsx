import React, { useState, useEffect } from 'react';
import { db } from '@/services/supabase-data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Loader2
} from 'lucide-react';
import ScoreRing from "@/components/ui/score-ring";
import MatchInsights from '@/components/jobs/MatchInsights';
import ApplySection from '@/components/jobs/ApplySection';
import CoverLetterGenerator from '@/components/documents/CoverLetterGenerator';
import AnswersGenerator from '@/components/documents/AnswersGenerator';
import BulletTweaks from '@/components/documents/BulletTweaks';
import { toast } from 'sonner';

export default function JobDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: jobId } = useParams();

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const jobs = await db.jobs.filter({ id: jobId });
      return jobs[0];
    },
    enabled: !!jobId,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => db.jobMatches.list(),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.applications.list(),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', jobId],
    queryFn: () => db.generatedDocuments.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => db.resumes.list(),
  });

  const match = matches.find(m => m.job_id === jobId);
  const application = applications.find(a => a.job_id === jobId);
  const resume = resumes[0];
  const isSaved = !!application;

  const createApplicationMutation = useMutation({
    mutationFn: (data) => db.applications.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const updateApplicationMutation = useMutation({
    mutationFn: ({ id, data }) => db.applications.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: (id) => db.applications.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const createDocumentMutation = useMutation({
    mutationFn: (data) => db.generatedDocuments.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', jobId] }),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }) => db.generatedDocuments.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', jobId] }),
  });

  const handleSave = () => {
    createApplicationMutation.mutate({
      job_id: jobId,
      status: 'saved',
    });
  };

  const handleUnsave = () => {
    if (application) {
      deleteApplicationMutation.mutate(application.id);
    }
  };

  const handleMarkApplied = () => {
    if (application) {
      updateApplicationMutation.mutate({
        id: application.id,
        data: { status: 'applied', applied_date: new Date().toISOString().split('T')[0] }
      });
      toast.success('Marked as applied!');
    } else {
      createApplicationMutation.mutate({
        job_id: jobId,
        status: 'applied',
        applied_date: new Date().toISOString().split('T')[0],
      });
      toast.success('Marked as applied!');
    }
  };

  const handleSaveCoverLetter = async (content) => {
    const existingDoc = documents.find(d => d.doc_type === 'cover_letter');
    if (existingDoc) {
      await updateDocumentMutation.mutateAsync({ id: existingDoc.id, data: { content } });
    } else {
      await createDocumentMutation.mutateAsync({
        job_id: jobId,
        doc_type: 'cover_letter',
        content,
      });
    }
  };

  const handleSaveAnswers = async (answers) => {
    const existingDoc = documents.find(d => d.doc_type === 'answers');
    if (existingDoc) {
      await updateDocumentMutation.mutateAsync({ id: existingDoc.id, data: { answers } });
    } else {
      await createDocumentMutation.mutateAsync({
        job_id: jobId,
        doc_type: 'answers',
        answers,
      });
    }
  };

  const handleSaveBulletTweaks = async (bullet_tweaks) => {
    const existingDoc = documents.find(d => d.doc_type === 'resume_variant');
    if (existingDoc) {
      await updateDocumentMutation.mutateAsync({ id: existingDoc.id, data: { bullet_tweaks } });
    } else {
      await createDocumentMutation.mutateAsync({
        job_id: jobId,
        doc_type: 'resume_variant',
        bullet_tweaks,
      });
    }
  };

  if (jobLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Job not found</h2>
          <Button asChild className="mt-4">
            <Link to={'/jobs'}>Back to Jobs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-4">
                  {match && (
                    <ScoreRing score={match.score_total} size={64} strokeWidth={5} className="flex-shrink-0" />
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{job.title}</h1>
                    <div className="flex items-center gap-2 mt-2 text-slate-600">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{job.company}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      {job.location && (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <MapPin className="w-4 h-4" />
                          <span>{job.location}</span>
                        </div>
                      )}
                      {job.remote_type && job.remote_type !== 'unknown' && (
                        <Badge variant="outline" className="capitalize">
                          {job.remote_type}
                        </Badge>
                      )}
                      {job.internship_dates && (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Calendar className="w-4 h-4" />
                          <span>{job.internship_dates}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={isSaved ? handleUnsave : handleSave}
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck className="w-4 h-4 mr-2 text-indigo-600" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                  <a href={job.apply_url || job.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Apply
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="insights">Match Insights</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="apply">Apply</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate max-w-none">
                  <p className="whitespace-pre-wrap text-slate-600 leading-relaxed">
                    {job.description_clean || job.description_raw || 'No description available'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requirements">
            <div className="space-y-6">
              {job.required_skills?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Required Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {job.required_skills.map((skill, i) => (
                        <Badge key={i} className="bg-red-50 text-red-700 border-red-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {job.preferred_skills?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Preferred Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {job.preferred_skills.map((skill, i) => (
                        <Badge key={i} variant="outline" className="text-slate-600">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Additional Requirements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {job.education_requirement && (
                    <div>
                      <p className="text-sm font-medium text-slate-700">Education</p>
                      <p className="text-sm text-slate-600">{job.education_requirement}</p>
                    </div>
                  )}
                  {job.years_experience && (
                    <div>
                      <p className="text-sm font-medium text-slate-700">Experience</p>
                      <p className="text-sm text-slate-600">{job.years_experience}</p>
                    </div>
                  )}
                  {job.visa_sponsorship && (
                    <div>
                      <p className="text-sm font-medium text-slate-700">Visa Sponsorship</p>
                      <Badge className={
                        job.visa_sponsorship === 'yes'
                          ? 'bg-green-100 text-green-700'
                          : job.visa_sponsorship === 'no'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                      }>
                        {job.visa_sponsorship === 'yes' ? 'Available' :
                         job.visa_sponsorship === 'no' ? 'Not Available' : 'Unknown'}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights">
            <MatchInsights match={match} job={job} />
          </TabsContent>

          <TabsContent value="documents">
            {resume ? (
              <div className="space-y-6">
                <CoverLetterGenerator
                  job={job}
                  resume={resume}
                  existingDoc={documents.find(d => d.doc_type === 'cover_letter')}
                  onSave={handleSaveCoverLetter}
                />
                <AnswersGenerator
                  job={job}
                  resume={resume}
                  existingDoc={documents.find(d => d.doc_type === 'answers')}
                  onSave={handleSaveAnswers}
                />
                <BulletTweaks
                  job={job}
                  resume={resume}
                  existingDoc={documents.find(d => d.doc_type === 'resume_variant')}
                  onSave={handleSaveBulletTweaks}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-slate-600">Please complete onboarding to generate documents</p>
                  <Button asChild className="mt-4">
                    <Link to={'/onboarding'}>Complete Setup</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="apply">
            <ApplySection
              job={job}
              documents={documents}
              application={application}
              onMarkApplied={handleMarkApplied}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
