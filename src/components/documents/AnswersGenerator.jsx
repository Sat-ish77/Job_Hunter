import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, Copy, Check, Plus, Trash2, RefreshCw } from 'lucide-react';
import { generateAnswers, regenerateSingleAnswer } from '@/services/ai-service';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_QUESTIONS = [
  "Why are you interested in this role?",
  "Why do you want to work at [Company]?",
  "Describe a challenging project you've worked on.",
  "What are your greatest strengths?",
  "Where do you see yourself in 5 years?",
];

export default function AnswersGenerator({ job, resume, existingDoc, onSave }) {
  const [answers, setAnswers] = useState(existingDoc?.answers || []);
  const [generating, setGenerating] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleGenerateAnswers = async (questions) => {
    setGenerating(true);
    try {
      const result = await generateAnswers({ job, resume, questions });
      setAnswers(result.answers || []);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate answers');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSingle = async (index) => {
    const question = answers[index].question;
    setGenerating(true);
    try {
      const result = await regenerateSingleAnswer({ job, resume, question });
      const newAnswers = [...answers];
      newAnswers[index] = { question, answer: result };
      setAnswers(newAnswers);
    } catch (error) {
      console.error('Regeneration error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const copyAnswer = async (index) => {
    await navigator.clipboard.writeText(answers[index].answer);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const updateAnswer = (index, newAnswer) => {
    const newAnswers = [...answers];
    newAnswers[index] = { ...newAnswers[index], answer: newAnswer };
    setAnswers(newAnswers);
  };

  const addCustomQuestion = () => {
    if (newQuestion.trim()) {
      setAnswers([...answers, { question: newQuestion.trim(), answer: '' }]);
      setNewQuestion('');
    }
  };

  const removeQuestion = (index) => {
    setAnswers(answers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    await onSave(answers);
    toast.success('Answers saved');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Short Answers</CardTitle>
          {answers.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleSave}>
              Save All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {answers.length === 0 && !generating && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-medium text-slate-900 mb-1">Generate Application Answers</h3>
            <p className="text-sm text-slate-500 mb-4">
              AI will create personalized answers to common application questions
            </p>
            <Button
              onClick={() => handleGenerateAnswers(DEFAULT_QUESTIONS)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Answers
            </Button>
          </div>
        )}

        {generating && answers.length === 0 && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Generating personalized answers...</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {answers.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Label className="text-sm font-medium text-slate-700">{item.question}</Label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRegenerateSingle(index)}
                    disabled={generating}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyAnswer(index)}
                  >
                    {copiedIndex === index ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => removeQuestion(index)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={item.answer}
                onChange={(e) => updateAnswer(index, e.target.value)}
                placeholder="Your answer..."
                className="min-h-[100px] text-sm"
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {answers.length > 0 && (
          <div className="flex gap-2 pt-2">
            <Input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Add a custom question..."
              onKeyPress={(e) => e.key === 'Enter' && addCustomQuestion()}
            />
            <Button variant="outline" onClick={addCustomQuestion} disabled={!newQuestion.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
