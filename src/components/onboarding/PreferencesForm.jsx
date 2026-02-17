import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Settings, X, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

const COMMON_EXCLUDE_KEYWORDS = [
  'security clearance',
  'US citizen only',
  'clearance required',
  'TS/SCI',
  'secret clearance',
];

export default function PreferencesForm({ onComplete, initialData }) {
  const [preferences, setPreferences] = useState(initialData || {
    location_filters: [],
    remote_preference: ['remote', 'hybrid'],
    min_score_threshold: 50,
    exclude_keywords: [],
    require_sponsorship: false,
    target_start_date: 'Summer 2026'
  });
  const [newLocation, setNewLocation] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const addLocation = () => {
    if (newLocation.trim() && !preferences.location_filters.includes(newLocation.trim())) {
      setPreferences(prev => ({
        ...prev,
        location_filters: [...prev.location_filters, newLocation.trim()]
      }));
      setNewLocation('');
    }
  };

  const removeLocation = (location) => {
    setPreferences(prev => ({
      ...prev,
      location_filters: prev.location_filters.filter(l => l !== location)
    }));
  };

  const toggleRemoteType = (type) => {
    setPreferences(prev => ({
      ...prev,
      remote_preference: prev.remote_preference.includes(type)
        ? prev.remote_preference.filter(t => t !== type)
        : [...prev.remote_preference, type]
    }));
  };

  const addExcludeKeyword = (keyword) => {
    if (keyword && !preferences.exclude_keywords.includes(keyword)) {
      setPreferences(prev => ({
        ...prev,
        exclude_keywords: [...prev.exclude_keywords, keyword]
      }));
    }
    setNewKeyword('');
  };

  const removeExcludeKeyword = (keyword) => {
    setPreferences(prev => ({
      ...prev,
      exclude_keywords: prev.exclude_keywords.filter(k => k !== keyword)
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Settings className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Preferences</h2>
          <p className="text-sm text-slate-500 mt-1">
            Set your filters and requirements
          </p>
        </div>

        <div className="space-y-6">
          {/* Locations */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Preferred Locations</Label>
            <div className="flex gap-2">
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                placeholder="e.g., San Francisco, New York"
                className="flex-1"
              />
              <Button variant="outline" onClick={addLocation} disabled={!newLocation.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {preferences.location_filters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {preferences.location_filters.map((location) => (
                  <Badge key={location} variant="secondary" className="gap-1">
                    {location}
                    <button onClick={() => removeLocation(location)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Remote preference */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Work Type</Label>
            <div className="flex gap-4">
              {['remote', 'hybrid', 'onsite'].map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`remote-${type}`}
                    checked={preferences.remote_preference.includes(type)}
                    onCheckedChange={() => toggleRemoteType(type)}
                  />
                  <label htmlFor={`remote-${type}`} className="text-sm capitalize cursor-pointer">
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Min score threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700">Minimum Match Score</Label>
              <span className="text-sm font-semibold text-indigo-600">{preferences.min_score_threshold}%</span>
            </div>
            <Slider
              value={[preferences.min_score_threshold]}
              onValueChange={([value]) => setPreferences(prev => ({ ...prev, min_score_threshold: value }))}
              max={100}
              step={5}
            />
            <p className="text-xs text-slate-500">Only show jobs with a match score above this threshold</p>
          </div>

          {/* Sponsorship */}
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
            <Checkbox
              id="sponsorship"
              checked={preferences.require_sponsorship}
              onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, require_sponsorship: checked }))}
            />
            <label htmlFor="sponsorship" className="text-sm cursor-pointer">
              <span className="font-medium text-slate-700">Require visa sponsorship</span>
              <p className="text-xs text-slate-500 mt-0.5">Deprioritize jobs that don't offer sponsorship</p>
            </label>
          </div>

          {/* Exclude keywords */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Exclude Keywords</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_EXCLUDE_KEYWORDS.map((keyword) => {
                const isSelected = preferences.exclude_keywords.includes(keyword);
                return (
                  <Badge
                    key={keyword}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer text-xs ${isSelected ? 'bg-red-100 text-red-700 hover:bg-red-200' : ''}`}
                    onClick={() => isSelected ? removeExcludeKeyword(keyword) : addExcludeKeyword(keyword)}
                  >
                    {keyword}
                  </Badge>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludeKeyword(newKeyword))}
                placeholder="Add custom keyword to exclude"
                className="flex-1"
              />
              <Button variant="outline" onClick={() => addExcludeKeyword(newKeyword)} disabled={!newKeyword.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Target start date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Target Start Date</Label>
            <Input
              value={preferences.target_start_date}
              onChange={(e) => setPreferences(prev => ({ ...prev, target_start_date: e.target.value }))}
              placeholder="e.g., Summer 2026"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => onComplete({
              ...preferences,
              onboarding_completed: true,
            })}
            className="flex-1"
          >
            Finish Setup
          </Button>
          <Button
            onClick={() => onComplete(preferences)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
          >
            Complete Setup
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}