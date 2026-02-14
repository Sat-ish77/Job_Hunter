import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Check, Loader2 } from 'lucide-react';
import { uploadResume, extractResumeFromPDF, parseResume } from '@/services/ai-service';
import { sanitizeText } from '@/utils';
import { motion } from 'framer-motion';

export default function ResumeUpload({ onComplete, initialData }) {
  const [activeTab, setActiveTab] = useState('upload');
  const [resumeText, setResumeText] = useState(initialData?.raw_text || '');
  const [fileUrl, setFileUrl] = useState(initialData?.file_url || '');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadedResumeData, setUploadedResumeData] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      // Upload file to Supabase Storage
      const { file_url } = await uploadResume({ file });
      setFileUrl(file_url);

      // Try to extract text and structured data from PDF via Edge Function
      setProcessing(true);
      try {
        const result = await extractResumeFromPDF({ fileUrl: file_url });

        const resumeData = {
          raw_text: sanitizeText(result.full_text),
          file_url,
          skills: result.skills || [],
          experience_bullets: result.experience_bullets || [],
          education: sanitizeText(result.education),
          projects: result.projects || []
        };

        setResumeText(sanitizeText(result.full_text));
        setUploadedResumeData(resumeData);
        
        // Auto-advance to next step after successful upload and extraction
        onComplete(resumeData);
      } catch (extractError) {
        // If extraction fails, still allow user to continue with just the file
        console.warn('Extraction failed, but upload succeeded:', extractError);
        
        // Show toast notification
        const { toast } = await import('sonner');
        toast.error('Resume extraction failed', {
          description: 'Your resume was uploaded, but automatic extraction failed. You can continue and add details manually.',
        });
        
        const resumeData = {
          raw_text: '',
          file_url,
          skills: [],
          experience_bullets: [],
          education: '',
          projects: []
        };
        setUploadedResumeData(resumeData);
        // Don't set error state - allow user to proceed
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload resume. Please try again.');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!resumeText.trim()) return;

    setProcessing(true);
    try {
      // Parse pasted resume text via LLM
      const result = await parseResume({ resumeText });

      onComplete({
        raw_text: sanitizeText(resumeText),
        file_url: fileUrl,
        skills: result.skills || [],
        experience_bullets: result.experience_bullets || [],
        education: sanitizeText(result.education),
        projects: result.projects || []
      });
    } catch (error) {
      console.error('Processing error:', error);
    } finally {
      setProcessing(false);
    }
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
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Add Your Resume</h2>
          <p className="text-sm text-slate-500 mt-1">
            We'll analyze your resume to find the best matching jobs
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload PDF</TabsTrigger>
            <TabsTrigger value="paste">Paste Text</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4 space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors">
              <input
                type="file"
                id="resume-upload"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="resume-upload" className="cursor-pointer">
                {uploading || processing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                    <p className="mt-3 text-sm text-slate-600">
                      {uploading ? 'Uploading...' : 'Analyzing resume...'}
                    </p>
                  </div>
                ) : fileUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-900">Resume uploaded</p>
                    <p className="mt-1 text-xs text-slate-500">Click to upload a different file</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-10 h-10 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-900">
                      Drop your resume here or click to browse
                    </p>
                    <p className="mt-1 text-xs text-slate-500">PDF files only</p>
                  </div>
                )}
              </label>
            </div>
            
            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            
            {/* Continue button appears after successful upload (if auto-advance didn't work) */}
            {fileUrl && !uploading && !processing && uploadedResumeData && (
              <Button
                onClick={() => {
                  // Manually proceed to next step with the uploaded resume data
                  onComplete(uploadedResumeData);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                Continue to Next Step
              </Button>
            )}
          </TabsContent>

          <TabsContent value="paste" className="mt-4 space-y-4">
            <div>
              <Label className="text-sm text-slate-600">Resume Text</Label>
              <Textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume content here..."
                className="mt-1.5 min-h-[200px] text-sm"
              />
            </div>
            <Button
              onClick={handleTextSubmit}
              disabled={!resumeText.trim() || processing}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
}
