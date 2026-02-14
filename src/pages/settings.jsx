import React, { useState } from 'react';
import { db } from '@/services/supabase-data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, 
  FileText, 
  Globe, 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  Save,
  Building2,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { sanitizeText } from '@/utils';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => db.resumes.list(),
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: () => db.jobSources.list(),
  });

  const { data: preferences = [] } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => db.userPreferences.list(),
  });

  const resume = resumes[0];
  const prefs = preferences[0];

  const [resumeText, setResumeText] = useState('');
  const [targetRoles, setTargetRoles] = useState([]);
  const [newSource, setNewSource] = useState({ name: '', type: 'greenhouse', url: '' });
  const [prefsState, setPrefsState] = useState(null);
  const [saving, setSaving] = useState(false);

  // Initialize state when data loads
  React.useEffect(() => {
    if (resume && !resumeText) {
      setResumeText(resume.raw_text || '');
      setTargetRoles(resume.target_roles || []);
    }
    if (prefs && !prefsState) {
      setPrefsState(prefs);
    }
  }, [resume, prefs]);

  const updateResumeMutation = useMutation({
    mutationFn: ({ id, data }) => db.resumes.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('Resume updated');
    },
  });

  const createSourceMutation = useMutation({
    mutationFn: (data) => db.jobSources.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast.success('Source added');
      setNewSource({ name: '', type: 'greenhouse', url: '' });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id) => db.jobSources.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast.success('Source removed');
    },
  });

  const updatePrefsMutation = useMutation({
    mutationFn: ({ id, data }) => db.userPreferences.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      toast.success('Preferences saved');
    },
  });

  const handleSaveResume = async () => {
    if (resume) {
      setSaving(true);
      await updateResumeMutation.mutateAsync({
        id: resume.id,
        data: { raw_text: sanitizeText(resumeText), target_roles: targetRoles }
      });
      setSaving(false);
    }
  };

  const handleAddSource = () => {
    if (newSource.name && newSource.url) {
      createSourceMutation.mutate({
        name: newSource.name,
        source_type: newSource.type,
        url: newSource.url,
        is_active: true,
      });
    }
  };

  const handleSavePrefs = async () => {
    if (prefs && prefsState) {
      setSaving(true);
      await updatePrefsMutation.mutateAsync({
        id: prefs.id,
        data: prefsState
      });
      setSaving(false);
    }
  };

  const detectType = (url) => {
    if (url.includes('lever.co')) return 'lever';
    if (url.includes('greenhouse.io')) return 'greenhouse';
    return 'career_page';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Manage your profile, sources, and preferences</p>
        </div>

        <Tabs defaultValue="resume" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="resume" className="gap-2">
              <FileText className="w-4 h-4" />
              Resume
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-2">
              <Globe className="w-4 h-4" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <SettingsIcon className="w-4 h-4" />
              Preferences
            </TabsTrigger>
          </TabsList>

          {/* Resume Tab */}
          <TabsContent value="resume">
            <Card>
              <CardHeader>
                <CardTitle>Your Resume</CardTitle>
                <CardDescription>
                  Update your resume text for better job matching
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Resume Text</Label>
                  <Textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste your resume content..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Target Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {targetRoles.map((role, i) => (
                      <Badge key={i} className="gap-1">
                        {role}
                        <button
                          onClick={() => setTargetRoles(targetRoles.filter((_, idx) => idx !== i))}
                          className="ml-1 hover:text-red-300"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a target role..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          setTargetRoles([...targetRoles, e.target.value.trim()]);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveResume}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Resume
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources">
            <div className="space-y-6">
              {/* Add New Source */}
              <Card>
                <CardHeader>
                  <CardTitle>Add New Source</CardTitle>
                  <CardDescription>
                    Add company career pages to track for internships
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          value={newSource.name}
                          onChange={(e) => setNewSource(p => ({ ...p, name: e.target.value }))}
                          placeholder="e.g., Google"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Source Type</Label>
                        <Select
                          value={newSource.type}
                          onValueChange={(value) => setNewSource(p => ({ ...p, type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="greenhouse">Greenhouse</SelectItem>
                            <SelectItem value="lever">Lever</SelectItem>
                            <SelectItem value="career_page">Career Page</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input
                        value={newSource.url}
                        onChange={(e) => {
                          const url = e.target.value;
                          setNewSource(p => ({ ...p, url, type: detectType(url) }));
                        }}
                        placeholder="https://boards.greenhouse.io/company"
                      />
                    </div>
                    <Button
                      onClick={handleAddSource}
                      disabled={!newSource.name || !newSource.url}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Source
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Existing Sources */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Sources ({sources.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {sources.length > 0 ? (
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {sources.map((source) => (
                          <motion.div
                            key={source.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Building2 className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="font-medium text-slate-900">{source.name}</p>
                                <p className="text-xs text-slate-500">{source.source_type} • {source.jobs_found || 0} jobs</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                              >
                                <a href={source.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => deleteSourceMutation.mutate(source.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-8">
                      No sources added yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>Job Preferences</CardTitle>
                <CardDescription>
                  Customize your job search filters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {prefsState && (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Minimum Match Score</Label>
                        <span className="text-sm font-semibold text-indigo-600">
                          {prefsState.min_score_threshold || 50}%
                        </span>
                      </div>
                      <Slider
                        value={[prefsState.min_score_threshold || 50]}
                        onValueChange={([value]) => setPrefsState(p => ({ ...p, min_score_threshold: value }))}
                        max={100}
                        step={5}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Work Type Preference</Label>
                      <div className="flex gap-4">
                        {['remote', 'hybrid', 'onsite'].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`pref-${type}`}
                              checked={(prefsState.remote_preference || []).includes(type)}
                              onCheckedChange={(checked) => {
                                const current = prefsState.remote_preference || [];
                                setPrefsState(p => ({
                                  ...p,
                                  remote_preference: checked
                                    ? [...current, type]
                                    : current.filter(t => t !== type)
                                }));
                              }}
                            />
                            <label htmlFor={`pref-${type}`} className="text-sm capitalize cursor-pointer">
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                      <Checkbox
                        id="sponsorship-pref"
                        checked={prefsState.require_sponsorship || false}
                        onCheckedChange={(checked) => setPrefsState(p => ({ ...p, require_sponsorship: checked }))}
                      />
                      <label htmlFor="sponsorship-pref" className="cursor-pointer">
                        <span className="text-sm font-medium text-slate-700">Require visa sponsorship</span>
                        <p className="text-xs text-slate-500">Deprioritize jobs that don't offer sponsorship</p>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <Label>Target Internship Period</Label>
                      <Input
                        value={prefsState.target_start_date || ''}
                        onChange={(e) => setPrefsState(p => ({ ...p, target_start_date: e.target.value }))}
                        placeholder="e.g., Summer 2026"
                      />
                    </div>

                    <Button
                      onClick={handleSavePrefs}
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Preferences
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}