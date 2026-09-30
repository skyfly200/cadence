---
title: Trust and transparency model
type: grilling
status: closed
assignee: skyler
blocked-by: [10-architecture-and-storage]
parent: map.md
---
## Question

What does Cadence read, store and send, what stays local vs cloud, and what does the simple 'here is everything I can see and what I do with it' view contain?

Input (from the closed Architecture and storage ticket): data lives in Supabase with row-level security; the Occurrence log is the most sensitive data; AI calls go server-side with keys that never reach the browser; free Supabase has no point-in-time backups, so include backup and export (and delete-everything) in this ticket; LLM data-retention notes are in the LLM and Claude/ChatGPT research (OpenAI `store:false`; Claude's API MCP connector is not ZDR-eligible; Gemini's free tier trains on data, so use paid tiers only for personal data).

Input (from the closed Capture channels and MCP contract ticket): every capture and every assistant-made write is logged with its source in the occurrence log; when connectors arrive, a "Connected assistants" list in Settings shows each assistant, its last use and a Revoke button, and is the natural home of the "what can see and do what" view; captured text is treated as data, never instructions; the two connector scopes are read and write.

## Resolution

Decided in grilling (all recommendations accepted):

- **The transparency promise: one plain-language screen, "What Cadence knows and does",** reachable from Settings, written in the coach voice with no legal wording and no scare copy. It lists what is connected (Calendar now, assistants later), what is stored where (on this device, in the account, sent to the AI), what each feature sends to the AI, and the control for each. The "Connected assistants" list (each assistant, last use, Revoke) lives here.
- **What goes to the AI, and an off switch.** Each AI feature discloses in plain words what it sends, and only the relevant slice goes (the focus item, its nearby Links, recent activity), never the whole log. An **"AI off" switch** keeps the app fully working on the deterministic core: captures stay Ideas, nothing is extracted, and there is no "why this one" line. Paid API tiers only, with retention turned off where a provider allows it (for example OpenAI `store:false`; Gemini's free tier trains on data; Claude's API MCP connector is not zero-retention eligible).
- **Backup, export and delete.** A one-tap "Export everything" (a readable file) in Settings, building on the existing `exportAllData`, plus an opt-in, gentle monthly reminder to export (the free Supabase plan has no point-in-time backup). "Delete everything" waits a **7-day undo window** before it is final; this soft window is the only confirmation-like step and keeps the "undo instead of confirm dialogs" rule. Automatic backup to Google Drive is a later option.
- **Sign-in and connected accounts.** Row-level security on every table; **Google Calendar tokens move to the server** (stored encrypted, never in the browser's localStorage or the URL fragment, as they are today); AI keys stay server-only; passkeys stay the main sign-in. Sensitive actions (connecting or revoking an account, exporting, deleting) are recorded in an activity list the user can read.
- **Private flag.** Any Node can be marked **Private**: it is never sent to the AI and never returned to an assistant, but it still works in the app. Nothing is detected automatically in v1; crisis language stays a separate rule from the coach ticket. It composes with "AI off".
- **Activity log retention.** Kept by default, with the user in control: delete any date range, and an optional "forget older than a year" setting. Deleting removes derived patterns and Links that depended only on the deleted range.
- **Why and forget.** Tapping any suggestion or proposed Link shows its origin and evidence ("suggested because you took the cooler out the last three times"); one tap corrects it, and "Forget this" removes the Link and its evidence.
- **No analytics.** None by default; the current code has no tracking libraries. Success signals are computed on the device from the log. Any product telemetry would be strictly opt-in, aggregate, off by default, and listed on the transparency screen.

Findings from the code that led here: no analytics or tracking libraries exist; `exportAllData` and `importAllData` already exist; Google Calendar access and refresh tokens sit in localStorage and the OAuth callback returns them in the URL fragment (a weak spot fixed above); sync uses one Supabase table per collection keyed by `user_id`.

Left for later: the exact wording of the transparency screen, how crisis language is detected (still in the fog), and the Drive backup option.
