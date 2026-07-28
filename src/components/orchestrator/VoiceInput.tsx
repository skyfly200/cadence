'use client';

import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { Mic, Square, Loader2, AlertCircle, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error';

// --- Web Speech API typing (fallback path) ---
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
  onerror: ((e: { error: string }) => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface VoiceInputProps {
  autoStart?: boolean;
}

export interface VoiceInputHandle {
  startRecording: () => void;
}

export const VoiceInput = forwardRef<VoiceInputHandle, VoiceInputProps>(function VoiceInput({ autoStart = false }, _ref) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const createTask = useAppStore((s) => s.createTask);
  const { toast } = useToast();

  // Determine best available method on mount
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      // No Web Speech API — rely on MediaRecorder backend path
      setMode('voice');
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ---- Primary path: MediaRecorder → backend ASR (z-ai-web-dev-sdk) ----
  const startMediaRecording = useCallback(async () => {
    setErrorMsg('');
    setTranscript('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size === 0) {
          setState('error');
          setErrorMsg('No audio captured. Check your microphone and try again.');
          return;
        }
        setState('transcribing');
        try {
          // Read blob as ArrayBuffer → convert to clean base64 (no data: prefix issues)
          const arrayBuffer = await blob.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          // Use chunked btoa to avoid stack overflow on large recordings
          const chunkSize = 0x8000; // 32KB chunks
          let binary = '';
          for (let i = 0; i < uint8.length; i += chunkSize) {
            const chunk = uint8.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);

          const r = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, mimeType: mimeType || 'audio/webm' }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data?.error || 'Transcription failed');
          const text = (data?.text ?? '').trim();
          if (text) {
            setTranscript(text);
            setState('idle');
            toast({ title: 'Transcribed', description: text.slice(0, 80) + (text.length > 80 ? '…' : '') });
          } else {
            setState('error');
            setErrorMsg('Transcription returned empty text. Try speaking more clearly.');
          }
        } catch (err) {
          setState('error');
          setErrorMsg(err instanceof Error ? err.message : 'Transcription failed');
        }
      };
      recorder.start();
      setState('recording');
    } catch (e) {
      stopStream();
      setState('error');
      const msg = e instanceof Error ? e.message : 'Could not access microphone';
      setErrorMsg(
        msg.includes('Permission') || msg.includes('denied')
          ? 'Microphone permission denied. Allow mic access in your browser settings, or switch to text mode.'
          : `Microphone unavailable: ${msg}. You can switch to text mode below.`
      );
    }
  }, [stopStream, toast]);

  const stopMediaRecording = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== 'inactive') {
      r.stop();
    }
  }, []);

  // ---- Fallback path: Web Speech API (live interim results) ----
  const startWebSpeech = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      // Fall back to MediaRecorder
      void startMediaRecording();
      return;
    }
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
    rec.onerror = (e) => {
      setState('error');
      setErrorMsg(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone permission denied. Allow mic access or switch to text mode.'
          : e.error === 'no-speech'
            ? 'No speech detected. Try again or switch to text mode.'
            : `Voice error: ${e.error}. Try the media-recording mode or text input.`
      );
      setState('idle');
    };
    rec.onend = () => {
      setState('idle');
    };
    recRef.current = rec;
    setErrorMsg('');
    setTranscript('');
    setState('recording');
    try {
      rec.start();
    } catch {
      // if start() throws, fall back to MediaRecorder
      void startMediaRecording();
    }
  }, [startMediaRecording]);

  const stopWebSpeech = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setState('idle');
  }, []);

  const toggle = useCallback(() => {
    if (state === 'recording') {
      // Stop whichever is active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        stopMediaRecording(); // will transition to transcribing via onstop
      } else {
        stopWebSpeech();
      }
      return;
    }
    if (state === 'transcribing') return;
    // Start — prefer MediaRecorder (more reliable, works in more browsers)
    void startMediaRecording();
  }, [state, startMediaRecording, stopMediaRecording, stopWebSpeech]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      try { recRef.current?.stop(); } catch { /* noop */ }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
      }
    };
  }, [stopStream]);

  // Auto-start when dialog opens (fires once)
  const autoStartFired = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStartFired.current) {
      autoStartFired.current = true;
      const timer = setTimeout(() => void startMediaRecording(), 300);
      return () => clearTimeout(timer);
    }
  }, [autoStart, startMediaRecording]);

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
      title = text.replace(/to (the )?incubator list/i, '').replace(/to incubator/i, '').replace(/incubator/i, '').trim();
    } else if (lower.includes('today')) {
      status = 'today';
      title = text.replace(/to today('?s)? list/i, '').replace(/to today/i, '').replace(/today/i, '').trim();
    } else {
      title = text.replace(/^add/i, '').trim();
    }

    if (/design|poster|creative|write|draft|sketch|paint/i.test(lower)) category = 'Creative';
    else if (/email|reply|admin|invoice|form|expense/i.test(lower)) category = 'Admin';
    else if (/fix|repair|clean|maintenance|chore|laundry/i.test(lower)) category = 'Maintenance';
    else if (/workout|run|exercise|walk|meditate|yoga/i.test(lower)) category = 'Health';
    else if (/study|learn|read|research|course|tutorial/i.test(lower)) category = 'Learning';
    else if (/call|meet|friend|family|coffee|dinner with/i.test(lower)) category = 'Social';

    if (!title) title = text;

    const t = await createTask({ title, status, category });
    if (t) {
      toast({ title: 'Task captured', description: `"${t.title}" → ${status}` });
    }
    setTranscript('');
    setErrorMsg('');
  }, [transcript, createTask, toast]);

  const isBusy = state === 'recording' || state === 'transcribing';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant={state === 'recording' ? 'destructive' : state === 'transcribing' ? 'secondary' : 'outline'}
          onClick={toggle}
          disabled={state === 'transcribing'}
          aria-label={state === 'recording' ? 'Stop recording' : 'Start voice input'}
          className={cn(state === 'recording' && 'animate-pulse')}
        >
          {state === 'transcribing' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : state === 'recording' ? (
            <Square className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button>
        <Input
          value={transcript}
          onChange={(e) => { setTranscript(e.target.value); setErrorMsg(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void commit(); }}
          placeholder={
            state === 'recording' ? 'Listening… speak your task' :
            state === 'transcribing' ? 'Transcribing audio…' :
            'Tap the mic and speak, or type a task here'
          }
          className="flex-1"
          aria-label="Task transcript"
        />
        {transcript && (
          <Button size="sm" onClick={() => void commit()}>Add</Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => { setMode(mode === 'voice' ? 'text' : 'voice'); setErrorMsg(''); }}
          aria-label="Toggle text mode"
          title="Text mode (type manually)"
        >
          <Keyboard className="size-4" />
        </Button>
      </div>

      {/* Status / error feedback */}
      {state === 'recording' && (
        <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
          Recording — tap the square to stop and transcribe
        </p>
      )}
      {state === 'transcribing' && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="size-3 animate-spin" />
          Sending audio for transcription…
        </p>
      )}
      {state === 'error' && errorMsg && (
        <p className="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
          <AlertCircle className="size-3 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </p>
      )}
      {mode === 'voice' && state === 'idle' && !transcript && !errorMsg && (
        <p className="text-[11px] text-muted-foreground">
          Tip: say &ldquo;Add design new poster to Incubator list&rdquo; — we&apos;ll parse the title, category, and destination.
        </p>
      )}
    </div>
  );
});
