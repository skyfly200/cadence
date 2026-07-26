'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Minimal Web Speech API typing
interface SpeechRecognitionResult {
  transcript: string;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { [k: number]: { 0: SpeechRecognitionResult; isFinal: boolean }; length: number };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export function VoiceInput() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const createTask = useAppStore((s) => s.createTask);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch { /* noop */ } };
  }, []);

  const toggle = useCallback(() => {
    if (!recRef.current) {
      toast({ title: 'Voice input unavailable', description: 'Your browser does not support the Web Speech API.', variant: 'destructive' });
      return;
    }
    if (listening) {
      recRef.current.stop();
      setListening(false);
      return;
    }
    setTranscript('');
    setListening(true);
    recRef.current.start();
  }, [listening, toast]);

  const commit = useCallback(async () => {
    const text = transcript.trim();
    if (!text) return;
    // Parse voice command
    const lower = text.toLowerCase();
    let status: 'backlog' | 'incubator' | 'today' = 'backlog';
    let category = 'Admin';
    let title = text;

    if (lower.includes('incubator') || lower.includes('someday')) {
      status = 'incubator';
      title = text.replace(/to (the )?incubator list/i, '').replace(/incubator/i, '').trim();
    } else if (lower.includes('today')) {
      status = 'today';
      title = text.replace(/to today('?s)? list/i, '').replace(/today/i, '').replace(/^add/i, '').trim();
    } else {
      title = text.replace(/^add/i, '').trim();
    }

    if (/design|poster|creative|write|draft|sketch/i.test(lower)) category = 'Creative';
    else if (/email|reply|admin|invoice|form/i.test(lower)) category = 'Admin';
    else if (/fix|repair|clean|maintenance|chore/i.test(lower)) category = 'Maintenance';
    else if (/workout|run|exercise|walk|meditate/i.test(lower)) category = 'Health';
    else if (/study|learn|read|research|course/i.test(lower)) category = 'Learning';
    else if (/call|meet|friend|family|coffee/i.test(lower)) category = 'Social';

    const t = await createTask({ title: title || text, status, category });
    if (t) {
      toast({ title: 'Task captured', description: `"${t.title}" → ${status}` });
    }
    setTranscript('');
    setListening(false);
    try { recRef.current?.stop(); } catch { /* noop */ }
  }, [transcript, createTask, toast]);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant={listening ? 'destructive' : 'outline'}
        onClick={toggle}
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        className={cn(listening && 'animate-pulse')}
      >
        {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
      </Button>
      <Input
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void commit(); }}
        placeholder={listening ? 'Listening… speak your task' : 'Voice capture (mic → type or speak)'}
        className="flex-1"
      />
      {transcript && (
        <Button size="sm" onClick={() => void commit()}>Add</Button>
      )}
    </div>
  );
}
