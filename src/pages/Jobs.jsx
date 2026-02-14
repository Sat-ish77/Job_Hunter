/**
 * src/pages/Jobs.jsx
 * 
 * FIXED VERSION - Jobs Explorer with Integrated Search & Filters
 * 
 * FEATURES:
 * - Single unified search interface
 * - Multi-select location dropdown (cities + states)
 * - Integrated filters (work type, remote, salary)
 * - Live job search with resume matching
 * - AI categorization (top picks, good matches, slight matches)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { db } from '@/services/supabase-data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { 
  Search, 
  RefreshCw, 
  Loader2,
  CheckCircle2,
  Sparkles,
  MapPin,
  Briefcase,
  X
} from 'lucide-react';
import JobCard from '@/components/jobs/JobCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function Jobs() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  
  // UNIFIED SEARCH STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [workType, setWorkType] = useState('all');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('all'); // top_pick, good_match, slight_match, all
  
  // Location popover state
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  // Fetch data
  const { data: jobs = [], isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => db.jobs.list('-created_date', 500),
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => db.jobMatches.list('-score_total', 500),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.applications.list(),
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => db.resumes.list(),
  });

  // Static location list (US States + Remote)
  // No DB query needed — the `locations` table doesn't exist in the schema.
  const locations = useMemo(() => {
    const US_STATES = [
      'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
      'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
      'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
      'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
      'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
      'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
      'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
      'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
    ];
    return [
      { id: 'remote', name: 'Remote', type: 'special' },
      ...US_STATES.map(s => ({ id: s.toLowerCase().replace(/\s+/g, '-'), name: s, type: 'state' })),
    ];
  }, []);

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

  // Filter locations based on search
  const filteredLocations = useMemo(() => {
    if (!locationSearch) return locations;
    const search = locationSearch.toLowerCase();
    return locations.filter(loc => loc.name.toLowerCase().includes(search));
  }, [locations, locationSearch]);

  // Group locations by type
  const locationsByType = useMemo(() => {
    const grouped = {
      special: filteredLocations.filter(l => l.type === 'special'),
      states: filteredLocations.filter(l => l.type === 'state'),
    };
    return grouped;
  }, [filteredLocations]);

  /**
   * UNIFIED SEARCH HANDLER
   * Integrates all search parameters into one backend call
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a job title or role');
      return;
    }

    setSearching(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please log in to search for jobs');
        return;
      }
      
      // Get user's resume for matching
      const resume = resumes[0];
      const resumeText = resume ? [
        resume.experience_bullets?.join(' '),
        resume.skills?.join(' '),
        resume.projects?.map(p => p.description).join(' ')
      ].filter(Boolean).join(' ') : '';
      
      toast.info('🔍 Searching live job market...', {
        description: 'Finding jobs that match your profile',
        duration: 2000,
      });

      // Build location string from selected locations
      const locationString = selectedLocations.length > 0
        ? selectedLocations.map(locId => {
            const loc = locations.find(l => l.id === locId);
            return loc?.name || '';
          }).filter(Boolean).join(', ')
        : undefined;

      // Call fetch-jobs with all parameters
      const { data, error } = await supabase.functions.invoke('fetch-jobs', {
        body: {
          role: searchQuery.trim(),
          resume_text: resumeText || undefined,
          location: locationString,
          work_type: workType !== 'all' ? workType : undefined,
          daysAgo: 14,
        },
      });
      
      if (error) throw error;
      
      // Refresh data
      await refetchJobs();
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      
      const jobCount = data?.jobsFound || 0;
      if (jobCount > 0) {
        toast.success(`✅ Found ${jobCount} jobs!`, {
          description: 'Jobs are being analyzed and scored...',
          duration: 4000,
        });
      } else {
        toast.warning('No jobs found', {
          description: 'Try adjusting your search criteria',
        });
      }
      
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed', {
        description: error.message || 'Please try again later',
      });
    } finally {
      setSearching(false);
    }
  };

  // Helper: derive category from score_total
  const getCategory = (score) => {
    if (score >= 80) return 'top_pick';
    if (score >= 60) return 'good_match';
    return 'slight_match';
  };

  // CLIENT-SIDE FILTERING (for already fetched jobs)
  const filteredJobs = useMemo(() => {
    let result = jobs.map(job => {
      const match = matches.find(m => m.job_id === job.id);
      return {
        job,
        match,
        application: applications.find(a => a.job_id === job.id),
        score: match?.score_total || 0,
      };
    });

    // Apply match score filter
    if (minMatchScore > 0) {
      result = result.filter(({ score }) => score >= minMatchScore);
    }

    // Apply category filter (derived from score, NOT from a DB column)
    if (categoryFilter !== 'all') {
      result = result.filter(({ score }) => getCategory(score) === categoryFilter);
    }

    // Apply remote filter
    if (remoteOnly) {
      result = result.filter(({ job }) => job.remote_type === 'remote');
    }

    // Sort by match score (best first)
    result.sort((a, b) => b.score - a.score);

    return result;
  }, [jobs, matches, applications, minMatchScore, categoryFilter, remoteOnly]);

  // Categorize jobs by score thresholds (derived, not from DB)
  const jobsByCategory = useMemo(() => {
    return {
      top_pick: filteredJobs.filter(({ score }) => score >= 80),
      good_match: filteredJobs.filter(({ score }) => score >= 60 && score < 80),
      slight_match: filteredJobs.filter(({ score }) => score < 60),
    };
  }, [filteredJobs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchJobs();
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast.success('Jobs refreshed');
    } catch (error) {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const removeLocation = (id) => {
    setSelectedLocations(prev => prev.filter(locId => locId !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-blue-400" />
                Jobs Explorer
              </h1>
              <p className="text-slate-400 mt-1">
                {filteredJobs.length > 0 ? (
                  `${filteredJobs.length} jobs found`
                ) : (
                  'Search for jobs matching your resume'
                )}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-slate-900/50 border-white/10 text-slate-200 hover:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* UNIFIED SEARCH INTERFACE */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-xl space-y-4">
            {/* Main Search Row */}
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Job Title/Role */}
              <div className="flex-1">
                <label className="text-sm text-slate-400 mb-1.5 block">Job Title or Role</label>
                <Input
                  type="text"
                  placeholder="e.g., Software Engineer, Data Analyst, Product Manager"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-slate-950/50 border-white/10 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              {/* Location Multi-Select */}
              <div className="lg:w-80">
                <label className="text-sm text-slate-400 mb-1.5 block">Location (Multi-select)</label>
                <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-slate-950/50 border-white/10 text-slate-200 hover:bg-slate-800"
                    >
                      <span className="truncate">
                        {selectedLocations.length === 0 ? (
                          <span className="text-slate-500">Select locations...</span>
                        ) : (
                          `${selectedLocations.length} location${selectedLocations.length > 1 ? 's' : ''} selected`
                        )}
                      </span>
                      <MapPin className="w-4 h-4 ml-2 flex-shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 bg-slate-900 border-white/10" align="start">
                    <Command className="bg-slate-900">
                      <CommandInput 
                        placeholder="Search locations..." 
                        value={locationSearch}
                        onValueChange={setLocationSearch}
                        className="text-slate-100"
                      />
                      <CommandEmpty className="text-slate-400 text-sm py-6 text-center">
                        No locations found
                      </CommandEmpty>
                      
                      {/* Remote option */}
                      {locationsByType.special.length > 0 && (
                        <CommandGroup heading="Work Type" className="text-slate-400">
                          {locationsByType.special.map((location) => (
                            <CommandItem
                              key={location.id}
                              onSelect={() => {
                                setSelectedLocations(prev => 
                                  prev.includes(location.id)
                                    ? prev.filter(locId => locId !== location.id)
                                    : [...prev, location.id]
                                );
                              }}
                              className="text-slate-200"
                            >
                              <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${selectedLocations.includes(location.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-400'}`}>
                                {selectedLocations.includes(location.id) && (
                                  <CheckCircle2 className="h-3 w-3 text-white" />
                                )}
                              </div>
                              {location.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      
                      {/* States */}
                      {locationsByType.states.length > 0 && (
                        <CommandGroup heading="States" className="text-slate-400">
                          {locationsByType.states.map((location) => (
                            <CommandItem
                              key={location.id}
                              onSelect={() => {
                                setSelectedLocations(prev => 
                                  prev.includes(location.id)
                                    ? prev.filter(locId => locId !== location.id)
                                    : [...prev, location.id]
                                );
                              }}
                              className="text-slate-200"
                            >
                              <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${selectedLocations.includes(location.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-400'}`}>
                                {selectedLocations.includes(location.id) && (
                                  <CheckCircle2 className="h-3 w-3 text-white" />
                                )}
                              </div>
                              {location.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Work Type */}
              <div className="lg:w-48">
                <label className="text-sm text-slate-400 mb-1.5 block">Work Type</label>
                <Select value={workType} onValueChange={setWorkType}>
                  <SelectTrigger className="bg-slate-950/50 border-white/10 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="all" className="text-slate-200">All Types</SelectItem>
                    <SelectItem value="remote" className="text-slate-200">Remote</SelectItem>
                    <SelectItem value="hybrid" className="text-slate-200">Hybrid</SelectItem>
                    <SelectItem value="onsite" className="text-slate-200">Onsite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Button */}
              <div className="flex items-end">
                <Button 
                  onClick={handleSearch} 
                  disabled={searching || !searchQuery.trim()}
                  className="bg-blue-500 hover:bg-blue-600 text-white w-full lg:w-auto px-8"
                  size="lg"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search Jobs
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Selected Locations Tags */}
            {selectedLocations.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                <span className="text-sm text-slate-400">Selected:</span>
                {selectedLocations.map(locId => {
                  const location = locations.find(l => l.id === locId);
                  return location ? (
                    <Badge
                      key={locId}
                      className="bg-blue-500/20 text-blue-300 border-blue-500/30 pl-2 pr-1"
                    >
                      {location.name}
                      <button
                        onClick={() => removeLocation(locId)}
                        className="ml-1 hover:bg-blue-500/30 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}

            {/* Quick Filters Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
              <span className="text-sm text-slate-400">Quick Filters:</span>
              
              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px] bg-slate-950/50 border-white/10 text-slate-200 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  <SelectItem value="all" className="text-slate-200">All Matches</SelectItem>
                  <SelectItem value="top_pick" className="text-green-400">🎯 Top Picks</SelectItem>
                  <SelectItem value="good_match" className="text-blue-400">✨ Good Matches</SelectItem>
                  <SelectItem value="slight_match" className="text-yellow-400">💡 Slight Matches</SelectItem>
                </SelectContent>
              </Select>

              {/* Min Score Filter */}
              <Select value={minMatchScore.toString()} onValueChange={(v) => setMinMatchScore(parseInt(v))}>
                <SelectTrigger className="w-[140px] bg-slate-950/50 border-white/10 text-slate-200 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  <SelectItem value="0" className="text-slate-200">All Scores</SelectItem>
                  <SelectItem value="70" className="text-slate-200">70%+ Match</SelectItem>
                  <SelectItem value="60" className="text-slate-200">60%+ Match</SelectItem>
                  <SelectItem value="50" className="text-slate-200">50%+ Match</SelectItem>
                </SelectContent>
              </Select>

              {/* Remote Only Toggle */}
              <Button
                variant={remoteOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setRemoteOnly(!remoteOnly)}
                className={remoteOnly ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-950/50 border-white/10 text-slate-200"}
              >
                <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                Remote Only
              </Button>
            </div>
          </div>
        </div>

        {/* Jobs Display with Categories */}
        <div className="space-y-8">
          {searching ? (
            /* Skeleton Loader */
            <div className="space-y-4">
              <div className="text-center py-8 bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-xl">
                <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-100">Scanning live job market...</h3>
                <p className="text-slate-400 mt-1">Finding jobs that match your resume</p>
              </div>
              {[1,2,3].map(i => (
                <Skeleton key={i} className="h-48 rounded-xl bg-slate-800/50" />
              ))}
            </div>
          ) : jobsLoading ? (
            <div className="space-y-4">
              {[1,2,3,4,5].map(i => (
                <Skeleton key={i} className="h-48 rounded-xl bg-slate-800/50" />
              ))}
            </div>
          ) : filteredJobs.length > 0 ? (
            <>
              {/* Top Picks Section */}
              {jobsByCategory.top_pick.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-8 bg-green-400 rounded-full"></div>
                    <h2 className="text-xl font-bold text-slate-100">🎯 Top Picks for You</h2>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {jobsByCategory.top_pick.length} jobs
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    {jobsByCategory.top_pick.map(({ job, match, application }) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        match={match}
                        application={application}
                        onSave={(jobId) => createApplicationMutation.mutate(jobId)}
                        onUnsave={(appId) => deleteApplicationMutation.mutate(appId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Good Matches Section */}
              {jobsByCategory.good_match.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-8 bg-blue-400 rounded-full"></div>
                    <h2 className="text-xl font-bold text-slate-100">✨ Good Matches</h2>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      {jobsByCategory.good_match.length} jobs
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    {jobsByCategory.good_match.map(({ job, match, application }) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        match={match}
                        application={application}
                        onSave={(jobId) => createApplicationMutation.mutate(jobId)}
                        onUnsave={(appId) => deleteApplicationMutation.mutate(appId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Slight Matches Section */}
              {jobsByCategory.slight_match.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-8 bg-yellow-400 rounded-full"></div>
                    <h2 className="text-xl font-bold text-slate-100">💡 Worth Exploring</h2>
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      {jobsByCategory.slight_match.length} jobs
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    {jobsByCategory.slight_match.map(({ job, match, application }) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        match={match}
                        application={application}
                        onSave={(jobId) => createApplicationMutation.mutate(jobId)}
                        onUnsave={(appId) => deleteApplicationMutation.mutate(appId)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-xl">
              <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-100">No jobs found</h3>
              <p className="text-slate-400 mt-1 max-w-sm mx-auto">
                {jobs.length === 0 
                  ? "Use the search bar above to find jobs from across the web"
                  : "Try adjusting your filters or search for a different role"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
