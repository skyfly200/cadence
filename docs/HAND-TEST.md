# Hand-test checklist

Rebuilt from `docs/SPEC.md` section 13 (what shipped without being tried on a real screen) and section 16 (unverified items). This is a reconstruction, not the original list. Phases 0 to 2 were already verified by the author on a phone.

1. **Garden and Pressed book (Phase 4, "not yet tried in a browser").** Log a few habits and finish a few tasks, then check that both grow the Garden (`lib/domain/garden.ts`):
   - each habit is a plant and each kept period adds a bloom;
   - a Goal is a tree that grows with the Commitments done under it;
   - other tasks done or started scatter ground pieces (one per two, up to 12 a season);
   - undoing a log or a done takes its growth back.

   Then check the strip on Habits and Goals, the full garden from the weekly tally, pressing a plant (five per season), "Kept N times" on pressed cards, and that pressed pages sync to a second device (`cadence_kv`).
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
9. **Google Docs import.** In Settings > Import, connect Google. Pick a Google Doc with the Picker and check it produces tap-to-keep proposals. Check that Home handles Google's return, that a reconnect works after disconnecting, and that the Picker API key and the Production (unverified) consent screen are set. The Tasks import is gone: confirm Google no longer asks for the Tasks scope, and that "Remove the ideas imported from Google Tasks" clears any old ones.
10. **Extraction on real captures.** Capture "twice a week" and "monthly" phrases and check the Habit cycle. Capture a place name and check the address and coordinates come from the lookup. Edit the cycle and place on the Discuss card. Keep about 20 to 30 captures for the extraction spike (ticket 21).
11. **Safety and trust.** In Discuss, type crisis wording and check the calm help-line card, Private auto-save and the country setting. Then check the AI-off switch, Private, the export, and delete everything with the 7-day undo. Also check the new Discuss mic and the Duolingo open-app button on Android.

## Added since the list was written

12. **Working the Heap.** Tick an item done from the Plan, and use the edit and delete icons. Search, sort and filter the Heap by tag, ready, blocked and backlog. Flag an item Backlog and check it stays at the bottom whatever the sort. Give an Idea a "Depends on" and check the blocked item shows what it needs. Edit your tag list, capture a title that names a tag, and check the tag is applied. In the Planning session, schedule an item past the week and check it gets its own day in the Stack. Check the edit sheet scrolls with its buttons pinned, and the Private, Slog and Backlog hints on hover and tap.
13. **Tidy (Heap AI).** Run Tidy. Check it fills only blank tags and time guesses, that "needs first" connections wait for a tap, and that Private items are left out. If `TRIAGE_BASE_URL` is set in Vercel, check Jev or Laya picks the tag and size, and that Tidy still works when it is unset or down.
14. **Goals.** Reorder Goals up and down, edit one, and delete one. Check the confirm, and that its steps stay.
15. **Go deeper.** Open `/deeper` from the menu and the desktop rail. Check the Eisenhower quadrants against a few items you know (a deadline within 48 hours, a Goal step, a slog item). Turn on Trips and Map in Settings and check it opens.
16. **Onboarding.** On a fresh device with an empty graph, check the three-step welcome shows once, Skip works, and it replays from the menu.
17. **Audio modules.** Turn on In the car and check a nudge is spoken at full volume with speech off, and that mute and quiet hours still win. Set a playlist length with "Open music" on and check the focus length matches. If the `CADENCE_TTS_*` variables are set in Vercel, check a nudge uses the cloud voice, a Private item's line falls back to the browser voice, and a failure falls back too.

## Assumptions to confirm on real screens (SPEC 16)

- The warm Now card accent on the cool base.
- Balanced as the default density.
- Whether Calendar sync should work signed-out.
