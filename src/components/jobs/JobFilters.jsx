import React from 'react';
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Filter } from 'lucide-react';

export default function JobFilters({ filters, onFiltersChange, sources = [] }) {
  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleRemoteToggle = (type) => {
    const current = filters.remoteTypes || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    handleChange('remoteTypes', updated);
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      scoreRange: [0, 100],
      remoteTypes: [],
      source: 'all',
      location: '',
      sortBy: 'score'
    });
  };

  const hasFilters = filters.search || 
    (filters.scoreRange && (filters.scoreRange[0] > 0 || filters.scoreRange[1] < 100)) ||
    (filters.remoteTypes && filters.remoteTypes.length > 0) ||
    filters.source !== 'all' ||
    filters.location;

  return (
    <Card className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Filter className="w-4 h-4" />
          Filters
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-slate-500">
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-slate-600">Search</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Title, company, skills..."
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-slate-600">Match Score</Label>
        <Slider
          value={filters.scoreRange || [0, 100]}
          onValueChange={(value) => handleChange('scoreRange', value)}
          max={100}
          step={5}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{filters.scoreRange?.[0] || 0}%</span>
          <span>{filters.scoreRange?.[1] || 100}%</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-slate-600">Work Type</Label>
        <div className="space-y-2">
          {['remote', 'hybrid', 'onsite'].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={type}
                checked={(filters.remoteTypes || []).includes(type)}
                onCheckedChange={() => handleRemoteToggle(type)}
              />
              <label htmlFor={type} className="text-sm capitalize cursor-pointer">
                {type}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-slate-600">Location</Label>
        <Input
          placeholder="e.g., San Francisco"
          value={filters.location || ''}
          onChange={(e) => handleChange('location', e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      {sources.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-slate-600">Source</Label>
          <Select
            value={filters.source || 'all'}
            onValueChange={(value) => handleChange('source', value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-slate-600">Sort By</Label>
        <Select
          value={filters.sortBy || 'score'}
          onValueChange={(value) => handleChange('sortBy', value)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Best Match</SelectItem>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="company">Company A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}