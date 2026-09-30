---
title: Research: Cadence's own hands-free voice experience
type: research
status: closed
assignee: research-subagent
blocked-by: []
parent: map.md
---
## Question

What are the real options for Cadence's own hands-free voice experience (talk to it, hear spoken nudges) built as a Nuxt/Vue web app on Vercel: browser speech recognition and synthesis (Web Speech API limits), realtime voice APIs (OpenAI Realtime, Gemini Live, Anthropic-based pipelines with separate STT/TTS), PWA vs native wrapper constraints on iOS and Android (background audio, screen off, wake word, Bluetooth/CarPlay/Android Auto), latency and cost, and privacy trade-offs? Which option gets closest to "hands-free in the car or while working" with the least engineering, and what is only possible with a native app?

## Resolution

Findings: branch `research/own-app-handsfree-voice`, copied to `research/own-app-handsfree-voice.md`.

- **Least-engineering hands-free path:** a foreground PWA with tap-to-talk. The browser streams the mic to a streaming STT provider (Deepgram or ElevenLabs, short-lived token from a Nuxt server route); Claude Haiku replies over SSE; streaming TTS speaks it. Add a wake lock and Bluetooth audio. Estimated 1-2 weeks and about $0.7-0.8 per realistic hour (agent's own arithmetic), about 1.5-2 s end to end. Vercel never holds a WebSocket open in this design.
- **Realtime APIs (OpenAI Realtime, Gemini Live):** faster to build and cheaper per minute, but lock the coach's brain to one vendor; Gemini Live is preview with 15-minute sessions and its free tier trains on data.
- **Web Speech API:** prototype only (audio goes to a vendor by default; iOS home-screen support reported broken by secondary sources).
- **Native-only:** screen-off listening, always-on wake word, a CarPlay screen (needs an Apple entitlement, no wake word), and anything on Android Auto (no fitting category). Capacitor alone does not give background mic.
- **In the car today:** treat it as a capture-channel problem (Siri/Shortcuts, or the Claude/ChatGPT voice apps posting to the capture endpoint), not an in-app feature.
- **Sound controls:** voice off by default, one mute that also stops the mic, no autoplay, Web Push text when the app is closed.

Unverified: model names (e.g. "Gemini 3.8 Live", "gpt-realtime-2.1") need a recheck; the iOS PWA speech breakage, WKWebView and Android screen-off mic behaviour come from forum/blog sources; Picovoice pricing and CarPlay details come from secondary sources; engineering time estimates are the agent's own.
