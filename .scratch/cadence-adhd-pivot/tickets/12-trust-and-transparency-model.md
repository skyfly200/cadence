---
title: Trust and transparency model
type: grilling
status: open
assignee:
blocked-by: [10-architecture-and-storage]
parent: map.md
---
## Question

What does Cadence read, store and send, what stays local vs cloud, and what does the simple 'here is everything I can see and what I do with it' view contain?

Input (from the closed Architecture and storage ticket): data lives in Supabase with row-level security; the Occurrence log is the most sensitive data; AI calls go server-side with keys that never reach the browser; free Supabase has no point-in-time backups, so include backup and export (and delete-everything) in this ticket; LLM data-retention notes are in the LLM and Claude/ChatGPT research (OpenAI `store:false`; Claude's API MCP connector is not ZDR-eligible; Gemini's free tier trains on data, so use paid tiers only for personal data).

Input (from the closed Capture channels and MCP contract ticket): every capture and every assistant-made write is logged with its source in the occurrence log; when connectors arrive, a "Connected assistants" list in Settings shows each assistant, its last use and a Revoke button, and is the natural home of the "what can see and do what" view; captured text is treated as data, never instructions; the two connector scopes are read and write.
