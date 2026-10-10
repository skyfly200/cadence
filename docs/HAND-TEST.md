# Hand-test checklist

Rebuilt from `docs/SPEC.md` section 13 (what shipped without being tried on a real screen) and section 16 (unverified items). This is a reconstruction, not the original list. Phases 0 to 2 were already verified by the author on a phone.

1. **Garden and Pressed book (Phase 4, "not yet tried in a browser").** Finish a few habit occurrences. Check the strip on Habits and Goals, the full garden from the weekly tally, pressing a plant (five per season), "Kept N times" on pressed cards, and that pressed pages sync to a second device (`cadence_kv`).
2. **Reward moments.** Trigger each of the five reward moments. Check the coach line, the tally and the soft tone. Tag something slog, accept the offer, and try the two-minute ritual. Turn on the opt-in end-of-day line.
3. **Signals.** Open the Signals page and do the weekly feeling check. Start an Experiment. Check that checkpoints appear at weeks 2, 4, 6, 8 and 12 (set the date forward or edit the start date to check). Confirm the slog signal counts a slog-tagged Commitment finished that week.
4. **Planning invitation.** Confirm the weekly Planning invitation arrives as a Web Push nudge (kind `planning`) and opens the Planning session. Check there is no in-app line any more.
5. **Planning recap to Garden.** Finish a Planning session and tap the recap card. It should open the Garden.
6. **Season names.** Check season names match your hemisphere, then try the Settings override.
7. **Connect Claude (Phase 5).** Register the connector at claude.ai. Check that:
   - the passkey consent screen appears and the grant succeeds;
   - the tools `whats_next`, `capture`, `log_kept` and `complete` work from a Claude chat;
   - the connection shows under Settings > Connected assistants;
   - Revoke stops access;
   - the token refresh works after an hour.
8. **Voice mode with the custom connector (unverified in research).** Try Claude voice mode with the connector. Note whether tools are callable hands-free. Gemini and Grok are optional.
9. **Google import.** In Settings > Account and data > Import, connect Google. Import Tasks as Ideas, then re-import and confirm no duplicates. Pick a Google Doc with the Picker and check it produces tap-to-keep proposals. Check that Home handles Google's return, that a reconnect works after disconnecting, and that the Picker API key and the Production (unverified) consent screen are set.
10. **Extraction on real captures.** In Discuss, capture "twice a week" and "monthly" phrases and check the Habit cycle (a plain Add of the same text now makes the Habit directly, see 12). Capture a place name and check the address and coordinates come from the lookup. Edit the cycle and place on the Discuss card. Keep about 20 to 30 captures for the extraction spike (ticket 21).
11. **Safety and trust.** In Discuss, type crisis wording and check the calm help-line card, Private auto-save and the country setting. Then check the AI-off switch, Private, the export, and delete everything with the 7-day undo. Also check the new Discuss mic and the Duolingo open-app button on Android.
12. **UI and UX pass (from the ideas report).** Only checked in a headless browser so far. On the phone, check:
   - **Capture button:** a tap opens the box with the keyboard up (iOS may need a second tap to raise it); holding it opens the mic. "stretch every day" adds a Habit, "goal: ..." adds a Goal, and Undo removes either.
   - **Undoable delete:** swipe or "⋯ > Delete" a Plan row, then Undo brings it back with its links (also after a sync in between, signed in).
   - **Plan rows:** "⋯" shows Edit, Push down and Delete; titles like "Renew passport" fit on one line. No heap count, no "N left" while sorting.
   - **Toasts:** one short line; the Undo toast and a nudge never show at once; nudge buttons are easy to hit.
   - **Now card:** Start, Start with me, Not now and "or send it to the heap". Done shows during a Focus together session and ends it.
   - **Density:** Simple shows the Heap as a list with Sort only; Balanced adds search; Rich adds filters, tags, Tidy and the Add forms on Plan, Habits and Goals.
   - **Settings:** six groups that open and close; the tone dial, literal-only and playful switches change the reward lines; the AI switch matches the privacy page; Show the welcome and Classic view live under Display.
   - **Look:** the new teal app icon on the home screen, the lucide lens icons, and dark mode after the palette move to named colours.

## Assumptions to confirm on real screens (SPEC 16)

- The warm Now card accent on the cool base.
- Balanced as the default density.
- Whether Calendar sync should work signed-out.
