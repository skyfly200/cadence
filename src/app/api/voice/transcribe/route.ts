import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Transcribe audio base64 via z-ai-web-dev-sdk ASR
// Accepts: { audio: <base64 string>, mimeType: "audio/webm"|"audio/wav"|... }
// Returns: { text: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio, mimeType } = body || {};

    if (!audio || typeof audio !== 'string') {
      return NextResponse.json({ error: 'audio (base64) required' }, { status: 400 });
    }

    // Strip data-URL prefix if present
    const base64 = audio.replace(/^data:audio\/[a-z]+;base64,/, '');

    const zai = await ZAI.create();
    const response = await zai.audio.asr.create({
      file_base64: base64,
      // mime type hint not strictly required by SDK, but include if provided
      ...(mimeType ? { mime_type: mimeType } : {}),
    });

    const text = (response?.text ?? '').trim();
    return NextResponse.json({ text });
  } catch (e) {
    console.error('voice/transcribe failed', e);
    const msg = e instanceof Error ? e.message : 'transcription failed';
    return NextResponse.json({ error: msg, text: '' }, { status: 500 });
  }
}
