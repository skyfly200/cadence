# Research: Cadence's own hands-free voice experience

Date researched: 2026-09-29. Ticket: `.scratch/cadence-adhd-pivot/tickets/19-research-own-app-handsfree-voice.md`.

**Question.** What are the real options for a hands-free voice experience (talk to it, hear calm spoken nudges) inside Cadence's own Nuxt/Vue app on Vercel: Web Speech API, realtime voice APIs, separate STT+LLM+TTS pipelines, PWA vs native wrapper (iOS/Android background audio, screen off, wake word, Bluetooth, CarPlay/Android Auto), latency, cost per hour, privacy? What gets closest to hands-free in the car or while working with the least engineering, and what is native-only?

**Method and caveats.**
- Pages were read through a summarising fetch tool, not raw. Exact figures and especially **model names** (e.g. "Gemini 3.8 Live", "gpt-realtime-2.1") should be re-checked on the source page before they drive a decision.
- Items marked **[secondary]** come from forum/blog/search snippets, not first-party docs. Items marked **[unverified]** are my judgement or knowledge and were not confirmed this session.
- Prices are "as of 2026-09-29".
- Repo fact: `netlify.toml` and `nuxt.config.ts` still point at Netlify (`cadencetodo.netlify.app`); the brief says the app is on Vercel at cadence.skylerfly.com. I checked neither deploy. Nothing below depends on which host, except section 4.4. The repo already has `@vite-pwa/nuxt` and no voice code (grep for SpeechRecognition/speechSynthesis in composables/components/pages: no hits).

---

## 1. Bottom line

1. **Closest to hands-free with least engineering: a PWA, foreground-only, tap-to-talk (or open-mic while the app is on screen and a wake lock is held), with a browser-direct streaming pipeline.** The browser opens the mic and streams to a streaming STT provider using a short-lived token minted by a Nuxt server route. The LLM reply is streamed via a server route (Claude), then passed to a streaming TTS. Roughly 1-2 weeks of work [unverified estimate]. Works in a phone mounted in a car, screen on, on charger, Bluetooth audio out.
2. **Honest limit of any web app: it stops listening when the screen locks or the app is backgrounded.** Every first-party doc I could reach is consistent with that (Wake Lock is released when the document is not visible; Android foreground services cannot use the mic when started from the background). Phone-in-pocket, screen-off, always-listening is **native-only**.
3. **Spoken nudges when the app is not open cannot be done by a web app.** Use Web Push (text notification; iOS 16.4+ home-screen web apps support it) for those. Speak nudges only while the app is open.
4. **Web Speech API is fine for a 1-day prototype, not a foundation.** Chromium sends audio to a server; support elsewhere is uneven; iOS home-screen mode is reported broken **[secondary]**.
5. **Native-only:** always-on wake word with screen off, mic in background, CarPlay screen. CarPlay now has a "voice-based conversational" category (iOS 26.4) but needs an Apple entitlement request and offers no third-party wake word. Android Auto has no category for a general voice/productivity app.
6. **Pragmatic in-car answer today is not in-app:** phone Siri / Shortcuts / the Claude or ChatGPT voice apps posting to Cadence's capture endpoint (ticket 11/18 territory). I did not research this here **[unverified]**. Own-app voice should be treated as "at the desk / mounted phone", and hands-free-in-car as a capture-channel problem.

---

## 2. Browser-native: Web Speech API

