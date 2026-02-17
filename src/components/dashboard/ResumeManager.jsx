/**
 * ResumeManager Component
 * 
 * Allows users to:
 * - View current resume
 * - Upload new resume
 * - Edit resume text
 * - Delete resume
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/utils';

export default function ResumeManager({ resume, onResumeUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [resumeText, setResumeText] = useState(resume?.raw_text || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (file.type !== 'application/pdf' && !file.name.endsWith('.txt')) {
      toast.error('Invalid file type', {
        description: 'Please upload a PDF or TXT file',
      });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to Supabase Storage
      const fileName = `${user.id}/resume_${Date.now()}.${file.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);

      // Parse resume using Edge Function
      const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-resume', {
        body: { file_url: publicUrl, file_type: file.type },
      });

      if (parseError) throw parseError;

      // Update or create resume in resumes table
      // NOTE: profiles table does NOT have resume columns — all resume data lives in `resumes`.
      const resumePayload = {
        user_id: user.id,
        raw_text: sanitizeText(parseData.resume_text || parseData.raw_text || ''),
        file_url: publicUrl,
        skills: parseData.skills || [],
        experience_bullets: parseData.experience || parseData.experience_bullets || [],
        updated_at: new Date().toISOString(),
      };

      let resumeError;
      if (resume?.id) {
        // Update existing resume — avoids creating duplicates
        ({ error: resumeError } = await supabase
          .from('resumes')
          .update(resumePayload)
          .eq('id', resume.id));
      } else {
        // No resume yet — insert a new one
        ({ error: resumeError } = await supabase
          .from('resumes')
          .insert(resumePayload));
      }

      if (resumeError) throw resumeError;

      setResumeText(parseData.resume_text || parseData.raw_text || '');
      onResumeUpdate?.();

      toast.success('Resume uploaded successfully!', {
        description: `Extracted ${parseData.skills?.length || 0} skills`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload resume', {
        description: error.message || 'Please try again',
      });
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update resumes table (profiles table does NOT have resume columns)
      let resumeError;
      if (resume?.id) {
        // Update existing resume — preserve skills, experience, etc.
        ({ error: resumeError } = await supabase
          .from('resumes')
          .update({
            raw_text: sanitizeText(resumeText),
            updated_at: new Date().toISOString(),
          })
          .eq('id', resume.id));
      } else {
        // No resume yet — insert a new one
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        ({ error: resumeError } = await supabase
          .from('resumes')
          .insert({
            user_id: currentUser.id,
            raw_text: sanitizeText(resumeText),
          }));
      }

      if (resumeError) throw resumeError;

      setIsEditing(false);
      onResumeUpdate?.();

      toast.success('Resume saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save resume', {
        description: error.message || 'Please try again',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your resume? This action cannot be undone.')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Delete from resumes table (profiles table does NOT have resume columns)
      const { error: resumeError } = await supabase
        .from('resumes')
        .delete()
        .eq('user_id', user.id);

      if (resumeError) throw resumeError;

      setResumeText('');
      setIsEditing(false);
      onResumeUpdate?.();

      toast.success('Resume deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete resume', {
        description: error.message || 'Please try again',
      });
    }
  };

  const hasResume = !!resume || !!resumeText;

  return (
    <Card className="bg-slate-900/50 backdrop-blur-md border-white/10">
      <CardHeader className="border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-slate-100">Resume</CardTitle>
              <p className="text-sm text-slate-400 mt-0.5">
                {hasResume ? (
                  <>Last updated: {resume?.updated_at ? new Date(resume.updated_at).toLocaleDateString() : 'Today'}</>
                ) : (
                  'No resume uploaded'
                )}
              </p>
            </div>
          </div>
          
          {hasResume && (
            <Badge className={cn(
              "bg-green-500/20 text-green-400 border-green-500/30",
              !hasResume && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
            )}>
              {hasResume ? (
                <><CheckCircle2 className="w-3 h-3 mr-1" /> Active</>
              ) : (
                <><AlertCircle className="w-3 h-3 mr-1" /> Missing</>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Upload Section */}
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1">
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full bg-slate-800/50 border-white/10 text-slate-200 hover:bg-slate-700"
              disabled={uploading}
              onClick={(e) => e.currentTarget.previousElementSibling.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {hasResume ? 'Upload New' : 'Upload Resume'}
                </>
              )}
            </Button>
          </label>

          {hasResume && !isEditing && (
            <>
              <Button
                variant="outline"
                className="bg-slate-800/50 border-white/10 text-slate-200 hover:bg-slate-700"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>

        {/* Resume Preview/Edit */}
        {hasResume && (
          <div className="space-y-3">
            {isEditing ? (
              <>
                <Textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="min-h-[300px] max-h-[500px] bg-slate-950/50 border-white/10 text-slate-100 placeholder:text-slate-500 font-mono text-sm"
                  placeholder="Paste your resume text here..."
                />
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    className="bg-slate-800/50 border-white/10 text-slate-200 hover:bg-slate-700"
                    onClick={() => {
                      setIsEditing(false);
                      setResumeText(resume?.raw_text || '');
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-slate-950/50 border border-white/10 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                <p className="text-slate-300 text-sm whitespace-pre-wrap font-mono">
                  {resumeText.substring(0, 500)}
                  {resumeText.length > 500 && '...'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!hasResume && (
          <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-lg">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 mb-2">No resume uploaded yet</p>
            <p className="text-sm text-slate-500">
              Upload your resume to get personalized job matches
            </p>
          </div>
        )}

        {/* Skills Preview */}
        {hasResume && resume?.skills && resume.skills.length > 0 && !isEditing && (
          <div className="pt-4 border-t border-white/10">
            <p className="text-sm text-slate-400 mb-2">Extracted Skills:</p>
            <div className="flex flex-wrap gap-2">
              {resume.skills.slice(0, 10).map((skill, i) => (
                <Badge key={i} className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  {skill}
                </Badge>
              ))}
              {resume.skills.length > 10 && (
                <Badge className="bg-slate-800/50 text-slate-400 border-white/10">
                  +{resume.skills.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

