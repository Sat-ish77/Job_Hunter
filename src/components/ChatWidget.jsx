/**
 * src/components/ChatWidget.jsx
 * 
 * Floating AI Career Coach chatbot - Glassmorphism Design
 * Context-aware: detects current page and offers relevant suggestions
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, X, Send, Sparkles, Loader2, Bot } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [context, setContext] = useState({ type: 'general', jobId: null });
  const messagesEndRef = useRef(null);
  const location = useLocation();
  const params = useParams();

  // Detect page context and update suggestions
  useEffect(() => {
    const path = location.pathname;
    
    if (path.startsWith('/jobs/') && params.id) {
      setContext({ type: 'job', jobId: params.id });
    } else {
      setContext({ type: 'general', jobId: null });
    }
  }, [location.pathname, params.id]);

  // Load chat history from DB when widget first opens
  useEffect(() => {
    if (!isOpen || historyLoaded) return;

    const loadHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('chat_history')
          .select('role, content')
          .eq('user_id', user.id)
          .eq('context_type', 'general')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data && data.length > 0) {
          setMessages(data.reverse());
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      } finally {
        setHistoryLoaded(true);
      }
    };

    loadHistory();
  }, [isOpen, historyLoaded]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Context-aware suggestions
  const getSuggestions = () => {
    if (context.type === 'job') {
      return [
        "Analyze this job for me",
        "What skills am I missing?",
        "Help me write a cover letter",
      ];
    }
    if (location.pathname === '/dashboard') {
      return [
        "What project should I build?",
        "How do I improve my resume?",
        "Latest trends in AI/ML 2026?",
      ];
    }
    return [
      "Help me prepare for interviews",
      "What skills are in demand in 2026?",
      "Career advice for new grads",
    ];
  };

  const handleSend = async (messageText = input) => {
    if (!messageText.trim() || loading) return;

    const userMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Call career-coach Edge Function
      const { data, error } = await supabase.functions.invoke('career-coach', {
        body: {
          message: messageText,
          context: context.type,
          jobId: context.jobId,
          conversationHistory: messages.slice(-6), // Last 3 exchanges
        },
      });

      if (error) throw error;

      const assistantMessage = { role: 'assistant', content: data.reply };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response', {
        description: error.message || 'Please try again',
      });
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl shadow-blue-500/30 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 z-50 group"
        size="icon"
      >
        <Sparkles className="h-6 w-6 group-hover:scale-110 transition-transform" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-2xl shadow-blue-500/20 z-50 flex flex-col bg-slate-900/95 backdrop-blur-md border-white/10">
      <CardHeader className="border-b border-white/10 flex flex-row items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <CardTitle className="text-lg text-slate-100">Career Coach</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <h3 className="font-medium text-slate-100 mb-2">Hi! I'm your AI Career Coach</h3>
            <p className="text-sm text-slate-400 mb-4">
              {context.type === 'job' 
                ? "I can help you analyze this job and prepare your application."
                : "I can help with career advice, interview prep, and more."}
            </p>
            <div className="space-y-2">
              {getSuggestions().map((suggestion, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="w-full text-left justify-start bg-slate-800/50 border-white/10 text-slate-200 hover:bg-slate-700 hover:text-slate-100"
                  onClick={() => handleSend(suggestion)}
                  disabled={loading}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800/50 text-slate-100 backdrop-blur-sm border border-white/10'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t border-white/10 p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="min-h-[60px] max-h-[120px] resize-none bg-slate-800/50 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50"
            disabled={loading}
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            size="icon"
            className="flex-shrink-0 bg-blue-500 hover:bg-blue-600"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
