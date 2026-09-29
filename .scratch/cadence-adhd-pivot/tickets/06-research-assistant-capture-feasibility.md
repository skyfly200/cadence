---
title: Research: voice-assistant capture feasibility
type: research
status: closed
assignee: research-subagent
blocked-by: []
parent: map.md
---
## Question

Can Gemini (assistant/app), Grok (in-car), and Siri/iOS push captures into a personal app today via MCP, webhooks, shortcuts or extensions? What are the real integration paths, auth models and limits for each?

## Resolution

Findings: branch `research/assistant-capture-feasibility`, file `research/assistant-capture-feasibility.md`.

- **Core shape:** one authenticated capture endpoint, with a thin remote MCP server (OAuth 2.1, Streamable HTTP) layered on top for the Gemini and Grok apps. Both need a public HTTPS URL; OAuth is the main cost of the MCP route.
- **Siri:** works today through Shortcuts ("Get Contents of URL" POSTing JSON with a bearer token), no native app needed. App Intents and Siri AI need a native iOS app and are still beta: defer.
- **Gemini:** custom MCP works in the Gemini app for US personal accounts, English, set up on the web only; every write needs a manual confirmation tap, so capture is never fully hands-free. In the car (Android Auto) it reaches only Google Tasks, Keep and Calendar, so the workable car route is ingesting from Google Tasks.
- **Grok:** the Grok app accepts a custom MCP connector on a public URL. No documented third-party or MCP path for in-car (Tesla) Grok; plan on the Grok app only. This weakens the transcript's "Grok in my car" assumption.
- **Unverified (check by hand):** Gemini custom apps by voice or in Android Auto, Grok connector auth and voice behaviour, Shortcuts on a locked phone or CarPlay, Google Tasks scopes and quota, Supabase as an MCP OAuth server, Netlify function timeouts. Sources were summarised by a small model, so quotes are paraphrases.

Author update: Grok's custom MCP connector support was confirmed by the author (consistent with the finding for the Grok app). Whether in-car Grok can use it is still unconfirmed.
