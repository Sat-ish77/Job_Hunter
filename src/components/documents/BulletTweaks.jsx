import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wand2, Copy, Check, ArrowRight } from 'lucide-react';
import { generateBulletTweaks } from '@/services/ai-service';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

export default function BulletTweaks({ job, resume, existingDoc, onSave }) {
  const [tweaks, setTweaks] = useState(existingDoc?.bullet_tweaks || []);
  const [generating, setGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleGenerateTweaks = async () => {
    setGenerating(true);
    try {
      const result = await generateBulletTweaks({ job, resume });
      setTweaks(result.tweaks || []);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate suggestions');
    } finally {
      setGenerating(false);
    }
  };

  const copySuggested = async (index) => {
    await navigator.clipboard.writeText(tweaks[index].suggested);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSave = async () => {
    await onSave(tweaks);
    toast.success('Suggestions saved');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Resume Bullet Tweaks</CardTitle>
          {tweaks.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleSave}>
              Save
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-500">
          Suggested rephrases for your existing bullets - no new claims, just optimized wording
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {tweaks.length === 0 && !generating && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-medium text-slate-900 mb-1">Optimize Your Bullets</h3>
            <p className="text-sm text-slate-500 mb-4">
              Get suggestions to better highlight relevant experience for this role
            </p>
            <Button
              onClick={handleGenerateTweaks}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Suggestions
            </Button>
          </div>
        )}

        {generating && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Analyzing your bullets...</p>
          </div>
        )}

        {tweaks.map((tweak, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-3">
                <div>
                  <Badge variant="outline" className="text-xs mb-2">Original</Badge>
                  <p className="text-sm text-slate-600">{tweak.original}</p>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <Badge className="text-xs mb-2 bg-amber-100 text-amber-700">Suggested</Badge>
                  <p className="text-sm text-slate-900 font-medium">{tweak.suggested}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0"
                onClick={() => copySuggested(index)}
              >
                {copiedIndex === index ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            {tweak.reason && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded p-2">
                {tweak.reason}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