| Fact | Source |
|---|---|
| Two halves: `SpeechRecognition` (STT) and `SpeechSynthesis` (TTS). Recognition can be server-side (default) or on-device. | https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |
| SpeechRecognition is **not Baseline**. "On browsers like Chrome, speech recognition involves a server-based engine. Your audio is sent to a web service", so it fails offline. | https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition |
| On-device mode exists: set `recognition.processLocally = true`; `SpeechRecognition.available()` / `.install()` manage language packs; `quality: "dictation"` vs `"command"`. Gated by the `on-device-speech-recognition` Permissions-Policy (default `self`). Benefit: audio not sent to third parties, works offline. Which browsers implement it is not stated in what I read. | https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API |
| `continuous` defaults to false (one result per `start()`); true keeps capturing. Secure context (HTTPS) and mic permission required. | MDN SpeechRecognition page above |
| caniuse (fetched 2026-09-29): partial support in Chrome (25+), Safari (14.1 desktop, 14.5 iOS), Samsung Internet; **Firefox disabled by default; Edge not listed**. "Partial" = inconsistent behaviour. | https://caniuse.com/speech-recognition |
| iOS: SpeechRecognition **does not work inside a standalone home-screen PWA** (API exists, nothing happens); after audio playback, `start()` can leave a "zombie" mic session because the audio element still holds the session. | **[secondary]** blog/forum results (magicbell, technetexperts, bubble/zeroqode forums); no Apple doc found. Test on a real device before trusting or dismissing. |
| `SFSpeechRecognizer` (native iOS): on-device supported via `requiresOnDeviceRecognition`; recognition requests are time-limited (~1 min) and rate-limited per device/app; falls back to Apple servers otherwise. | https://developer.apple.com/documentation/speech/sfspeechrecognizer |
| `speechSynthesis`: works offline with OS voices, zero cost, but voice quality/availability varies by OS; voices load async (`voiceschanged`). Not "calm, warm" by default. | MDN Using_the_Web_Speech_API |

**Verdict.** Good for: prototype, desktop Chrome/Safari, low-stakes dictation, and a free fallback TTS for nudges. Bad for: cross-browser reliability, iOS PWA, privacy (audio to Google/Apple by default), long open-mic sessions (browsers end sessions on silence; you must auto-restart), and voice quality control (which matters for an "auditory calm" product).

---

## 3. Realtime speech-to-speech APIs and pipelines

### 3.1 OpenAI Realtime

