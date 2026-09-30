# ADHD / AuDHD design evidence for Cadence

Ticket: `.scratch/cadence-adhd-pivot/tickets/04-research-adhd-design-evidence.md`
Researched: 2026-09-29. Method: web search, then abstracts read via publisher/Europe PMC/PMC pages. Several publisher pages (ACM DL, JAACAP, PubMed) returned 403, so where I could not read the abstract myself the claim is marked **[unverified: secondary]**.

Evidence grades used: **Strong** = meta-analysis or RCT of the actual construct. **Moderate** = a single controlled study, or a meta-analysis of a neighbouring construct. **Weak** = qualitative or survey evidence, or a small null-ish study. **None found** = folk wisdom with no primary source located.

## Summary table

| Topic | Grade | One-line verdict |
|---|---|---|
| Time blindness / timing deficits | Strong (that deficits exist), Weak (for adults specifically, and for "external time cues fix it") | Real, measurable timing differences; "time blindness" is a folk label. Adult data is thin. |
| Working memory deficit | Strong | Robust deficit. Externalising is theory-consistent and CBT-with-organising-skills has an RCT, but no trial isolates "external offloading". |
| Delay aversion / reward | Strong (that immediate reward is preferred) | Supports short-loop feedback. No evidence gamified apps improve outcomes. |
| Transitions | Moderate (set-shifting cost) | Shifting attentional set costs more in ADHD; the evidence for transition warnings is from children/autism and I could not verify it. |
| Body doubling | Weak | One 26-person null EEG study, surveys, no RCT. |
| Spoken nudge vs alarm (startle) | None found for the ADHD claim | The one adult ADHD startle study found no baseline difference. Generic alarm human-factors research supports "avoid startle" but not "voice beats tone" cleanly. |
| AuDHD sensory | Strong (ADHD sensory atypicality, questionnaire-based), Moderate (autism) | Design for sensory control. |
| Demand avoidance / PDA | Weak | PDA is not a recognised diagnosis; construct evidence is poor. Autonomy-supportive design is reasonable but not evidence-backed. |

---

## 1. Time blindness

**Well supported**
- A 2022 meta-analysis (55 studies) found ADHD groups have worse time discrimination (especially sub-second), more variable duration estimation over seconds, and deficits in time estimation and production accuracy. In time reproduction, they found attentional effects (slower counting at short intervals) and motivational effects (faster counting at long intervals, linked to delay aversion). The authors conclude there is a "broad range of timing deficits". Source: Meta-analysis: Altered Perceptual Timing Abilities in ADHD, *JAACAP* 2022, doi:10.1016/j.jaac.2021.12.004, PMID 34923055 (abstract read via Europe PMC). https://doi.org/10.1016/j.jaac.2021.12.004

**Caveats**
- Most tasks are sub-second to seconds. Planning-scale time (hours, "how long will this take") is a different construct, and the meta-analysis does not measure it.
- An adult-only review found the literature "very scarce" and inconsistent: some studies show deficits in estimation, reproduction, and time management, others find no clear association, with heterogeneous methods. *Int J Environ Res Public Health* 2023, "Time Perception in Adult ADHD: Findings from a Decade-A Review", doi:10.3390/ijerph20043098. https://doi.org/10.3390/ijerph20043098

**Folk wisdom / unsupported**
- "Time blindness" as a single, uniform trait. It is an umbrella label and adult evidence is mixed.
- That visual timers or countdown displays fix it. I found no adult ADHD trial of this. Timer vendor blogs are the only source located.

**Design implication (inference, not evidence):** Showing elapsed and remaining time explicitly is consistent with the mechanism. Treat it as a hypothesis to validate with users, not an established effect.

## 2. External working-memory offloading

**Well supported**
- Working-memory deficit in ADHD is robustly documented. A review of meta-analyses (Pievsky and McGrath 2018, as summarised by secondary sources; effect sizes roughly 0.5) is the usual citation. **[unverified: secondary]**
- Adults with ADHD do worse on complex prospective memory tasks (remembering to act later), with impairment tied mainly to planning. Source: Complex Prospective Memory in Adults with ADHD, PMC3590133. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3590133/ (found via search; abstract not opened in detail).
- Skills-based CBT for adult ADHD, whose modules include organising, planning, and reminder systems, beat an active control in an RCT (n=86, medicated adults with residual symptoms; 67% vs 33% responders; effects held to 12-month follow-up). Safren et al., *JAMA* 2010, doi:10.1001/jama.2010.1192. https://doi.org/10.1001/jama.2010.1192
- NICE NG87 recommends environmental modifications for adults with ADHD first and, where non-pharmacological treatment is used, a structured supportive psychological intervention. https://www.nice.org.uk/guidance/ng87/chapter/recommendations

**Caveats**
- No trial isolates "external offloading" as the active ingredient. Safren bundles many skills, delivered by a therapist.
- The claim "external systems work better than willpower" appeared in non-primary blogs. Treat as folk phrasing of a plausible inference.

**Design implication:** Capture-first, low-friction entry and always-visible current-task state are mechanism-consistent. Evidence is indirect.

