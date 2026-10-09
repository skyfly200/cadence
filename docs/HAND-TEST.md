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
9. **Google import.** In Settings > Import, connect Google. Import Tasks as Ideas, then re-import and confirm no duplicates. Pick a Google Doc with the Picker and check it produces tap-to-keep proposals. Check that Home handles Google's return, that a reconnect works after disconnecting, and that the Picker API key and the Production (unverified) consent screen are set.
10. **Extraction on real captures.** Capture "twice a week" and "monthly" phrases and check the Habit cycle. Capture a place name and check the address and coordinates come from the lookup. Edit the cycle and place on the Discuss card. Keep about 20 to 30 captures for the extraction spike (ticket 21).
11. **Safety and trust.** In Discuss, type crisis wording and check the calm help-line card, Private auto-save and the country setting. Then check the AI-off switch, Private, the export, and delete everything with the 7-day undo. Also check the new Discuss mic and the Duolingo open-app button on Android.
12. **Tap-to-talk back-and-forth.** On an Android phone and an iPhone, with AI on, tap the bottom mic: it should open Discuss (after the one-time note) already listening. Say something and tap the square. Check it shows as your turn, Cadence answers with a question in text, and the mic opens again by itself. Turn on the speaker button and check the next answer is also said aloud, and that the setting is remembered. Then with AI off, check the mic parks each thing as a turn with a reply, and that both things are in the heap after Close. Check words are not repeated in the transcript on Android. Check that mute keeps it silent with the mic off, that the reply never gets picked up by the mic, and note whether iOS Safari refuses to reopen the mic without a tap.


## Assumptions to confirm on real screens (SPEC 16)

- The warm Now card accent on the cool base.
- Balanced as the default density.
- Whether Calendar sync should work signed-out.
