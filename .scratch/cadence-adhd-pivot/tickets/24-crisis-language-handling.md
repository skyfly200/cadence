---
title: Crisis-language handling
type: grilling
status: closed
assignee: skyler
blocked-by: []
parent: map.md
---
## Question

The principle is settled (drop the coach voice, respond simply and kindly, point to real help; not therapy). How is crisis or self-harm language detected (on-device rules, the AI, or both, and how that composes with AI-off and the Private flag), which resources are shown for which region, what exactly is said, what is logged or not logged, and how false positives are kept harmless? A safety item needed before any conversational or AI feature (Phase 3) ships.

## Resolution

Decided in grilling (all recommendations accepted, 2026-10-01):

- **Detection:** on-device rules only; no AI classification, so sensitive text is never sent to be checked. Runs on every capture (typed or spoken), every Discuss message, and the AI's own Discuss replies (a matching reply is dropped and replaced by the safe card). Runs regardless of the AI-off switch and the Private flag. Not run on edits to existing entries.
- **Rules:** first-person intent phrases, not single words; idioms ("dying to see it", "kill the lights") are skipped.
- **Resources:** country from the device locale, overridable in Settings. Built-in list: US 988; UK and Ireland Samaritans 116 123; Canada 988; Australia Lifeline 13 11 14; elsewhere findahelpline.com. Tap-to-call or tap-to-open. Every number is verified against its official source before shipping.
- **What is said:** one calm card, no coach voice, no emoji, rewards or exclamation marks, e.g. "That sounds really heavy. I'm an app, so I can't be the help you deserve right now, but people can." plus resource buttons and one "Okay". The Discuss AI call for that turn is skipped. The capture is still saved as an Idea, marked Private automatically.
- **Logging:** nothing server-side (no flag, Occurrence or analytics). The device keeps only a last-shown time for a 24-hour cooldown.
- **False positives:** a "That's not what I meant" button dismisses the card with no follow-up; no repeat for 24 hours.
