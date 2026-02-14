import React, { useState, useEffect } from 'react';
import { db } from '@/services/supabase-data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/api/base44Client';

import ResumeUpload from '@/components/onboarding/ResumeUpload';
import RoleSelector from '@/components/onboarding/RoleSelector';
import SourcesManager from '@/components/onboarding/SourcesManager';
import PreferencesForm from '@/components/onboarding/PreferencesForm';

const STEPS = [
  { id: 'resume', title: 'Resume', description: 'Upload your resume' },
  { id: 'roles', title: 'Target Roles', description: 'What are you looking for?' },
  { id: 'sources', title: 'Job Sources', description: 'Where to find jobs' },
  { id: 'preferences', title: 'Preferences', description: 'Set your filters' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState({
    resume: null,
    roles: [],
    sources: [],
    preferences: null,
  });

  const createResumeMutation = useMutation({
    mutationFn: (resumeData) => db.resumes.create(resumeData),
  });

  const createSourcesMutation = useMutation({
    mutationFn: (sources) => db.jobSources.bulkCreate(sources),
  });

  const createPreferencesMutation = useMutation({
    mutationFn: (prefs) => db.userPreferences.create(prefs),
  });

  // Complete onboarding - force DB update and redirect
  // Accepts optional overridePreferences to avoid stale state race condition
  // (setState is async, so data.preferences may not be updated yet when called from handlePreferencesComplete)
  const completeOnboarding = async (overridePreferences = null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user found');
        return;
      }

      // FORCE UPDATE: Update profiles table with correct field name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }

      // Save resume if exists
      if (data.resume) {
        try {
          await createResumeMutation.mutateAsync({
            ...data.resume,
            target_roles: data.roles,
          });
        } catch (err) {
          console.warn('Resume save error (non-critical):', err);
        }
      }

      // Save sources if exists
      if (data.sources.length > 0) {
        try {
          const sourcesToCreate = data.sources.map(s => ({
            name: s.name,
            source_type: s.type,
            url: s.url,
            is_active: true,
          }));
          await createSourcesMutation.mutateAsync(sourcesToCreate);
        } catch (err) {
          console.warn('Sources save error (non-critical):', err);
        }
      }

      // Save preferences (onboarding_completed lives in profiles, not user_preferences)
      // Use overridePreferences if provided (to avoid stale closure issue)
      const prefs = overridePreferences || data.preferences;
      try {
        await createPreferencesMutation.mutateAsync({
          min_score_threshold: prefs?.min_score_threshold || 60,
          remote_preference: prefs?.remote_preference || 'none',
          require_sponsorship: prefs?.require_sponsorship || false,
          exclude_keywords: prefs?.exclude_keywords || [],
        });
      } catch (err) {
        console.warn('Preferences save error (non-critical):', err);
      }

      // Invalidate all queries
      queryClient.invalidateQueries();

      // FORCE REDIRECT: Try navigate first, fallback to window.location
      try {
        navigate('/dashboard', { replace: true });
        // Fallback: If navigate doesn't work, force redirect
        setTimeout(() => {
          if (window.location.pathname !== '/dashboard') {
            window.location.href = '/dashboard';
          }
        }, 500);
      } catch (navError) {
        console.error('Navigation error, forcing redirect:', navError);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Even on error, try to redirect
      window.location.href = '/dashboard';
    }
  };

  // Handle skip - same logic as complete
  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleResumeComplete = (resumeData) => {
    setData(prev => ({ ...prev, resume: resumeData }));
    setCurrentStep(1);
  };

  const handleRolesComplete = (roles) => {
    setData(prev => ({ ...prev, roles }));
    setCurrentStep(2);
  };

  const handleSourcesComplete = (sources) => {
    setData(prev => ({ ...prev, sources }));
    setCurrentStep(3);
  };

  const handlePreferencesComplete = async (preferences) => {
    setData(prev => ({ ...prev, preferences }));
    // Pass preferences directly to avoid React state race condition
    await completeOnboarding(preferences);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header with Skip button */}
        <div className="text-center mb-8 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="absolute top-0 right-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Skip for now
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Welcome to Job Hunter
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Let's get you set up in a few steps</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index < currentStep
                      ? 'bg-indigo-600 text-white'
                      : index === currentStep
                      ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-600 dark:bg-indigo-900 dark:text-indigo-300'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-700'
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      index < currentStep ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{STEPS[currentStep].title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{STEPS[currentStep].description}</p>
          </div>
        </div>

        {/* Back button */}
        {currentStep > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep(currentStep - 1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <ResumeUpload
              key="resume"
              onComplete={handleResumeComplete}
              initialData={data.resume}
            />
          )}
          {currentStep === 1 && (
            <RoleSelector
              key="roles"
              onComplete={handleRolesComplete}
              initialData={data.roles}
            />
          )}
          {currentStep === 2 && (
            <SourcesManager
              key="sources"
              onComplete={handleSourcesComplete}
              initialData={data.sources}
            />
          )}
          {currentStep === 3 && (
            <PreferencesForm
              key="preferences"
              onComplete={handlePreferencesComplete}
              initialData={data.preferences}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
