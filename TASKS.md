# Who does what (updated 19:10, New Haven time)

Rule: Marceau owns the interface and everything that needs the xAI key or Vercel. Himalaya owns the data, the map navigation branch, the pitch and the video. Nobody edits the other person's files without saying so here first.

## Marceau

1. **`git pull` now.** `main` has 77 events (35 Yale calendar, 10 Yale Connect, 32 sample), all with real local photos, the profile renamed to Himalaya Girard, and a fix to `scripts/bake-fallback.ts` line 49 that was breaking `next build`.
2. **Bake the fallbacks (needs your key).** All 12 files in `public/data/fallback/` are empty, so if Grok is slow during the demo the code-only answer gives only 1 or 2 picks for some moods (Anxious: 1, Lonely: 2).
   `./node_modules/.bin/tsx scripts/bake-fallback.ts`, check each file has picks, commit, push.
3. **Deploy to Vercel**: `vercel login`, `vercel link`, `vercel env add XAI_API_KEY` (and the two model variables), `vercel --prod`. Put the URL at the top of `PLAN.md` and in the team chat.
4. **Look at Grok's live answers on the new events** (`Find a research lab in AI`, `Meet people outside my major`, Tonight + Stressed): the `why` lines must cite the profile and make sense for real Yale events.
5. **Interface work** (in progress): keep going, but stop 15 minutes before the end.
6. **Merge the map branch when it is ready**: a separate branch `map-navigation` adds Google-Maps-style navigation to the map. Review it, then `git merge origin/map-navigation`, build, deploy.
7. **Do not run `scripts/sample-events.ts`**: it rewrites `events.json` and would delete the Yale and hand-written events. To rebuild the data, run in this order:
   `node scripts/yale-calendar.mjs`, then `node scripts/sample-plus.mjs`, then `node scripts/yale-connect.mjs`.

## Himalaya

1. **Map navigation**: research and a prototype on the `map-navigation` branch (zoom and compass controls, recenter on campus, building search, smoother camera). Review it and hand it to Marceau.
2. **Data**: the event scripts are hers (`scripts/yale-calendar.mjs`, `scripts/sample-plus.mjs`, `scripts/yale-connect.mjs`, `scripts/yale-photo-deny.json`, `scripts/yale-connect-photos.json`).
3. **Video**: full 2-minute script, shot list and onboarding notes in `pitch/VIDEO_SCRIPT.md`. Before and after, in short:
   Before: a screen recording of Yale Connect as it is today, a long list where nothing stands out and the Grokathon is lost in it (blur any student names on screen).
   The story: "Marceau and I found tonight's hackathon by chance. Many talented, passionate students never knew it was happening."
   After: Orbit, type the goal, the map lights up, the Grokathon tonight with Marceau going, then the rest of the week.
4. **Pitch**: rehearse §11 of `PLAN.md` twice. On the science, say: "each pick is matched to a type of activity that research links to that feeling, not a cure".
5. **Rehearsal on the Vercel URL** once it exists: run the full flow three times, then record a backup screen video.

## Done: mood to event matching

`anxious` removed from the `strangers` row (the study was on ordinary commuters, not anxious people), `sad` removed from the `laugh` row (the study measured pain tolerance, not mood), and long build nights (build events over 90 minutes) excluded for Anxious and Lonely. Tests updated, 12/12 pass. Anxious now gets chess and tea (calm) instead of the rocket test stand. **Re-bake the fallbacks after pulling.**

## Clock

- 15 minutes before the end: **code freeze**, nothing pushed after that.
- Before the freeze: the Vercel URL works, the fallbacks are baked, the backup video is recorded.
