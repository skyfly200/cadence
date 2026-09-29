---
title: Capture channels and MCP contract
type: grilling
status: open
assignee:
blocked-by: [10-architecture-and-storage, 18-research-claude-chatgpt-integration, 19-research-own-app-handsfree-voice]
parent: map.md
---
## Question

What are the capture channels (typed, spoken, external assistants over MCP or similar), what is the contract for pushing raw input in, and how is it classified on arrival without asking the user which bucket?

Input: the capture feasibility research (branch research/assistant-capture-feasibility) recommends one authenticated capture endpoint plus a thin remote MCP server on top; Siri via Shortcuts works now; Gemini needs a per-write confirmation and in-car goes through Google Tasks; in-car Grok has no documented path. Resolve the contract and which channels ship first.

Settled by the author: Nuxt/Vue/Pinia on Vercel at https://cadence.skylerfly.com/ (own domain possible later). The contract must be hosted-function friendly (Vercel limits), and the MCP OAuth issuer, redirect URIs and endpoint URLs must survive a later domain change (or be designed to be re-pointed cheaply).

Author addition: Claude and ChatGPT are capture/voice-assistant targets alongside Gemini, Grok and Siri, and Cadence's own app should offer a hands-free voice experience of its own (the most controllable route). Inputs: the Claude/ChatGPT integration research and the own-app hands-free research. Decide which channels ship first and how the own-app voice mode relates to the external assistants.

Author decision: ChatGPT and Siri are OUT as capture/voice integrations (skipped). Targets are Claude, Gemini and Grok (custom MCP connectors) plus Cadence's own app; Siri/Shortcuts and ChatGPT findings stay in the research files as reference only. OpenAI remains a possible swappable LLM provider for Cadence's own AI layer unless the author says otherwise.
