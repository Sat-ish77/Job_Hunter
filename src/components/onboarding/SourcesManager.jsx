import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Plus, Trash2, Building2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const POPULAR_SOURCES = [
  { name: 'Google', type: 'lever', url: 'https://jobs.lever.co/google' },
  { name: 'Meta', type: 'greenhouse', url: 'https://www.metacareers.com/jobs' },
  { name: 'Stripe', type: 'greenhouse', url: 'https://stripe.com/jobs/listing' },
  { name: 'OpenAI', type: 'greenhouse', url: 'https://boards.greenhouse.io/openai' },
  { name: 'Anthropic', type: 'greenhouse', url: 'https://boards.greenhouse.io/anthropic' },
  { name: 'Figma', type: 'lever', url: 'https://jobs.lever.co/figma' },
  { name: 'Notion', type: 'lever', url: 'https://jobs.lever.co/notion' },
  { name: 'Databricks', type: 'greenhouse', url: 'https://boards.greenhouse.io/databricks' },
];

export default function SourcesManager({ onComplete, initialData }) {
  const [sources, setSources] = useState(initialData || []);
  const [newSource, setNewSource] = useState({ name: '', type: 'greenhouse', url: '' });

  const addSource = () => {
    if (newSource.name && newSource.url) {
      setSources(prev => [...prev, { ...newSource, id: Date.now() }]);
      setNewSource({ name: '', type: 'greenhouse', url: '' });
    }
  };

  const addPopularSource = (source) => {
    if (!sources.find(s => s.url === source.url)) {
      setSources(prev => [...prev, { ...source, id: Date.now() }]);
    }
  };

  const removeSource = (id) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const detectType = (url) => {
    if (url.includes('lever.co')) return 'lever';
    if (url.includes('greenhouse.io')) return 'greenhouse';
    return 'career_page';
  };

  const handleUrlChange = (url) => {
    setNewSource(prev => ({
      ...prev,
      url,
      type: detectType(url)
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
            <Globe className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Job Sources</h2>
          <p className="text-sm text-slate-500 mt-1">
            Add company career pages to track for internships
          </p>
        </div>

        <div className="space-y-6">
          {/* Popular sources */}
          <div>
            <Label className="text-sm text-slate-600 mb-2 block">Quick Add Popular Companies</Label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SOURCES.map((source) => {
                const isAdded = sources.find(s => s.url === source.url);
                return (
                  <Button
                    key={source.name}
                    variant={isAdded ? "secondary" : "outline"}
                    size="sm"
                    disabled={isAdded}
                    onClick={() => addPopularSource(source)}
                    className="text-xs"
                  >
                    <Building2 className="w-3 h-3 mr-1.5" />
                    {source.name}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Add custom source */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
            <Label className="text-sm font-medium text-slate-700">Add Custom Source</Label>
            <div className="grid gap-3">
              <Input
                value={newSource.name}
                onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Company name"
                className="bg-white"
              />
              <Input
                value={newSource.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="Career page URL"
                className="bg-white"
              />
              <div className="flex gap-2">
                <Select
                  value={newSource.type}
                  onValueChange={(value) => setNewSource(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="bg-white flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greenhouse">Greenhouse</SelectItem>
                    <SelectItem value="lever">Lever</SelectItem>
                    <SelectItem value="career_page">Career Page</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={addSource}
                  disabled={!newSource.name || !newSource.url}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Added sources list */}
          {sources.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Your Sources ({sources.length})</Label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                <AnimatePresence mode="popLayout">
                  {sources.map((source) => (
                    <motion.div
                      key={source.id || source.url}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{source.name}</p>
                          <p className="text-xs text-slate-500 truncate">{source.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                        >
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeSource(source.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => onComplete([])}
            className="flex-1"
          >
            Skip (No sources)
          </Button>
          <Button
            onClick={() => onComplete(sources)}
            disabled={sources.length === 0}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
          >
            Continue ({sources.length} sources)
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}