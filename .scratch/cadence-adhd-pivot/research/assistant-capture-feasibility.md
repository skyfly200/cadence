# Research: voice-assistant capture feasibility (Gemini, Grok, Siri/iOS)

Researched 2026-09-29. Ticket: `.scratch/cadence-adhd-pivot/tickets/06-research-assistant-capture-feasibility.md`.
Note: fetched pages were summarised by a small model, so quotes are paraphrases of the fetched primary page, not verbatim. Anything marked UNVERIFIED was not confirmed on a first-party page.

## Question
Can Gemini, Grok (in car), and Siri/iOS push captures into Cadence (Nuxt 3 on Netlify, Supabase client dep, per `netlify.toml` and `package.json`) without opening it? What are the real paths, auth models, hosting needs and limits?

## Bottom line
| Assistant | Direct push into Cadence today? | Best real path |
|---|---|---|
| Gemini (app, phone) | Yes, via custom MCP connector, with caveats (US, personal account, English, web-only setup, write confirmation) | Cadence exposes a remote MCP server with a `capture` tool |
| Gemini (Android Auto / car) | No documented custom-app support | Indirect: Gemini saves to Google Tasks/Keep; Cadence ingests from there |
| Grok in Tesla | No. Nothing documented about third-party tools in the car | Indirect only (see below) |
| Grok app (grok.com) | Yes, custom MCP connector (public URL needed) | Same MCP server |
| Siri / iOS (today) | Yes via Shortcuts calling an HTTPS endpoint, no native app required | Shortcuts "Get Contents of URL" POST to a Cadence endpoint |
| Siri / iOS (App Intents) | Only with a native iOS app; Cadence is a web app | Deferred; needs native/Capacitor shell |

Recommended single build: one authenticated HTTPS capture endpoint plus a thin remote MCP server on top of it. That serves Gemini, the Grok app and (endpoint only) Shortcuts.

## Gemini