- Transports: **WebRTC** (recommended for browsers) and WebSocket (server-side). Server mints an ephemeral client secret via `POST /v1/realtime/client_secrets`; browser uses it. https://developers.openai.com/api/docs/guides/realtime
- Turn detection: `server_vad` (silence-based; `threshold`, `prefix_padding_ms`, `silence_duration_ms`) or `semantic_vad` (`eagerness` low/medium/high; fewer false cut-ins). https://developers.openai.com/api/docs/guides/realtime-vad
- Price (https://developers.openai.com/api/docs/pricing): `gpt-realtime` family, per 1M tokens, full/mini: audio in $32 / $10, cached audio in $0.40 / $0.30, audio out $64 / $20. Page also lists `gpt-realtime-2.1` and `-2.1-mini` at identical prices (verify names).
- Token-to-time: user audio 1 token per 100 ms, assistant audio 1 token per 50 ms. Cached input keeps costs down if history stays static; truncation/`retention_ratio` control. https://developers.openai.com/api/docs/guides/realtime-costs
- Separate cheaper building blocks: `gpt-4o-transcribe` ~$0.006/min, `gpt-4o-mini-transcribe` ~$0.003/min, `gpt-4o-mini-tts` $0.60/M text-in and $12/M audio-out (pricing page).
- Privacy: API data not used for training unless opted in; abuse-monitoring logs up to 30 days; `/v1/realtime` supports Zero Data Retention (eligibility is account-level; tracing is not EU-residency compliant). https://developers.openai.com/api/docs/guides/your-data
- Max session length: **not stated** in what I fetched. **[unverified]**
- Trade-off for Cadence: fastest path to a good conversation, tool calling for capture, but it makes OpenAI the brain and voice. The other tickets aim at a provider-agnostic, memory-backed coach, and you cannot swap Claude into the speech-to-speech loop.

### 3.2 Gemini Live API

- Client-to-server WebSockets with **ephemeral tokens** (recommended for production), or server-to-server. Input 16-bit PCM 16 kHz, output PCM 24 kHz. https://ai.google.dev/gemini-api/docs/live
- Audio-only sessions limited to **15 minutes**, audio+video 2 minutes, extendable via session-management techniques; native audio models have 128k context. Configurable VAD (`startOfSpeechSensitivity`, `endOfSpeechSensitivity`, `silenceDurationMs`). Async (non-blocking) function calling. Affective dialog and proactive audio are **beta** (v1beta). "The Live API itself remains in preview." https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Model names on that page as summarised: "Gemini 3.8 Live" (default), "Gemini 3.8 Live Extended Thinking", "Gemini 3.1 Flash Live Preview" (legacy). **Verify names.**
- Price (https://ai.google.dev/gemini-api/docs/pricing, paid standard tier): Gemini 3.8 Live audio in $3.00/M (~$0.005/min), audio out $12.00/M (~$0.018/min).
- Privacy: **free tier content is used to improve Google products; paid tier is not.** Same pricing page. Never put personal life-graph data through the free tier.
- Cheapest of the speech-to-speech options per minute; preview status is a stability risk.

### 3.3 Separate STT + LLM + TTS (recommended shape for Cadence)

Anthropic has no first-party speech-to-text or text-to-speech API that I found. Claude's own app voice mode uses ElevenLabs voices, and Claude Code's voice dictation only works with a claude.ai login (https://code.claude.com/docs/en/voice-dictation, search snippet). Anthropic's cookbook shows the intended pattern: third-party STT + Claude + third-party TTS.

Reference pipeline (https://platform.claude.com/cookbook/third-party-elevenlabs-low-latency-stt-claude-tts, measured by Anthropic; models `scribe_v1`, `claude-haiku-4-5`, `eleven_turbo_v2_5`):

| Stage | Reported latency |
|---|---|
| STT (ElevenLabs Scribe) | 0.54 s |
| Claude Haiku 4.5, streaming first token | 0.71 s (non-streaming full reply 1.03 s) |
| Streaming TTS first audio chunk | 0.39 s |

Rough end-to-end from end of utterance to first audio: **~1.5-2 s** (sum of the above, my arithmetic; network from a phone will add). Speech-to-speech models are typically faster (sub-second) **[unverified, no first-party number gathered]**. For a calm ADHD coach a 1.5-2 s beat is acceptable; it is not a phone call.

Provider prices (fetched 2026-09-29):

| Provider | Item | Price | Source |
|---|---|---|---|
| Deepgram | Nova-3 streaming STT | $0.0048/min (labelled promotional) | https://deepgram.com/pricing |
| Deepgram | Aura-2 TTS / Aura-1 | $0.030 / $0.015 per 1k chars | same |
| Deepgram | Voice Agent API (STT+TTS+orchestration) | $0.075/min standard; $0.050/min if you bring your own LLM+TTS; billed by websocket connection time | same |
| ElevenLabs | Flash/Turbo TTS | $0.04 per 1k chars (~75 ms claimed) | https://elevenlabs.io/pricing/api |
| ElevenLabs | Scribe STT | $0.22/h batch, $0.39/h realtime | same |
| ElevenLabs | Agents | $0.08/min (burst $0.16) ; zero-retention only via Enterprise | same |
| Anthropic | Claude Haiku 4.5 / Sonnet 5.5 | $1/$5 and $2/$10 per MTok (see ticket 05 note) | https://platform.claude.com/docs/en/about-claude/pricing (via `research/llm-and-memory-options.md`) |

**Why this shape fits Cadence:** the LLM is the coach with the life graph and memory (any Claude model, prompt-cached). Voice is a swappable I/O layer. The browser talks to Deepgram/ElevenLabs directly with short-lived tokens, so **Vercel never has to hold a WebSocket open**; the Nuxt server only mints tokens and streams the LLM response (SSE). Vercel Functions cap duration at 300 s (Hobby) / 800 s (Pro; 1800 s beta) and bodies at 4.5 MB (https://vercel.com/docs/functions/limitations, page dated 2026-08-24), and Vercel says Functions now support WebSockets (public beta per changelog) but connections are pinned to one instance for max duration (https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections). Avoid depending on that.

### 3.4 Cost per hour (my arithmetic from the prices above; upper bounds for continuous talking)

| Setup | Assumption | $/hour |
|---|---|---|
| Deepgram Nova-3 STT only, mic streaming all hour | 60 min x $0.0048 | ~$0.29 |
| ElevenLabs Flash TTS, assistant speaking the whole hour | ~900 chars/min x 60 = 54k chars x $0.04/1k | ~$2.16 (Aura-2: ~$1.62) |
| Realistic coach: 10 min of speech out per hour | ~9k chars | ~$0.36 (ElevenLabs) |
| Claude Haiku 4.5 | 20 turns/h, ~3k input (mostly cached) + 150 out tokens | well under $0.10 [my estimate] |
| **Pipeline total, realistic hour** | STT open mic + 10 min TTS + Haiku | **~$0.7-0.8** |
| Deepgram Voice Agent, BYO LLM+TTS | $0.05/min x 60 | $3.00 |
| ElevenLabs Agents | $0.08/min x 60 | $4.80 |
| OpenAI Realtime full, if audio streamed continuously | user 36k tok/h in = $1.15; assistant 72k tok/h out = $4.61 (only if it talks all hour); plus context re-read on every turn | ~$1.15 with no speech out, up to ~$6 talking continuously |
| OpenAI Realtime mini | same tokens at $10/$20 | ~$0.36 in-only; ~$1.80 max |
| Gemini Live | $0.005/min in + $0.018/min out | ~$0.30 in-only; up to ~$1.38 |

Notes: server VAD bills whatever audio you stream, so gate the mic client-side (push-to-talk or local VAD) to avoid paying to send silence. Keep the LLM prompt static and cached. For a single user at a few hours a week, all of these are pocket change; cost is a non-issue compared with engineering time.

---

## 4. Web (PWA) vs native wrapper

### 4.1 What a PWA can do

- Mic capture via `getUserMedia` (WebRTC/PCM to a streaming STT), audio playback, Media Session API for lock-screen/headset metadata and media-key handlers (https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API). MDN explicitly says nothing there about keeping audio alive in the background, and the API is not Baseline.
- Screen Wake Lock (Baseline since March 2025): keeps the screen on, but is **automatically released when the document is not active/visible** or on low battery/power-saver (https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). iOS home-screen web apps got Wake Lock in 16.4 (https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- Web Push and Badging for home-screen web apps on iOS 16.4+ (same WebKit post). WebKit's post says nothing about background audio or mic.
- Android Chrome/WebRTC: mic and playback stop a short time after the screen turns off **[secondary]** (W3C webrtc mailing-list thread); consistent with Android's mic restrictions below.
- WKWebView (what Capacitor uses on iOS): `getUserMedia` mic is muted when the app goes to background **[secondary]** (Apple developer forum thread 689182 snippet).

### 4.2 What each platform allows once native

- **iOS:** declare `UIBackgroundModes: audio`, use `AVAudioSession` category `playAndRecord`; with the audio mode, recording continues when the app is backgrounded; Bluetooth routing via `allowBluetooth`/A2DP options (https://developer.apple.com/documentation/avfoundation/configuring-your-app-for-media-playback). This is the native capability the web lacks.
- **Android:** apps targeting API 31+ cannot start foreground services from the background; on Android 14+ foreground services needing mic access cannot start from the background at all unless launched by an exempt path (notification/widget tap, VoiceInteractionService, etc.) (https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start). So an "always-listening while screen off" service must be started by the user with the app visible, shown with a persistent notification.

### 4.3 Capacitor (web app in a native shell)

- `@capacitor-community/speech-recognition` (actively maintained per its README): discrete `start()`/`stop()` sessions; README silent on continuous/background use; a search-result summary states continuous listening is unsupported, a platform limit (partial results don't work with the Android popup; max 5 results). https://github.com/capacitor-community/speech-recognition
- So Capacitor gets you: an App Store/Play presence, native local notifications, and the ability to add native audio-session/foreground-service code via plugins. It does **not** by itself give you background listening; you would write or buy a native plugin (AVAudioEngine + `UIBackgroundModes audio`; Android foreground service with `microphone` type) and stream that audio to your STT provider. That is real native engineering and is Apple/Google review exposure. **[unverified: no first-party Capacitor doc read]**
- Reasonable partial win: Capacitor + native background *playback* so spoken nudges can play with the screen off (needs the iOS audio background mode; Apple review may push back if the app does not truly play audio content **[unverified]**).

### 4.4 Wake word

- Picovoice Porcupine has a browser (WebAssembly + Web Workers) SDK for Chrome/Safari/Firefox/Edge plus iOS/Android SDKs, fully on-device. Needs an AccessKey from the Picovoice Console; free signup, no card (https://picovoice.ai/docs/porcupine/). Search-result pricing: free tier limited to a single device and watermarked model, paid plans start at **$6,000/year** and custom wake words are gated above free **[secondary]**. Whether personal/hobby use with a custom "Hey Cadence" is allowed on free is **not confirmed**; check their licence page.
- In a browser it only listens while the tab is foreground with the mic open, so it is a "no tap needed while the app is on screen" convenience, not a screen-off wake word.
- Apple's own CarPlay note: no wake word for third-party apps; user must open the app (see 4.5).
- Open-source alternatives (openWakeWord etc.) exist **[unverified, not researched]**.

### 4.5 Car integration

- **Apple CarPlay:** the CarPlay page lists a **"Voice-based Conversational"** category among audio, messaging/VoIP, navigation, etc.; you must request a CarPlay entitlement from Apple and follow the HIG (https://developer.apple.com/carplay/). Per MacRumors (secondary, 2026-02-18): available from iOS 26.4; requires a voice-control screen while the voice service is active; apps cannot control vehicle or iPhone functions; **no wake word for third-party apps**; text/imagery in responses is restricted (iClarified/AppleInsider snippets). The official CarPlay Developer Guide PDF (June 2026) was too large for my fetch tool and I did not read it. Needs a native iOS app (Capacitor could host it, but CarPlay templates are native code) **[unverified]**.
- **Android Auto:** the Car App Library supports navigation, POI, IoT, weather, media, communication/messaging. "Your app must belong to one of the supported categories" to be listed. A general voice assistant/productivity app is **not** a category (https://developer.android.com/training/cars/apps). A "media" or "messaging" framing is possible but risks review rejection **[unverified]**.
- **PWA:** no CarPlay or Android Auto surface at all.
- **Bluetooth (any option):** the phone's Bluetooth headset/car hands-free profile carries mic and speaker. For a PWA the OS routes audio; the iOS "built-in mic silently captures nothing while a Bluetooth mic keeps working" symptom is reported for non-standalone PWAs **[secondary]**. Test in the actual car.

---

## 5. Option comparison

| Option | Hands-free level | Screen off / background | Wake word | Car | Engineering | $ per realistic hour | Privacy |
|---|---|---|---|---|---|---|---|
| A. Web Speech API (STT+TTS), PWA | Tap or auto-restart while app open | No | No | No | Days | $0 | Audio to Google (Chrome) / Apple; on-device mode where supported |
| B. PWA + Deepgram/ElevenLabs + Claude (browser-direct tokens, Nuxt routes) | Tap-to-talk or open mic while app is foreground and wake-locked; Bluetooth audio | No | Optional foreground-only (Porcupine) | Phone mounted, app open only | ~1-2 weeks [est.] | ~$0.7-0.8 | Audio to Deepgram/ElevenLabs, text to Anthropic; you control retention settings |
| C. PWA + OpenAI Realtime (WebRTC) or Gemini Live | Same as B, better barge-in and turn-taking | No | Same | Same | ~3-7 days [est.] | $0.4-6 depending on talk time | Audio to OpenAI/Google; Gemini free tier trains on data; ties brain to that vendor |
| D. Capacitor shell + B/C | Adds native notifications; background playback plausible; background mic needs custom native plugin | Playback yes (with work); mic only with custom native code | Native SDK possible | CarPlay only with native templates + entitlement | Weeks + store review | As B/C | As B/C |
| E. Fully native iOS/Android | Best | Yes (audio background mode / foreground service) | Yes on-device | CarPlay voice-conversational category (iOS 26.4+, entitlement); Android Auto no fitting category | Months | As B/C | On-device STT possible (`SFSpeechRecognizer` on-device) |

---

## 6. Privacy trade-offs

- **Web Speech (Chrome):** audio leaves the device to the browser vendor's service by default; `processLocally` is an opt-in and depends on browser support (MDN). Least controllable.
- **Streaming STT vendors:** raw voice of a person describing their day, health, finances and fears (ADHD context) leaves the device. Pick a vendor with a no-train / zero-retention setting and record it in the trust model (ticket 12). ElevenLabs zero retention is Enterprise-only per its pricing page. Deepgram's retention terms not gathered **[unverified]**.
- **OpenAI:** no training by default, 30-day abuse logs, ZDR available for `/v1/realtime` (your-data guide).
- **Gemini:** paid tier only; free tier content is used to improve products.
- **Anthropic:** text only in pipeline B, which means voice audio never reaches Anthropic; only the transcript does. Retention terms: see ticket 05 / not re-verified here.
- **Mitigations that cost little:** transcribe in short utterances, discard audio immediately, show a persistent mic indicator, mute by default, offer a text-only mode, gate the mic client-side, never send audio to a vendor unless the user pressed a control.
- **Only-native privacy upside:** true on-device STT (`SFSpeechRecognizer` `requiresOnDeviceRecognition`) and on-device wake word.

---

## 7. Sensory-control implications (author dislikes intrusive audio)

Design defaults that these options make easy: voice off by default; per-feature toggles (speak nudges, listen, wake word); no audio autoplay (browsers block it anyway until a user gesture, so first tap enables sound); short, calm text-to-speech phrases; a single visible "mute" that also stops the mic; lock-screen Media Session pause; fall back to Web Push text when the app is closed. TTS voice quality is the main lever for "calm": browser `speechSynthesis` voices are OS-dependent, so use ElevenLabs/Deepgram/OpenAI TTS for nudges if quality matters, with `speechSynthesis` as offline fallback.

---

## 8. Suggested spike (small, answers the open risks)

1. On a real iPhone (home-screen PWA, Bluetooth headset) and a real Android phone: does `getUserMedia` + Deepgram WebSocket stream survive with the screen on and app mounted for 30 min? What happens on screen lock? Does TTS playback through the car's Bluetooth then resume the mic cleanly (the "zombie mic" issue above)?
2. Build the browser-direct pipeline behind a `useVoice()` composable with provider adapters (STT, TTS) so vendors can be swapped, and a `/api/voice/token` route.
3. Decide the in-car story separately (Shortcuts/Siri + capture endpoint, or Claude/ChatGPT voice apps via MCP per tickets 11/18) rather than trying to make the PWA a driving assistant.
4. Only if screen-off/CarPlay matters after living with (1)-(3), evaluate a native iOS app for the CarPlay voice-conversational entitlement.

## 9. Unverified or weak items (summary)

- Exact model names for Gemini and OpenAI realtime (fetch-summariser output).
- iOS standalone-PWA SpeechRecognition breakage, WKWebView background mic muting, Android Chrome mic stopping on screen off: forum/blog level, no first-party doc.
- Picovoice free-tier terms for personal use, and $6,000/yr starter figure (search snippet).
- CarPlay voice-conversational specifics (no wake word, template rules): MacRumors/iClarified/AppleInsider; official CarPlay Developer Guide not read (too large to fetch).
- Which browsers support Web Speech `processLocally`.
- OpenAI Realtime max session length and Deepgram/ElevenLabs retention terms.
- Speech-to-speech latency numbers (no first-party figure gathered); pipeline latency is Anthropic's cookbook and is a lab measurement.
- Engineering time estimates are mine.
