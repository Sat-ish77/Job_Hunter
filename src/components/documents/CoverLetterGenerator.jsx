import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, Copy, Check, Download, RefreshCw } from 'lucide-react';
import { generateCoverLetter } from '@/services/ai-service';
import { toast } from 'sonner';

export default function CoverLetterGenerator({ job, resume, existingDoc, onSave }) {
  const [content, setContent] = useState(existingDoc?.content || '');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateCoverLetter({ job, resume });
      setContent(result);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate cover letter');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    await onSave(content);
    toast.success('Cover letter saved');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Cover Letter</CardTitle>
          <div className="flex gap-2">
            {content && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!content && !generating && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-medium text-slate-900 mb-1">Generate a Tailored Cover Letter</h3>
            <p className="text-sm text-slate-500 mb-4">
              AI will create a personalized cover letter based on your resume and this job
            </p>
            <Button
              onClick={handleGenerate}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Cover Letter
            </Button>
          </div>
        )}

        {generating && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Crafting your cover letter...</p>
          </div>
        )}

        {content && !generating && (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm leading-relaxed"
          />
        )}
      </CardContent>
      {content && (
        <CardFooter className="border-t pt-4 flex justify-between">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