## 3. Reward, delay aversion, gamification

**Well supported**
- Meta-analysis of 37 group comparisons (3,763 participants): ADHD groups choose small immediate over larger delayed rewards more often than controls (small-to-medium effect). Real rewards nearly doubled the odds ratio in simple-choice paradigms, hypothetical rewards were less motivating. Marx et al., *J Atten Disord* 2021, doi:10.1177/1087054718772138, PMID 29806533. https://doi.org/10.1177/1087054718772138

**Weak or absent**
- A systematic review of ADHD apps (355 found, 109 included, 33 designed for adults) found none of the adult apps reported evidence of efficacy; only one of 51 papers met inclusion. *Attention-deficit/hyperactivity disorder mobile apps: a systematic review*, *Int J Med Inform* 2018. https://www.sciencedirect.com/science/article/abs/pii/S138650561830323X (numbers from search summary, page not opened: **[unverified: secondary]**).
- One feasibility study of a CBT-based app (Inflow) reported acceptable usability and self-reported symptom decreases, uncontrolled. *PLOS Digital Health* 2023. https://journals.plos.org/digitalhealth/article?id=10.1371%2Fjournal.pdig.0000083
- "Novelty decay" of gamification (effect fades in weeks to months) and "48% higher retention with game elements" both came from vendor or blog sources. I found no primary source. Treat as folk wisdom.

**Design implication:** Immediate, concrete feedback is consistent with delay aversion. There is no evidence that points, streaks, or avatars help ADHD adults, and streaks may carry a shame risk (not evidenced either way, inference only).

## 4. Transitions and transition cues

**Well supported (narrow)**
- Adults with ADHD (n=38 vs 39 controls) were slower on trials that required shifting attentional set. When the attentional set stayed constant, there was no elevated switch cost. That is, the deficit is selective, not global. Source: Selective impairment of attentional set shifting in adults with ADHD, *Behav Brain Funct* 2018, doi:10.1186/s12993-018-0150-y. https://doi.org/10.1186/s12993-018-0150-y

**Unverified**
- Evidence for advance transition warnings and visual timers comes from studies on children with autism (Dettmer et al. 2000 and later work) as reported by secondary sources. I could not open these. **[unverified: secondary]**. Not adult ADHD evidence.

**Folk wisdom:** "Transition paralysis" as a named phenomenon and "a 5-minute warning fixes it" appear only in blogs.

**Design implication:** A lead-in cue before a switch is plausible; cost falls where the mental set changes. Test with users.

## 5. Body doubling

**What exists**
- A 2024 survey study (Eagle, Baltaxe-Admony, Ringland; *ACM TACCESS* 17(3), doi:10.1145/3689648) found neurodivergent people use others' presence (in person, remote, live, recorded, known or stranger) to start, sustain, or finish tasks. It is self-report and defines the practice; it does not measure effectiveness. Sample size reported as 220 in one source and 193 in another, so I did not rely on a number. https://dl.acm.org/doi/full/10.1145/3689648
- A 2025 EEG study (26 participants; reading comprehension with or without a body double; neurotypical, medicated ADHD, unmedicated ADHD) found **no statistically significant difference**; no consistent negative effects and "promising trends" in unmedicated ADHD. *ASSETS '25*, doi:10.1145/3663547.3759743. https://doi.org/10.1145/3663547.3759743 (details from search summary; page returned 403: **[unverified: secondary]**).
- A 2025 VR study reportedly found faster task completion with a virtual body double (arXiv 2509.12153). Preprint; the 27-30% figure came from a secondary summary. https://arxiv.org/pdf/2509.12153

**Verdict:** Popular and self-reported as helpful; **no controlled evidence of benefit**, no RCT. A 2026 roadmap paper says the same: "formal research specifically measuring body doubling's effectiveness remains limited". https://arxiv.org/pdf/2605.07851

**Design implication:** Reasonable as an optional feature; do not claim it improves outcomes. Whether an AI or silent virtual presence provides the same effect is unstudied.

## 6. Spoken nudges vs alarms (the startle claim)

**The claim as stated:** ADHD adults are startled more by alarms, so spoken nudges are better.

**Evidence against the strong form**
- The only adult ADHD startle study I found (20 unmedicated adults with ADHD vs 17 controls, eyeblink EMG) found **no difference in baseline startle magnitude and no prepulse inhibition difference**. Source: Prepulse inhibition of startle in adults with ADHD, *J Psychiatr Res* 2009, PMC2669714. https://pmc.ncbi.nlm.nih.gov/articles/PMC2669714/ Small sample; absence of a lab difference does not rule out subjective distress, but it removes the physiological basis usually cited.
- Blog claims that alarms "spike blood pressure" in ADHD have no primary source.

