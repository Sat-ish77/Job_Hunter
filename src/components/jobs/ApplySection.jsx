import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  MessageSquare,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function ApplySection({ job, documents, application, onMarkApplied }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copiedItem, setCopiedItem] = useState(null);

  const coverLetter = documents?.find(d => d.doc_type === 'cover_letter');
  const answers = documents?.find(d => d.doc_type === 'answers');

  const copyToClipboard = async (text, item) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(item);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const downloadApplicationPack = () => {
    // Create a text file with all materials
    const content = `
===========================================
APPLICATION PACK FOR: ${job.title} at ${job.company}
===========================================

APPLY URL: ${job.apply_url || job.url}

-------------------------------------------
COVER LETTER
-------------------------------------------
${coverLetter?.content || 'Not generated yet'}

-------------------------------------------
SHORT ANSWERS
-------------------------------------------
${answers?.answers?.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n') || 'Not generated yet'}

-------------------------------------------
JOB DETAILS
-------------------------------------------
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Remote: ${job.remote_type || 'Not specified'}
Required Skills: ${job.required_skills?.join(', ') || 'Not specified'}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Application_Pack_${job.company}_${job.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Application pack downloaded');
  };

  const isApplied = application?.status === 'applied' || 
                   application?.status === 'interview' || 
                   application?.status === 'offer';

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {isApplied && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">You've applied to this job</p>
              <p className="text-sm text-emerald-600">
                Applied on {application.applied_date ? new Date(application.applied_date).toLocaleDateString() : 'Unknown date'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Notice */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Safe Apply Mode</p>
            <p className="text-sm text-amber-700 mt-1">
              This app helps you prepare materials but does NOT auto-submit applications. 
              You must review everything and click submit on the company's website yourself.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Apply Now</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            asChild
          >
            <a href={job.apply_url || job.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Application Page
            </a>
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={downloadApplicationPack}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Application Pack
          </Button>
        </CardContent>
      </Card>

      {/* Materials Ready */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Cover Letter</span>
            </div>
            {coverLetter ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700">Ready</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(coverLetter.content, 'cover')}
                >
                  {copiedItem === 'cover' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className="text-slate-500">Not generated</Badge>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Short Answers</span>
            </div>
            {answers?.answers?.length > 0 ? (
              <Badge className="bg-emerald-100 text-emerald-700">
                {answers.answers.length} ready
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500">Not generated</Badge>
            )}
          </div>

          {/* Individual answers copy */}
          {answers?.answers?.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-slate-500 font-medium">Quick Copy Answers:</p>
              {answers.answers.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span className="text-slate-600 truncate flex-1 mr-2">{item.question}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => copyToClipboard(item.answer, `answer-${i}`)}
                  >
                    {copiedItem === `answer-${i}` ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation */}
      {!isApplied && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={setConfirmed}
                className="mt-0.5"
              />
              <label htmlFor="confirm" className="text-sm text-slate-600 cursor-pointer">
                I have reviewed my materials and successfully submitted my application on the company's website
              </label>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!confirmed}
              onClick={onMarkApplied}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark as Applied
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}