import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Transcribe audio base64 via z-ai-web-dev-sdk ASR
// Accepts: { audio: <base64 string>, mimeType?: string }
// Returns: { text: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio, mimeType } = body || {};

    if (!audio || typeof audio !== 'string') {
      return NextResponse.json({ error: 'audio (base64) required' }, { status: 400 });
    }

    // Strip data-URL prefix if present (handles any mime type + params)
    const base64 = audio.replace(/^data:[^;]*;base64,/, '');

    // Quick sanity check: valid base64 only contains [A-Za-z0-9+/=]
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
      return NextResponse.json(
        { error: `Invalid base64 data. First 20 chars: "${base64.slice(0, 20)}"`, text: '' },
        { status: 400 },
      );
    }

    const zai = await ZAI.create();
    const response = await zai.audio.asr.create({
      file_base64: base64,
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
