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