**Related evidence that is supported**
- Sensory sensitivity, including auditory, is elevated in ADHD by questionnaire (see section 7), so avoiding harsh sudden sounds is defensible on sensory grounds rather than startle physiology.
- General human-factors research: modern practice is to attract attention without undue startle and annoyance; urgency scales with pitch, rate, irregularity. Speech warnings can be responded to faster than tones in pilots, but synthesized voice sometimes had slower reaction times. Sources: Edworthy, Loxley and Dennis, *Human Factors* 1991, https://journals.sagepub.com/doi/10.1177/001872089103300206 ; Human Factors in Auditory Warnings (book), https://www.routledge.com/Human-Factors-in-Auditory-Warnings/Edworthy-Stanton/p/book/9781138316300 (summary via search; not opened). Not ADHD-specific.

**Verdict:** No study compares spoken nudges vs alarms in ADHD. Gentle onset and user-controlled volume/sound are defensible; "spoken beats alarm because of startle" is folk wisdom in its stated form.

## 7. AuDHD: sensory considerations

**Well supported**
- Meta-analysis of 30 studies (5,374 participants; 23 child, 7 adult): ADHD groups scored higher on sensory sensitivity (SMD 1.17), sensory avoiding (1.15), low registration (1.22), and seeking (1.23). High heterogeneity, only 9 studies at low bias risk, questionnaire-based, and adult data is only 7 studies. Jurek et al., *JAACAP* 2025, doi:10.1016/j.jaac.2025.02.019, PMID 40250555. https://doi.org/10.1016/j.jaac.2025.02.019
- Sensory differences are a diagnostic feature of autism (DSM-5-TR). Meta-analytic evidence for autism is extensive but I did not pull a specific paper. Cite DSM-5-TR if needed.
- Co-occurrence: ADHD in autistic people ~38-40% pooled (Rong et al. 2021, *Res Autism Spectr Disord*). https://www.sciencedirect.com/science/article/abs/pii/S1750946721000349 (figures from search summary: **[unverified: secondary]**). Blog figures of 50-70% are higher than this and rely on differing samples.

**Caveats**
- "AuDHD" is a community term, not a diagnosis; DSM-5 has allowed dual diagnosis since 2013.
- The seeking and avoiding pattern coexisting in one person is described in blogs ("too much and not enough at once"); the meta-analysis shows both are elevated in ADHD at group level, not necessarily within one person.

**Design implication:** Offer control over sound, motion, brightness, density, and notification intensity; defaults should be calm. Strong on sensory grounds, independent of the startle claim.

## 8. AuDHD: demand avoidance

**What exists**
- PDA is not in DSM-5-TR or ICD-11 (blog sources say ICD-10 too; I did not verify the classification documents). **[unverified: secondary]**
- A systematic review of 13 child/adolescent PDA studies found all rested on Newson's original descriptions, mostly parent report, few explored alternative explanations, and none asked the individuals themselves; the authors say definition and measurement problems prevent firm conclusions. Kildahl et al., *Autism* 2021, doi:10.1177/13623613211034382. https://doi.org/10.1177/13623613211034382 (abstract read via Europe PMC).
- In 126 community adults, self-reported ADHD traits correlated strongly with PDA scores (r = 0.71) and predicted PDA better than autism; attention deficit, antagonism, and emotional instability accounted for 65% of variance. Self-report, non-clinical sample. Egan, Bull and Trundle, *Res Dev Disabil* 2020, doi:10.1016/j.ridd.2020.103733. https://doi.org/10.1016/j.ridd.2020.103733

**Verdict:** Demand avoidance as an experience is widely reported; PDA as a validated construct is not established, and no study tests app design for it. Claims that "AuDHD PDA is a nervous-system safety response" are theory, not evidence.

**Design implication (inference):** Avoid imperative, guilt-laden, or overdue-count language; let users choose the tone and nudge frequency. This is prudent UX, not evidence-backed treatment.

---

## Sorted: what to lean on vs. treat as hypothesis

**Lean on (well supported)**
- Timing differences in ADHD are real (2022 meta-analysis), though adult and planning-scale evidence is thin.
- Working-memory deficit is robust; skills-based CBT with organising/reminder components works (Safren RCT).
- Preference for immediate over delayed reward (Marx 2021).
- Sensory atypicality is elevated in ADHD and inherent to autism; give sensory controls.

**Treat as hypothesis and validate with Cadence users**
- Visual time/elapsed displays, transition lead-in cues, spoken vs tone nudges, body-double presence, autonomy-preserving phrasing, gamified rewards.

**Folk wisdom, no primary support located**
- ADHD adults have exaggerated startle to alarms (the one lab study says no baseline difference).
- Gamification sustains ADHD engagement (no efficacy evidence for adult ADHD apps; novelty decay stats are from vendor blogs).
- Body doubling improves productivity (n=26 null EEG study; surveys only).
- "Transition paralysis" and "PDA in AuDHD" as validated constructs.

## Gaps

- I could not open ACM DL, JAACAP, or PubMed pages directly (403 or cookie walls); abstracts came from Europe PMC where possible.
- No adult-ADHD trial found for timers, transition warnings, or voice prompts.
- I did not review clinical guidelines beyond NICE NG87 (no CADDRA/APA/AAP pass, and no autism-specific NICE CG142/NG142 check).