### Custom MCP servers in the Gemini app (primary path)
Source: Gemini Apps Help, "Connect & manage custom apps for Gemini Apps" https://support.google.com/gemini/answer/17209137
- Requirements: 18+, US, personal Google Account (not work/school), Keep Activity on, English only.
- Setup is web only: gemini.google.com, Settings, Connected Apps, Custom apps, paste MCP server URL. Works afterwards on web and mobile (iOS/Android).
- Auth: Dynamic Client Registration supported; otherwise manual client credentials under "Advanced features". So OAuth is expected; a plain static bearer token is not documented as an option (UNVERIFIED for consumer app).
- Write actions: Gemini requires manual confirmation for any write actions. A capture will prompt for a tap each time; fully hands-free "just save it" is not possible via this path.
- Invoke with `@AppName` in a prompt. Voice/hands-free use of custom apps and Android Auto are NOT mentioned on the page (UNVERIFIED).
- Google states it does not control or secure third-party MCP servers.
- Hosting: URL must be an MCP server per standard spec. A Gemini Enterprise doc (https://docs.cloud.google.com/gemini/enterprise/docs/connectors/custom-mcp-server/set-up-custom-mcp-server) says servers need a publicly trusted CA cert (no self-signed); that is the Enterprise product, so treat as likely but unconfirmed for consumer. Practically: public HTTPS endpoint required.
- A search snippet mentioned "Gemini Spark" gating custom apps; this was not on the fetched Help page. UNVERIFIED, check in the Gemini app settings.

### Gemini native capture (indirect path, works in car)
- Gemini saves tasks/reminders to Google Tasks (and Samsung Reminder on S25+), usable via "Hey Google"; Keep Activity required; not available in Gemini in Google Messages. Source: https://support.google.com/gemini/answer/15230285
- Android Auto: Gemini supports Google Calendar, Tasks, Keep and Samsung equivalents; "more third party apps coming over time" (rollout began Nov 2025). Source: https://blog.google/products-and-platforms/platforms/android/android-auto-gemini-tips/
- 9to5Google (2026-09-28, secondary) reports Gemini fully replaced Assistant on Android; not checked against Google.
- Indirect design: user says "add a task ..." to Gemini; Cadence polls Google Tasks API (`tasks.googleapis.com`, `GET/POST /tasks/v1/lists/{tasklist}/tasks`, https://developers.google.com/tasks/reference/rest). Cadence already has Google OAuth for Calendar (`netlify.toml` env vars), so adding a Tasks scope is incremental. Scopes, `updatedMin` and quota were not on the fetched page. UNVERIFIED: push notifications for Tasks (none found; assume polling).

### AppFunctions / App Actions (Android native)
- AppFunctions: experimental; Gemini integration is in "private preview with trusted testers" as of May 2026; needs Android 16+, a native app, and the `EXECUTE_APP_FUNCTIONS` permission. Not usable by a web app. Source: https://developer.android.com/ai/appfunctions
- Legacy App Actions/BIIs need a native Android app with shortcuts.xml. Not applicable to a web app.

## Grok

### Grok in Tesla
- Documented in-car capabilities: navigation, calls, text messaging, media, Controls search, climate etc., owner's-manual Q&A; expanded commands need AMD Ryzen hardware; activated by "Hey Grok", wheel button or App Launcher. Sources are secondary (Not a Tesla App, DriveTesla Canada, Motor1, Tech Times); Tesla's own page https://www.tesla.com/support/grok returned HTTP 403 to fetch, so first-party confirmation is UNVERIFIED.
- No source (first or secondary) mentions third-party tools, MCP, connectors or account-linked connectors in the car. Conclusion: assume in-car Grok cannot call Cadence. UNVERIFIED negative; re-check Tesla release notes.
- Indirect option to test: "Hey Grok, text ..." to a number/email that Cadence ingests (in-car texting is listed as a capability, secondary source). Unproven; test on the real car.

### Grok consumer app connectors
Sources: https://docs.x.ai/grok/connectors and https://docs.x.ai/grok/connectors/custom-mcp-tunneling
- grok.com/connectors, New Connector, Custom, enter MCP server URL, complete any required auth. Grok Business/Enterprise need admin provisioning.
- Server must be reachable over the public internet; localhost/private addresses are rejected. Tunnels (ngrok, Cloudflare Tunnel) are the documented workaround; Cloudflare quick tunnels lack SSE.
- Plan tier, platforms (web vs iOS/Android), voice-mode support, write-confirmation and limits are not stated. UNVERIFIED.

### xAI API (not the consumer app)
Source: https://docs.x.ai/developers/tools/remote-mcp
- Remote MCP supported in the xAI SDK, the OpenAI-compatible Responses API and the Speech-to-Speech API. Auth via an `authorization` token (sent as the Authorization header) and custom `headers`. Only Streamable HTTP and SSE transports. Not a route into the consumer app or Tesla; only relevant if Cadence builds its own voice agent.

## Siri / iOS

### Shortcuts (works today, no native app)
- "Get Contents of URL" supports GET/POST/PUT/PATCH/DELETE with a JSON/Form/File request body. Source: https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios
- Shortcuts can be run by Siri, Action Button, Back Tap and Apple Watch (section titles in the Shortcuts User Guide, https://support.apple.com/guide/shortcuts/). Details on locked-device behavior and CarPlay could not be retrieved. UNVERIFIED.
- Auth: any header you set (bearer token) stored inside the shortcut. Header configuration specifics and limits are not documented on the page; Apple Community/Developer Forum threads report bugs with JSON bodies and custom headers, so test.
- Pattern: shortcut = "Dictate Text" (or Siri phrase argument), then POST `{text}` to `https://<cadence>/api/capture` with `Authorization: Bearer <token>`. Needs only a public HTTPS endpoint, not an MCP server.
- Cost: user must install the shortcut and paste a token. For other users this is a manual setup step; a shared iCloud shortcut link makes it one-tap import plus token entry.

### App Intents / Siri AI (iOS 27)
- Apple positions App Intents as the way Siri acts in third-party apps; requires a native app with intents/schemas. Sources: https://developer.apple.com/documentation/appintents/apple-intelligence-and-siri-ai and WWDC26 sessions https://developer.apple.com/videos/play/wwdc2026/343/ and https://developer.apple.com/videos/play/wwdc2026/240/
- Siri AI announced June 2026; developer testing now, general user beta "later this year"; iOS/iPadOS not available in the EU initially; English at launch; iPhone 15 Pro and newer. Source: https://www.apple.com/newsroom/2026/06/apple-introduces-siri-ai-a-profoundly-more-capable-and-personal-assistant/
- A web/PWA Cadence cannot register App Intents. It would need a native wrapper (e.g., Capacitor plugin or SwiftUI shell); large scope.
- Siri "Extensions" for third-party chatbots (Gemini, Claude, ChatGPT in Siri): found only in secondary reports (9to5Mac 2026-03-26, The Next Web) about iOS 27 beta code; Apple's newsroom release did not mention it. UNVERIFIED, and it concerns swapping the chatbot, not pushing into third-party apps.

## Hosting and auth summary for Cadence
- All MCP-style paths need a public HTTPS endpoint with a CA-signed cert. Cadence on Netlify already provides this (Nitro preset in `netlify.toml`); local dev needs a tunnel.
- MCP remote auth per spec 2025-11-25 (https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): authorization is optional in the spec, but consumer clients expect OAuth 2.1 with PKCE (S256), Protected Resource Metadata (RFC 9728, `/.well-known/oauth-protected-resource`, or 401 with `WWW-Authenticate resource_metadata`), authorization-server metadata (RFC 8414), and Client ID Metadata Documents, Dynamic Client Registration or pre-registration; tokens sent as `Authorization: Bearer`, audience-bound (RFC 8707). Building this OAuth layer is the main cost of the MCP route. Whether Supabase Auth can serve as the authorization server is UNVERIFIED.
- Shortcuts path needs only a bearer-token endpoint.
- Transport: Streamable HTTP is the safest choice (Grok supports Streamable HTTP and SSE). Gemini transport specifics UNVERIFIED.
- Netlify Functions timeouts/limits: the overview page fetched had no numbers. UNVERIFIED; captures are tiny, but check before using long-lived SSE on serverless.

## Recommendation
1. Build `POST /api/capture` (bearer token, per-user, idempotency key). Immediately unlocks Siri via Shortcuts and future automations.
2. Add a minimal remote MCP server (`capture_thought` tool, Streamable HTTP, stateless) with OAuth for Gemini and the Grok app. Prototype against Grok first (documented public-URL flow, no geographic restriction stated), then Gemini (US-only, confirmation prompt on writes).
3. For the car: rely on Gemini to Google Tasks ingestion (Android Auto), and test whether in-car Grok can text/email a capture. Do not plan on Grok-in-Tesla calling MCP.
4. Defer App Intents/native iOS until Siri AI ships publicly and a native shell is otherwise justified.

## Open items to verify by hand
- Tesla first-party Grok page (403 to fetch) and whether any connector/custom action exists in-car.
- Whether Gemini custom apps run hands-free/by voice and in Android Auto; "Spark" gating.
- Grok connector auth types (static token vs OAuth), voice mode, write confirmation.
- Shortcuts run-with-Siri details: locked device, CarPlay.
- Google Tasks scopes/quota; Supabase as OAuth server for MCP.
- Netlify function timeouts.
