import ZAI from 'z-ai-web-dev-sdk';

// Transcribe base64 audio via z-ai-web-dev-sdk ASR.
// Accepts: { audio: <base64 string>, mimeType?: string } → { text: string }
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { audio, mimeType } = body || {};

    if (!audio || typeof audio !== 'string') {
      setResponseStatus(event, 400);
      return { error: 'audio (base64) required' };
    }

    const base64 = audio.replace(/^data:[^;]*;base64,/, '');
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
      setResponseStatus(event, 400);
      return { error: `Invalid base64 data. First 20 chars: "${base64.slice(0, 20)}"`, text: '' };
    }

    const zai = await ZAI.create();
    const response = await zai.audio.asr.create({
      file_base64: base64,
      ...(mimeType ? { mime_type: mimeType } : {}),
    });

    const text = (response?.text ?? '').trim();
    return { text };
  } catch (e) {
    console.error('voice/transcribe failed', e);
    const msg = e instanceof Error ? e.message : 'transcription failed';
    // z-ai-web-dev-sdk throws this when its credentials file is missing.
    if (/\.z-ai-config|Configuration file not found/i.test(msg)) {
      setResponseStatus(event, 503);
      return {
        error: 'Voice transcription isn’t configured on the server. Type your task in the box instead.',
        text: '',
      };
    }
    setResponseStatus(event, 500);
    return { error: msg, text: '' };
  }
});
