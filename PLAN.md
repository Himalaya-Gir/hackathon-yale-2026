# ORBIT — build plan (Grok × Yale hackathon, 4 hours)

Version 3, 2026-11-17 (New Haven time). Project folder: `/Volumes/MarceauCode/Travail-Mac/yale-orbit` (symlink `~/yale-orbit`).
This document is the only brief the build agents get. Each work package (§9) can be read alone together with §3 to §8.
Every AI call in the app goes through the xAI Grok API. No other model provider.
`PLAN.fr.md` in the same folder is an outdated draft. Ignore it.

**The three things that matter most, in order:**
1. **Long-term goals come first.** The app is about what you are building in your life. Everything opens on the goal.
2. **It must look like a production app that works perfectly.** Real photographs everywhere, no placeholder, no broken image, no lorem ipsum, no visible "TODO". It is a mockup with sample data, but it must feel live.
3. **Mood is a secondary mode**: "What should I do tonight?" If you want, you tell Orbit how you feel and it proposes something for tonight.

---

## 0. Status (updated 2026-11-17, 18:35)

**Package 0 is DONE and verified.** Do not redo it. What exists:

- Next.js **16.4.6** app (not 15), Tailwind 4, `pnpm`, dependencies installed. `pnpm build` passes.
- `lib/types.ts`, `lib/science.ts`, `lib/store.ts`, `lib/time.ts` written to the contracts of §7.
- `public/data/profile.json` (Maya, 5 real Fall 2026 courses), `events.json` (12 starter sample events), `friends.json` (8 friends + 4 suggested), `stats.json`. Built by `node scripts/starter.mjs`.
- 12 real photographs in `public/img/events/` with `public/img/CREDITS.md`.
- Stub `app/api/plan/route.ts` honouring §7.3 for both modes. Temporary `components/map/CampusMap.tsx` and `components/ui/Shell.tsx`.
- `.env.local` holds a working `XAI_API_KEY`. Measured on a one-word prompt: `grok-4.20-0309-non-reasoning` 0.6 s, `grok-4.7` 2.0 s.
- Verified in a browser at 1280 × 720: a goal click streams 6 picks with photos and a trajectory; Tonight + Stressed streams 3 picks with valid mechanisms; no console error.
- Run it: `./node_modules/.bin/next dev -p 3417` → http://localhost:3417
- **Not done: Vercel deploy.** The Vercel CLI on this machine is not logged in (`vercel whoami` fails). Marceau must run `vercel login` once; then `vercel link` and `vercel --prod`, and `vercel env add XAI_API_KEY`. Until then the demo runs locally.

**Facts learned while building package 0 (they override anything below that disagrees):**

- **Yale course codes now have 4 digits.** Maya's courses are `CPSC 3230`, `CPSC 3650`, `ECON 2121`, `MENG 2511`, `ASTR 3200`. Wherever this plan says "ECON 121", read "ECON 2121". CourseTable `days_of_week` bitmask: 2 = Mon, 4 = Tue, 8 = Wed, 16 = Thu, 32 = Fri (10 = Mon/Wed, 20 = Tue/Thu).
- **`Pick` in `lib/types.ts` shadows TypeScript's built-in `Pick<T, K>`.** In any file that needs both, import it as `import type { Pick as OrbitPick } from '@/lib/types'` (see `lib/store.ts`).
- **Next 16**: read `node_modules/next/dist/docs/` before using an API you are unsure of. `cacheComponents` was removed from `next.config.ts`. Route handlers export `maxDuration` only (no `runtime` export needed). Server routes import data with `import x from '@/public/data/x.json'`, not `fs`.
- **Tsai CITY coordinates**: use `41.3124, -72.9249` (17 Prospect St). The Yale places endpoint gives a wrong point for it.
- **Photo sources, tested tonight**:
  - Yale places photos are useless: most places return the same generic image.
  - **NASA Image Library works well, no key, public domain**: `https://images-api.nasa.gov/search?q=<words>&media_type=image&year_start=2012` → `collection.items[].links[0].href`, replace `~thumb` with `~large`. Best for rockets, satellites, labs, poster sessions, student teams.
  - Wikimedia Commons works but quality is uneven: API `action=query&generator=search&gsrnamespace=6&prop=imageinfo&iiprop=url|size|extmetadata|mime&iiurlwidth=1280`, descriptive `User-Agent`, 1.2 s between downloads, keep only JPEG, landscape, width ≥ 1600. Licenses are mostly CC BY-SA: credit them in `CREDITS.md`.
  - Unsplash's internal search endpoint returns 401. Do not use it.
  - Pexels: `curl` on the search page is blocked; search it in a real browser, then download with `curl -sL -A "Mozilla/5.0" "https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?auto=compress&w=2400"`.
  - Always build a contact sheet and **look at the photos** before assigning them: search results are often off-topic.
- `scripts/starter.mjs` shows the working pattern for cropping (`sharp`, 1200 × 675, `position: 'attention'`), same-building offsets, friends and credits. Package A1 should extend it rather than start from zero.

---

## 1. What we are building

**Orbit: tell it what you are building toward, and the 3D map of Yale lights up with the six events of your week that move you there, and the friends to go with.**

One-line pitch: *"Yale has hundreds of events a week on a site nobody opens. Orbit already knows you and your goals, reads all of them, and shows the six that build your future, and who to walk in with."*

Why "Orbit": a nod to SpaceX, and the core idea: the people and events that revolve around you.

### Product framing

- **Long-term first.** The main input is the goal ("Break into the space industry"). The main output is "Your week": six events that serve it, each with the reason, the fit with your classes, and a person to go with.
- **Secondary: "Tonight?"** One button. You pick how you feel (8 moods) and Orbit proposes three things for tonight or tomorrow that are research-backed to help with that mood, preferring ones that also serve your goal.
- **It lives inside Yale.** No install, no sign-up: your Yale NetID is your account, so every student is already on it. In the mockup there is no real login: a thin top bar reads "**Orbit · for Yale**" on the left and "Maya Chen · Yale NetID" on the right.
- **It is Yale's internal social network**, reduced to the one loop that matters: friends → event → go together. You see your friends, add friends, see which events they are going to, and say "I'm going".
- **It is a personal agent with no chat window.** It already knows the student (year, college, majors, courses, professors, clubs, new people met this week) and all the events, and merges the two.

### Data strategy: mockup first, real Yale second

- **Baseline (guaranteed): a sample dataset.** About 60 fictional but fully believable events at real Yale places, with real photographs, generated by Grok and checked by code. The whole app must work perfectly on this dataset alone.
- **Then the real connection to Yale** (§4): the official Yale calendar has an open API, tested tonight, that returns 326 events with coordinates. A connector ingests it and real events are merged in, ranked ahead of sample ones. This is easier than it sounds; it is package A2 and it does not block anything.
- One discreet chip in the top bar, "**Preview · sample data**", is the only on-screen mention that data is sample. No "demo" tag on individual cards: it must look like production.

### Scope decisions (rule: one flow, zero bugs)

| Idea | Decision | How it appears |
|---|---|---|
| Long-term goal → events of your week | **CORE, Grok live** | Goal bar; one click relights the whole map |
| Beautiful 3D map | **CORE** | Full screen, night, extruded buildings, light beams topped with photos |
| Production look with real photos | **CORE** | Every card and marker has a real photograph, stored locally |
| Agent that knows everything about the student | **CORE, preloaded profile** | Left panel, no login |
| Internal social network (see friends, add friends, go together) | **CORE (minimal loop)** | Friend avatars stacked on events, Add, I'm going |
| New contacts → persona → invite to an event | **CORE (short version)** | "Go with Sam" + ready-to-send message |
| Never miss or be late | **CORE, computed by code** | Class-conflict check, "leave by 5:40", add to calendar |
| Link to the future / SpaceX | **CORE, cheap** | Default goal is the space industry; tonight's Grokathon is the "You are here" pin |
| "Tonight?" mood mode, research-backed | **SECONDARY, built after the core flow works** | One button, 8 moods, 3 picks with the study behind each |
| Real Yale events | **SECOND STEP (package A2)** | Merged into the sample dataset when the connector passes its check |
| Persona from a real X account (Grok X search), spoken brief | **BONUS 1** | A judge gives their @handle |
| Telegram | **BONUS 2** | Same plan sent by a bot |
| Real Canvas, WhatsApp, LinkedIn, email, NetID login | **ROADMAP (§4.3)** | Said honestly in the pitch |
| A full social network (feed, messaging, profile pages, likes) | **OUT** | Cannot be built in 4 hours |

### The single flow (what the jury sees, 80 seconds)

1. The page opens: 3D night map of Yale slowly rotating. Top bar "Orbit · for Yale". Left panel: Maya Chen, Yale '28, CS + Econ, Pierson; her 5 courses; her friends. In the center, large: **"What are you building toward?"** with the field pre-filled "the space industry" and 4 preset goals. A "You are here" pin on the hackathon venue.
2. Click **"Break into the space industry"**. The map zooms out. The mission log shows "Initializing events…" then real numbers ("312 events · this week · 5 courses · 12 friends").
3. Gold beams rise one by one, each topped with a round photo and a stack of friend avatars. A glowing line links them in time order: her trajectory for the week. On the right, six cards slide in under "Your week".
4. Click the first pick: the camera flies to the building. The card shows **Why you** ("builds on MENG 2511 and your rocket team"), **It fits** ("free after ECON 2121 · leave by 5:40 · 7 min walk"), **Friends** ("Lena + 2 friends are going"), and **Go with** Sam + the invite already written.
5. Click "I'm going": Maya's avatar joins the stack. Click "Invite Sam".
6. Switch the goal to **"Start a company before I graduate"**: the whole map relights differently. Proof nothing is hard-coded.
7. Click **"Tonight?"**, pick **Stressed**: three light-blue beams for tonight, each with "Why it works" and its study.
8. (Bonus) a judge gives their X handle: persona card, voice, suggested event.

---

## 2. Architecture

```
 SOURCES (adapters)            PIPELINE (scripts, run before the demo)             APP (Next.js on Vercel)
 ┌──────────────────┐   ┌──────────────────────────────────────────────┐   ┌────────────────────────────────┐
 │ sample (Grok)    │   │ fetch → normalize → dedupe → ENRICH (Grok:     │   │ public/data/*.json (snapshot)   │
 │ yale-calendar    │──▶│ title, summary, tracks, kinds, building) →     │──▶│ public/img/* (local photos)     │
 │ yaleconnect      │   │ geocode → attach real photo → validate → write │   │                                 │
 │ luma             │   └──────────────────────────────────────────────┘   │ /api/plan  (Grok, streaming)    │
 └──────────────────┘                                                       │   code pre-filter → Grok picks  │
                                                                            │   → code validates and enriches │
                                                                            │   → recorded fallback           │
                                                                            │ client: zustand store           │
                                                                            │   → MapLibre 3D map + panels    │
                                                                            └────────────────────────────────┘
```

- **Source adapters.** Every source implements the same interface and returns the same raw shape. Adding Yale's real systems later means adding an adapter, nothing else changes:
  ```ts
  type RawEvent = { source: string; sourceUrl: string; title: string; start: string; end: string | null;
                    locationRaw: string; descriptionRaw: string; host: string | null;
                    photoRaw: string | null; lat?: number; lng?: number };
  interface EventSourceAdapter { id: string; label: string; fetch(days: number): Promise<RawEvent[]>; }
  ```
- **Pipeline = offline scripts.** They run before the demo and write a static snapshot (`public/data/events.json`). At demo time nothing depends on a Yale server. In production the same pipeline runs hourly (Vercel Cron → `/api/cron/refresh`) and writes to a store (Vercel Blob or Postgres) instead of a file.
- **Grok is used in three places**: (1) offline, to generate the sample dataset and to enrich and tag every event; (2) live, in `/api/plan`, to pick and explain; (3) bonus, X search and voice.
- **The brain is a sandwich: code → Grok → code.** Code pre-filters candidates (time window, class conflicts, mood rules). Grok picks among them and writes the reasons. Code validates every line, drops anything invalid, and adds the facts (times, walking, friends, citations).
- **No database, no auth, no server state.** Friends, "I'm going" and the goal live in the browser store.

**Three principles that guarantee zero bugs:**

1. **Grok chooses, code asserts.** Grok returns only event ids, a score, a lane, a mechanism id, a reason, and a message. Title, time, place, class conflict, walking time, citations, and friends going **always** come from our data and code. An unknown id is dropped. Grok therefore cannot invent an event, a time, or a study.
2. **Every live call has a recorded fallback.** For each of the 4 preset goals and each of the 8 moods, Grok's answer is recorded in `public/data/fallback/`. If Grok gives no first pick within 6 s, or fails, we replay the recording with the same animation. The jury sees no difference. `?demo=1` forces this mode (dead Wi-Fi).
3. **Time is controllable.** `?now=2026-11-17T18:30` freezes "now". All dates are `America/New_York`, stored as ISO with offset, displayed with `Intl.DateTimeFormat(..., {timeZone:'America/New_York'})`. Sample events store a day offset and are re-dated at load time, so the demo is always "this week".

---

## 3. Photos: the production look (mandatory)

**Every image in the app is a real photograph, stored locally in `public/img/`.** No AI-generated image, no illustration, no icon standing in for a photo, no gray placeholder, no hot-linked remote URL (a slow or dead remote image breaks the illusion).

Sources, in this order:
1. **The event's own photo** when it comes from the Yale calendar (Localist events carry a photo field; check its exact name in one response).
2. **A real photo of the building** from the Yale places endpoint (source 2 in §4.1: places carry a photo field) or from Wikimedia Commons (search the building name; download the original file, send a descriptive `User-Agent` such as `campus-events-hackathon/1.0`, do not request resized thumbnails in bulk: they return HTTP 429).
3. **A stock photograph of the activity** from Pexels or Unsplash (free license, no attribution required): people at a talk, a workshop, a run, a concert, a dinner, a lab, a rocket build.

Rules:
- Library: `public/img/events/<slug>.jpg`, at least **60 distinct photos**, each 1200 px wide, cropped 16:9, JPEG quality 80, under 250 KB. Record every origin URL and license in `public/img/CREDITS.md`.
- **Photos must match the event**: a rocketry talk shows a lecture hall or hardware, not a beach. A person reviewing must find each pairing plausible.
- Dark or warm images that sit well on the night map. No watermarks, no visible logos or poster text, no recognizable minors, no photo of a named real person presented as someone else.
- No two picks shown together may share the same photo. No photo is used by more than 2 events in the dataset.
- Every image is verified by script: file exists, decodes, dimensions ≥ 1200 × 675.
- People (friends, contacts) are **not** photos: initials in a colored circle. We never put a real face on an invented person.

---

## 4. Connecting to Yale

### 4.1 What is open today (tested with `curl` on 2026-11-17, no login)

| # | Source | Exact URL | What it gives | Limit |
|---|---|---|---|---|
| 1 | **Official Yale calendar (Localist)** — primary real source | `https://events.yale.edu/api/2/events?pp=100&days=21&page=N` | JSON, 326 events in the default window. `events[].event`: `title`, `description_text`, `localist_url`, `location_name`, `address`, `room_number`, `geo{latitude,longitude}`, `event_instances[].event_instance{start,end,all_day}`, `filters`, `departments`, a photo field. **88% already have coordinates.** CORS open. | Paginate with `page` until empty |
| 2 | **Yale places (Localist)** — building coordinates and photos | `https://events.yale.edu/api/2/places?pp=100&page=1..4` | ~400 places with `geo` | Replaces the official map (map.yale.edu, closed) |
| 3 | **Yale Connect (student clubs)** | `https://yaleconnect.yale.edu/ical/yale/ical_yale.ics` | 6 MB iCal, 5,412 events, ~345 between Nov 17 and Nov 30: `SUMMARY`, `DTSTART` (UTC), `LOCATION`, `URL`, `ORGANIZER;CN=<club>`, `CATEGORIES` | **87% of locations are hidden** ("Sign in to download the location"), no coordinates. Keep only events with a public location; match them against source 2 |
| 4 | **Luma (New Haven tech and startups)** | `https://api.lu.ma/discover/get-paginated-events?latitude=41.31&longitude=-72.92&pagination_limit=50` | JSON, `entries[].event{name,start_at,end_at,url,geo_address_info,coordinate{latitude,longitude}}`. Contains **"Grokathon Yale 2026", Tsai CITY, 41.3124, -72.9249** | Undocumented endpoint, tested once: expect it to fail |
| 5 | **CourseTable (all courses)** | `https://api.coursetable.com/api/catalog/public/202603` | 6 MB JSON, 4,290 courses: `title`, `listings[].course_code`, `course_meetings[]{days_of_week (bitmask), start_time, end_time}`, `course_professors` | No room or building; no CORS (read it from a script) |

Down or closed (do not retry): `calendar.yale.edu` (redirects to source 1), Tsai CITY site (HTML, no feed), OCS (login required), SEAS and CS (404), `map.yale.edu` (key required). Events from those departments are in source 1 under `departments`.

### 4.2 What we connect tonight

- **Package A2**: adapter for source 1, then 4, then 3. Real events are merged into the snapshot and rank ahead of sample events.
- **Package 0**: Maya's 5 courses are real Fall 2026 courses from source 5.
- If A2 passes its check, the pitch may say "live from Yale's own calendar"; `stats.json` holds the true counts per source. If it does not pass, the app ships on sample data and the pitch says "sample data, the Yale connector is next".

### 4.3 Roadmap after the hackathon (for the pitch, not built tonight; none of this was tested)

| Need | Path | What it takes |
|---|---|---|
| Sign in with NetID | Yale CAS (Central Authentication Service) | Registering the app with Yale ITS |
| The student's real courses and deadlines | Canvas personal calendar feed (an iCal URL each student can copy from Canvas) | Nothing from Yale: the student pastes the URL once |
| Club events with their real locations | Yale Connect (CampusGroups) with an authenticated session or an official API key | Agreement with Yale Student Affairs |
| Friends and classmates | Yalies (the student directory built by Y/CS, has an API) + shared courses from Canvas | An API key; opt-in by each student |
| Hourly refresh | Vercel Cron → the same pipeline → Blob or Postgres | A day of work |
| Contacts from X, LinkedIn, WhatsApp, email | OAuth per service; X through Grok's X search | Per-service approval, explicit user consent |

---

## 5. The "Tonight?" mode and its science (secondary)

### What we are allowed to claim

The principle that holds scientifically is not "reverse the emotion" by magic. It is **behavioural activation**: when people feel low they withdraw, and withdrawal maintains the low mood; doing one planned activity, outside your room, with others, breaks the loop. It is a recognized treatment for depression (26 randomized trials in Ekers 2014). "Opposite action" in dialectical behaviour therapy teaches the same move: act opposite to what the emotion urges.

**Mandatory wording** in the UI and pitch: "**research-backed**". Never "scientifically proven", "cures", "will make you happy". Orbit suggests an action for tonight; it is not care. The word "depression" never appears in the UI.

### Moods

`Sad` · `Lonely` · `Stressed` · `Anxious` · `Bored` · `Tired` · `Unmotivated` · `Great`

### Closed mechanism table: `lib/science.ts`

Package 0 writes this table exactly as is, exported as `MECHANISMS: Mechanism[]`. **Grok picks a mechanism `id` from this table. Grok never writes a citation itself.**

| `id` | Line shown in the UI | Citation shown | Activity `kinds` | Moods |
|---|---|---|---|---|
| `activation` | Scheduling one activity you value is the core of a therapy shown to reduce low mood. | Ekers et al., 2014, PLoS ONE | all | sad, unmotivated, tired |
| `move` | Exercise (walking, yoga, dance, strength) is linked to fewer depressive symptoms. | Noetel et al., 2024, BMJ | `move`, `move-together` | sad, stressed, anxious, tired |
| `weak-ties` | On days with more casual chats, people report more happiness and belonging. | Sandstrom & Dunn, 2014, Pers. Soc. Psychol. Bull. | `social-small`, `food-together`, `social-big` | lonely, sad, bored |
| `strangers` | Talking to someone new feels better than we predict. | Epley & Schroeder, 2014, J. Exp. Psychol. Gen. | `social-small`, `social-big` | lonely, anxious |
| `nature` | A 90-minute walk in nature lowered rumination. | Bratman et al., 2015, PNAS | `nature` | stressed, anxious, sad |
| `awe` | In one study, weekly awe walks raised joy and eased daily distress. | Sturm et al., 2022, Emotion | `awe` | stressed, bored, sad |
| `arts` | A WHO review of 3,000+ studies links the arts to better health and well-being. | Fancourt & Finn, 2019, WHO | `create`, `music-live`, `arts-watch` | sad, stressed, bored |
| `sync` | Dancing or singing in sync with others bonds a group fast. | Tarr et al., 2015, Biol. Lett. · Pearce et al., 2015, R. Soc. Open Sci. | `move-together` | lonely, sad |
| `kindness` | Acts of kindness give a small-to-medium boost to your own well-being. | Curry et al., 2018, J. Exp. Soc. Psychol. | `help` | sad, lonely, unmotivated |
| `calm` | Mindfulness programs show moderate evidence of easing anxiety. | Goyal et al., 2014, JAMA Intern. Med. | `calm` | anxious, stressed |
| `laugh` | Laughing together raised pain tolerance, a sign of endorphin release. | Dunbar et al., 2012, Proc. R. Soc. B | `laugh` | sad, stressed |
| `novelty` | People report better mood on days they visit more varied places. | Heller et al., 2020, Nat. Neurosci. | `learn`, `awe`, `create`, `build` | bored, unmotivated |
| `progress` | Small wins you can see are the strongest source of confidence. | Bandura, 1977, Psychol. Rev. | `build`, `learn` | unmotivated, great |

These lines are deliberately modest: several studies are associations, not proof of cause, and the awe study is on older adults. **Do not strengthen them.** Sad films are not in the table: the existing study does not show they lift mood.

Verification status (2026-11-17): all 13 references exist (authors, year, journal). Confirmed by web search tonight: Ekers, Noetel, Sturm, Fancourt & Finn, Goyal, Tarr, Pearce, Heller, Bandura. Confirmed from memory only, re-check if time allows with `curl https://api.crossref.org/works/<DOI>`: Sandstrom & Dunn `10.1177/0146167214529799`, Epley & Schroeder `10.1037/a0037323`, Bratman `10.1073/pnas.1510459112`, Curry `10.1016/j.jesp.2018.02.004`, Dunbar `10.1098/rspb.2011.1373`.

### Matching rules (enforced by code, before and after Grok)

- A tonight pick is valid only if `mechanismId` is in the table, the mood is in that row's "Moods", and at least one of the event's `kinds` is in that row's "Activity kinds" (`all` matches anything). Otherwise the pick is dropped.
- `Tired`: exclude events longer than 2 hours and events starting after 21:00.
- `Anxious`: prefer small groups (`social-small`) over big crowds.
- `Sad` and `Lonely`: never an online event, never a solo activity. Events where friends are going rank first.
- `Great`: nothing to counter. Picks to bring someone along or push the goal, mechanisms `progress`, `kindness`, `weak-ties`.
- For every mood: among valid candidates, one that also serves the long-term goal ranks higher and gets lane `both`.

### Safety line (mandatory)

For `Sad`, `Lonely`, `Anxious`, `Stressed`, below the tonight picks, one discreet fixed line, exact text:
*"Feeling this way most days? Yale Mental Health & Counseling, 24/7: 203-432-0290 · 988 Lifeline (call or text)"*
(Number read on `yalehealth.yale.edu/topic/urgent-mental-health-services-students` on 2026-11-17.) No copy ever mocks or dramatizes a mood.

---

## 6. Grok API and technical choices

### 6.1 Grok API (docs.x.ai read 2026-11-17, do not re-research)

- Base URL `https://api.x.ai/v1`, OpenAI-SDK compatible (`baseURL`). Key in `XAI_API_KEY`, **never in the browser** (no `NEXT_PUBLIC_`).
- Models: `grok-4.7` (best, $2 / $6 per million tokens), `grok-4.20-0309-non-reasoning` (fast candidate, $1.25 / $2.50, **speed not verified**), `grok-build-0.1` (cheapest).
  → **First action of package C: measure** time-to-first-token and total time of both on the real prompt; keep the fastest one that returns correct picks. Model names live in `XAI_MODEL_FAST` and `XAI_MODEL_SMART` in `.env.local`, never hard-coded.
- Structured outputs (`/v1/chat/completions`): `"response_format":{"type":"json_schema","json_schema":{"name":"x","strict":true,"schema":{...}}}`. Limits: arrays ≤ 256 items, objects ≤ 64 properties, strings ≤ 2,048 chars, no empty `enum`, `items` never an array, nullable fields as `["string","null"]`. Test once before relying on it.
- Streaming: SSE. On `chat/completions`, `stream:true` as with OpenAI.
- Server-side search, **only on `/v1/responses`**: `"tools":[{"type":"x_search","allowed_x_handles":["handle"]},{"type":"web_search"}]`. Sources come back in `citations`. Billed per call: never loop on it.
- Voice: `POST /v1/tts` with `{"text":"...","voice_id":"eve","language":"en"}` → mp3. Voices `eve`, `ara`, `rex`. `language` is required.
- Rate limits depend on spend tier; on HTTP 429 wait and retry (1 s, 2 s, 4 s), then use the fallback.
- Not verified: free hackathon credits (ask the organizers); CORS (so everything goes through our server).

### 6.2 Choices (frozen, do not reopen)

| Topic | Choice | Reason |
|---|---|---|
| App | Next.js 16 (see §0), App Router, TypeScript, Tailwind (`create-next-app`), `pnpm` | One app, server routes hide the key, one-command Vercel deploy |
| Map | **MapLibre GL JS + OpenFreeMap tiles** (no key) | No account to create, 3D buildings included (`render_height`) |
| Beams | Extruded round polygons (`fill-extrusion`) + HTML markers | No deck.gl: one less dependency and risk |
| State | `zustand`, one store `lib/store.ts` | Map and panels only talk through it |
| Data | JSON files in `public/data/`, **no database** | Nothing to go down |
| Grok | `openai` SDK pointed at `api.x.ai`, calls **only** in `app/api/*` and `scripts/` | Key stays private |
| Validation | `zod` on everything Grok returns | An invalid line is ignored, never displayed |
| Deploy | Vercel from minute 20, then at every milestone | The demo depends on neither the SSD nor the laptop |
| UI language | English | Yale jury |

### 6.3 Already on this machine

- `~/second-cerveau/Organisation/Événements proposés.md` (164 KB, in French): dozens of real New Haven / Yale / Tsai CITY events already hand-verified for the next 30 days. Useful as inspiration for believable sample events (`grep` by date, do not read it whole).
- `vercel`, `wrangler`, `pnpm`, Node 22 installed. No xAI or Mapbox key on the machine.

---

## 7. Contracts (package 0 writes them; nobody changes them afterwards without telling the lead)

### 7.1 File tree and owners

```
yale-orbit/
  PLAN.md
  .env.local                      # XAI_API_KEY, XAI_MODEL_FAST, XAI_MODEL_SMART   (never committed)
  app/
    layout.tsx, globals.css       # package 0, then D
    page.tsx                      # package 0 (mounts <CampusMap/> + <Shell/>); afterwards only the lead touches it
    api/plan/route.ts             # package C
    api/persona/route.ts          # package E
    api/tts/route.ts              # package E
  components/
    map/CampusMap.tsx, map/*      # package B
    ui/*                          # package D  (Shell, TopBar, ProfilePanel, FriendsRows, GoalBar, TonightPanel, MissionLog, PickCard, WeekRail)
    people/*                      # package E
  lib/
    types.ts                      # package 0  (contract)
    science.ts                    # package 0  (table from §5)
    store.ts                      # package 0  (contract)
    time.ts                       # package 0  (now(), NY formatting, re-dating of sample events)
    schedule.ts                   # package C  (conflicts, walking, leaveBy)
    match.ts                      # package C  (mood ↔ mechanism ↔ kinds rules)
    grok.ts, prompts.ts           # package C
    links.ts                      # package D  (calendar link, message links)
  scripts/
    buildings.ts, photos.ts, sample-events.ts, sample-social.ts, check-data.ts   # package A1
    adapters/*.ts, ingest.ts, enrich.ts                                           # package A2
    bench.ts, bake-fallback.ts                                                    # package C
  public/data/
    events.json                   # package A1 then A2  (package 0 puts 12 hand-written events to start)
    buildings.json                # package A1
    friends.json                  # package A1  (package 0 puts a sample)
    profile.json                  # package 0
    stats.json                    # package A1 then A2  ({total, sources:[{name,count}], bakedAt})
    fallback/week-<goalSlug>.json, fallback/tonight-<mood>.json   # package C
  public/img/events/*.jpg, public/img/CREDITS.md                  # package A1
```

Two packages never write to the same file. Anything needed outside your folders = message the lead.

### 7.2 `lib/types.ts`

```ts
export type Track = 'space'|'ai'|'startup'|'industry'|'research'|'finance'|'policy'|'health'|'climate'|'arts'|'social'|'career';
export type ActivityKind = 'move'|'move-together'|'nature'|'social-small'|'social-big'|'food-together'|'create'|'music-live'|'arts-watch'|'awe'|'learn'|'help'|'calm'|'laugh'|'build';
export type Mood = 'sad'|'lonely'|'stressed'|'anxious'|'bored'|'tired'|'unmotivated'|'great';
export type Mode = 'week'|'tonight';
export type Mechanism = { id: string; line: string; citation: string; kinds: ActivityKind[] | 'all'; moods: Mood[] };

export type YaleEvent = {
  id: string;               // stable: `${source}-${shortHash}`
  title: string;            // cleaned, ≤ 80 chars
  start: string;            // ISO with offset, e.g. 2026-11-19T17:30:00-05:00 (for sample events: computed at load from dayOffset + time)
  end: string | null;
  dayOffset: number | null; // sample events only: 0 = today, 1 = tomorrow, …
  time: string | null;      // sample events only: "17:30"
  locationName: string;     // as displayed, e.g. "Becton Center, Davies Auditorium"
  building: string | null;  // exact name from buildings.json
  lat: number; lng: number; // required: an event without coordinates does not enter events.json
  source: string;           // 'sample' | 'yale-calendar' | 'yaleconnect' | 'luma'
  sourceUrl: string;        // origin page; '' for sample events
  host: string | null;
  summary: string;          // ≤ 140 chars, factual
  tracks: Track[];          // 1 to 3
  kinds: ActivityKind[];    // 1 to 3 (closed vocabulary)
  future: boolean;          // "builds the future": space, AI, energy, hardware, biotech
  free: boolean | null; food: boolean | null;
  rsvpUrl: string | null;
  photoUrl: string;         // always a local path under /img/events/
  sample: boolean;          // true = fictional event
  online: boolean; solo: boolean; durationMin: number | null;
};

export type Meeting = { day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'; start: string; end: string }; // "13:00"
export type Course  = { code: string; title: string; professor: string; building: string; lat: number; lng: number; meetings: Meeting[] };
export type Contact = {       // people met outside Orbit this week ("New this week")
  id: string; name: string; handle: string | null;
  via: 'x'|'linkedin'|'whatsapp'|'email'|'in person'; metWhen: string; metWhere: string | null;
  relation: 'new'|'friend'|'professor'|'mentor';
  persona: string;            // 2 sentences
  interests: string[];
};
export type Friend = {        // Orbit's social graph
  id: string; name: string; initials: string; color: string;   // circle color, from a palette of 6 blues and greys
  classYear: string; college: string;
  status: 'friend'|'suggested';
  reason: string | null;      // for 'suggested': "also in CPSC 3230"
  goingTo: string[];          // event ids from events.json
};
export type Profile = {
  name: string; classYear: string; college: string; majors: string[];
  courses: Course[]; clubs: string[]; interests: string[];
  defaultGoal: string;        // "Break into the space industry"
  home: { name: string; lat: number; lng: number };
  contacts: Contact[];
  connected: { name: string; detail: string }[];   // chips "Canvas · 5 courses"
};

export type GrokPick = {      // what Grok returns, one JSON line per pick
  eventId: string; score: number;            // 0-100
  lane: 'build'|'feel'|'both';               // week mode: always 'build'. tonight mode: 'feel', or 'both' when it also serves the goal
  mechanismId: string | null;                // id from lib/science.ts; required in tonight mode, null in week mode
  why: string;                               // ≤ 110 chars, cites a course, club, contact or the goal
  friendLine: string | null;                 // ≤ 60 chars, e.g. "Lena and Theo are going"
  withContactId: string | null; withWhy: string | null;   // ≤ 80 chars
  invite: string | null;                     // message to send, ≤ 220 chars, student tone
};
export type Pick = GrokPick & {  // added by OUR code
  conflict: { courseCode: string } | null;
  walkMin: number; leaveBy: string;          // ISO
  fitNote: string;                           // "Free after ECON 2121 · leave by 5:40 · 7 min walk"
};
export type PlanEvent =
  | { type: 'status'; text: string }
  | { type: 'pick'; pick: Pick }
  | { type: 'trajectory'; text: string }     // week mode only. One sentence: this week → this semester → after Yale
  | { type: 'done'; source: 'live'|'fallback' }
  | { type: 'error'; message: string };
```

### 7.3 `POST /api/plan`

- Body: `{ mode: Mode, goal: string, mood?: Mood, now?: string }` (`mood` required when `mode` is `tonight`). Response: `application/x-ndjson` stream, one `PlanEvent` per line.
- Top of the route file: `export const runtime = 'nodejs'; export const maxDuration = 60;`.
- Guaranteed order, **week**: `status` lines (the first is always "Initializing events…"), then 6 `pick` with lane `build`, best first, then `trajectory`, then `done`. Window: the next 7 days.
- Guaranteed order, **tonight**: `status` lines, then 3 `pick` with lane `feel` or `both`, then `done`. Window: now to +48 hours, tonight first.
- Never returns an HTTP error to the client when a fallback exists: it streams the fallback with `done.source='fallback'`.

### 7.4 `lib/store.ts` (zustand)

```ts
type Store = {
  events: YaleEvent[]; profile: Profile | null; stats: Stats | null; friends: Friend[];
  goal: string;                            // defaults to profile.defaultGoal
  mode: Mode; mood: Mood | null;
  phase: 'idle'|'thinking'|'done';
  log: string[];
  weekPicks: Pick[]; tonightPicks: Pick[]; // both kept, so going back to the week needs no new call
  trajectory: string | null;
  going: string[];                         // event ids where Maya said "I'm going"
  selectedEventId: string | null; hoveredEventId: string | null;
  load(): Promise<void>;                   // loads the 4 JSON files, re-dates sample events
  runWeek(goal: string): Promise<void>;    // sets goal and mode 'week'; clears weekPicks and tonightPicks; reads the stream; aborts a call in flight
  runTonight(mood: Mood): Promise<void>;   // mode 'tonight'; clears tonightPicks only
  backToWeek(): void;
  addFriend(id: string): void;             // status 'suggested' → 'friend'
  toggleGoing(eventId: string): void;
  friendsGoing(eventId: string): Friend[]; // friends with status 'friend' only
  select(id: string | null): void; hover(id: string | null): void;
};
```

Package 0 delivers `runWeek` and `runTonight` **working** against a stub `/api/plan` that emits sample events 400 ms apart. Packages B, C and D can therefore work in parallel from minute 20.

---

## 8. Art direction and known traps

### 8.1 Art direction (packages B and D)

- **It must look shipped.** Consistent spacing (8 px grid), aligned edges, one type family, real photos, real numbers, finished empty and loading states, hover and pressed states on every button. Nothing that reads as a prototype.
- **Night over campus.** Near-black blue base map, slate-blue building volumes, water and parks barely visible, discreet street names.
- **Two colors with meaning.** **Gold `#FFC857` = your long-term goal** ("Your week", the primary thing). Light blue `#63AAFF` = "Tonight" picks. Yale blue `#00356B` for interface accents. Nothing else is gold.
- Unpicked events stay small pale-blue dots (opacity 0.35): you see the mass nobody can read, and six gold beams coming out of it. Unpicked events where friends are going get a larger dot with a ring.
- Panels: dark glass (`rgba(10,16,28,.72)`, 16 px blur, 1 px border white at 8%), 16 px radius. Geist font (ships with `create-next-app`). Titles 20-28 px, the central question 40 px, body never under 14 px: **must read on a projector at 1280 × 720**.
- Motion: a beam rises in 600 ms (ease-out), a card slides in 300 ms. Camera `flyTo` 1.8 s, pitch 60°. Idle: map rotates 2° per second and stops at first user input.
- Visual, not textual: a photo on every card, track and mood icons from `lucide-react`, big times, short sentences clamped to 2 lines (`line-clamp-2`).
- Layout (1440 × 900 and 1280 × 720): full-screen map; **top** thin bar "Orbit · for Yale" with the chip "Preview · sample data"; **left** 320 px profile and friends; **right** 380 px picks; **center** the goal question when idle, which slides to **bottom center** (smaller) after the first run, with the "Tonight?" button at its right end; **top center** the trajectory sentence when it arrives.
- **Do not impersonate an official Yale service.** Yale blue and the word "Yale" in text: yes. Official logo, shield, "Yale University" signature, or a yale.edu look-alike address: no. The UI says "for Yale", never "by Yale".

### 8.2 Known traps (every package reads this)

1. **MapLibre + Next**: `'use client'` component, imported with `dynamic(() => import(...), { ssr:false })`, `import 'maplibre-gl/dist/maplibre-gl.css'`, container with a real height (`h-screen`). Create the map in a `useEffect` guarded by a `ref` (React strict mode mounts twice) and call `map.remove()` on unmount. Add sources and layers only after `map.on('load')`.
2. **OpenFreeMap style**: check with `curl -sI` that `https://tiles.openfreemap.org/styles/dark` returns 200. If not, load `.../styles/liberty` and recolor in code after `load` (walk `map.getStyle().layers`: background, roads, water). 3D layer: vector source `openmaptiles`, `source-layer: 'building'`, height `['get','render_height']`. If the style already has an extrusion layer, restyle it instead of adding one.
3. **xAI key**: read via `process.env.XAI_API_KEY` in route files and scripts only. On Vercel: `vercel env add`. Never write it in a committed file, a log, or a reply.
4. **Streaming on Vercel**: return a `ReadableStream`, headers `Content-Type: application/x-ndjson` and `Cache-Control: no-store`. On the client, read with `getReader()` and split on `\n`, keeping the remainder of the buffer.
5. **Chatty Grok**: it may wrap JSON in code fences or prose. The reader keeps only lines that start with `{` and pass `zod`. Everything else is silently ignored.
6. **Time zones**: never `new Date(str)` on a date without offset. iCal feeds give sometimes UTC (`Z`), sometimes local with `TZID`: use `node-ical`, which returns correct `Date`s, then format in NY. Build sample-event dates in NY time, not in the machine's or Vercel's time zone (Vercel runs in UTC).
7. **Past events**: real events are frozen at ingestion (ingest 21 days); sample events are re-dated at load. Time-window filters always run at request time with `now()`. A sample event whose time today is already past moves to tomorrow.
8. **Too many points**: at most 400 events in `events.json`. Beyond that keep the soonest.
9. **People**: friends and contacts are **invented** (fictional names, initials as avatars). No real private person in the data. Sample events may be hosted by real Yale organizations but **never name a real person** as speaker or guest, and never claim a real company is officially present. The "@handle" bonus is used only with the account of someone who gives it themselves.
10. **Pitch honesty**: the screen says "Preview · sample data". The pitch says what is real (the map, the buildings, the courses, the Yale calendar connector if A2 passed, Grok's live reasoning, the studies) and what is sample (the events if A2 did not pass, Maya, her friends, the NetID sign-in).
11. **Do not build**: login, settings page, database, marketing landing page, light mode, mobile layout, feed, messaging, profile pages, likes.
12. **Disk**: never `npm ci`. `pnpm install` once, by package 0. If the SSD freezes, do not stop: the Vercel deployment remains the demo.
13. **A package is done when its check (§9) passes**, with a screenshot or command output as proof, not when the code is written.
14. **Tone**: a tonight pick speaks to the person with tact and never names the mood heavily (forbidden: "since you are sad").
15. **Images**: only local files under `/img/events/`. Use `next/image` or plain `<img>` with fixed aspect ratio and `object-cover`; set width and height so nothing jumps while loading. A missing image is a blocking defect.

---

## 9. Work packages

Order: **package 0 alone (20 min)**, then **A1, B, C, D in parallel (55 min)**, integration by the lead on the sample dataset, then **A2** (real Yale) and **T** (Tonight mode end to end), then **E, F**, and **Q** at the end. Use the strongest model for package C and the lead.

### Package 0 — Foundation and contracts (one agent, 20 min, blocking)

1. `pnpm create next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-pnpm` (the folder already contains `PLAN.md` and `PLAN.fr.md`: if the tool refuses, create in `tmp-app/` and move the contents up).
2. `pnpm add maplibre-gl zustand zod openai lucide-react node-ical @turf/circle @turf/helpers` ; `pnpm add -D tsx sharp`.
3. Write `lib/types.ts` (§7.2 verbatim), `lib/science.ts` (§5 table verbatim), `lib/store.ts` (§7.4), `lib/time.ts` (`now()` reads `?now=` else real time; `fmtDay`, `fmtTime` in NY; "Tonight" / "Tomorrow" / weekday labels; `redate(event, now)` for sample events).
4. Write `public/data/profile.json`: **Maya Chen, Yale '28, Pierson College, Computer Science + Economics**, `defaultGoal: "Break into the space industry"`. 5 **real Fall 2026 courses** from CourseTable (§4.1 source 5: download the catalog to `scripts/.cache/`, search by `course_code`; aim for CPSC 323, CPSC 365, ECON 121, one MENG course, one ASTR course; take another course of the same subject if a code is not offered this season). Title, professor and meeting times come from the catalog (`days_of_week` is a bitmask: check its direction on a known course). The building is not in the catalog: assign a plausible one (CPSC → Arthur K. Watson Hall, ECON → a central lecture hall, MENG → Becton), coordinates from source 2. Clubs: Yale Undergraduate Aerospace Association, Y/CS, Yale Entrepreneurial Society. 3 invented `new` contacts (one via X into propulsion, one via LinkedIn in venture capital, one via WhatsApp met at Tsai CITY) + 1 professor + 1 friend. `connected`: Canvas, Yale Connect, Calendar, X, LinkedIn, WhatsApp, each with a numeric `detail`.
5. Write 12 starter events in `public/data/events.json` (`sample:true`, `dayOffset` 0 to 6, real buildings, approximate coordinates around 41.3115, -72.9265, all fields filled, varied `tracks` and `kinds`; for `photoUrl` download 12 real photographs now, following §3), a starter `friends.json` (8 friends + 4 suggested, `goingTo` pointing to the starter events), and `stats.json`. Package A1 will replace all three.
6. Stub route `app/api/plan/route.ts`: week → 3 `status`, 6 `pick`, 1 `trajectory`, `done`; tonight → 2 `status`, 3 `pick` with valid `mechanismId`s, `done`; 400 ms apart.
7. `app/page.tsx`: calls `load()`, renders `<CampusMap/>` (temporary: a dark full-screen `div`) and `<Shell/>` (temporary: the 4 goal buttons, a Tonight button with 8 moods, and the raw list of picks).
8. `git init`, first commit, `.gitignore` with `.env.local`. `vercel link` then `vercel --prod`; write the URL at the top of this file.

**Check**: `pnpm build` passes. Locally and on the Vercel URL, clicking a goal shows 6 picks arriving one after another; clicking Tonight + a mood shows 3.

### Package A1 — The sample world: buildings, real photos, sample events, friends (`scripts/`, `public/data/`, `public/img/`)

Goal: a dataset on which the app looks and behaves like production, with no dependency on any Yale server at demo time.

1. `scripts/buildings.ts`: the 4 pages of source 2 → `buildings.json`: `[{name, lat, lng, addr, photoRaw}]`. Optional complement if a building is missing, one Overpass request (`https://overpass-api.de/api/interpreter`):
   `[out:json][timeout:25];(way["building"]["name"](41.300,-72.940,41.326,-72.912);relation["building"]["name"](41.300,-72.940,41.326,-72.912););out center tags;`
   Add an alias table by hand: SSS, LC, WLH, HQ, YSB, AKW, DL, KT (Kline Tower), SOM/Evans Hall, CEID (in Becton), Tsai CITY (17 Prospect St), Schwarzman Center/Commons, Bass, Sterling (SML), Watson Center (WTS), Luce Hall, Loria, Kroon, Leitner Observatory, Payne Whitney Gym, East Rock, the 14 residential colleges.
2. `scripts/sample-events.ts`: Grok (smart model, structured output) generates **60 fictional events**, in 4 calls of 15, given: Maya's profile, the 4 preset goals, the list of real building names, the closed vocabularies, and these rules:
   - Believable Yale events a student would recognize: talks, build nights, founder dinners, lab open houses, career treks, club meetings, concerts, runs, volunteering, improv, stargazing. Specific titles ("Propulsion test-stand build night", not "Engineering event").
   - Hosts are real Yale organization types or names (YUAA, Tsai CITY, Y/CS, Yale Entrepreneurial Society, Wright Lab, residential colleges). **No real person named. No claim that a real company is officially present** ("a propulsion engineer from the launch industry", not a named company's delegation).
   - Coverage, enforced by code after generation (regenerate what is missing): **each of the 4 preset goals has at least 12 relevant events in the next 7 days**; each of the 8 moods has at least 6 matching events in the next 48 hours (§5 rules); at least 15 `future:true`; day offsets spread over 0 to 9; realistic hours (noon talks, 4 to 9 pm events, weekend mornings for runs); no event during a time when it would be absurd.
   - Each event gets `building` = an exact name from `buildings.json`; code fills `lat`, `lng` from it and offsets events in the same building by 8 m around a circle.
   Add by hand the fixed event `grokathon-yale-2026`: "Grokathon Yale 2026", Tsai CITY, `lat 41.3124`, `lng -72.9249`, `dayOffset 0`, `tracks:['ai','space']`, `kinds:['build']`, `future:true`. It is the "You are here" pin.
3. `scripts/photos.ts` + manual curation, following §3: build `public/img/events/` (≥ 60 real photographs) and assign one to each event so the pairing is plausible. Resize and crop with `sharp`. Write `CREDITS.md`.
4. `scripts/sample-social.ts` (runs after events): 12 invented friends (`status:'friend'`) each going to 2 to 4 events in the next 7 days, spread so that **every preset goal has at least 3 candidate events with friends going, and every mood at least 2 within 48 hours**; 6 suggested people (`status:'suggested'`, each with a `reason` tied to the profile: "also in CPSC 3230", "Pierson", "YUAA") each going to 1 or 2 events.
5. Write `events.json`, `friends.json`, `stats.json`.

**Check**: `pnpm tsx scripts/check-data.ts` asserts: ≥ 60 events; all with `lat` between 41.29 and 41.34 and `lng` between -72.95 and -72.90; no duplicate `id`; `grokathon-yale-2026` present; every `photoUrl` is a local file that exists, decodes, and is ≥ 1200 × 675; no photo used by more than 2 events; the coverage rules of step 2 and step 4 hold after re-dating with today's date; every `goingTo` id exists; no title contains a person's full name from a deny-list of obvious public figures. Then a visual pass: open a contact sheet of all event photos with their titles and confirm each pairing is plausible.

### Package B — The map (`components/map/`)

1. `CampusMap.tsx` per trap 1. Center `[-72.9265, 41.3115]`, zoom 15.6, pitch 60, bearing -20, `antialias:true`. Style per trap 2 and §8.1.
2. Layer `all-events`: pale-blue circles for all events in the next 7 days; larger dot with a ring where `friendsGoing(id).length > 0`.
3. Layer `beams`: for each pick of the current mode, a disc of 9 m radius (`@turf/circle`, 24 steps), extruded. Height = `40 + score × 1.6` meters. **Gold for week picks, light blue for tonight picks** (lane `both`: light blue with a gold ground halo); opacity 0.85. Animate from 0 to full height in 600 ms (`requestAnimationFrame` updating the source data). A blurred ground halo under each beam. In tonight mode, the week's gold beams stay at 30% opacity and half height.
4. HTML marker on top of each beam: **44 px round photo** (`photoUrl`, border in the beam color), rank and short time ("Thu 5:30", "Tonight 7:30"), and under it a stack of up to 3 friend circles (+N). Clickable → `select(id)`.
5. **Trajectory line** (week mode): a glowing gold line linking the six picks in chronological order, drawn progressively as picks arrive.
6. Store reactions: `phase==='thinking'` → zoom out to 14.6 in 900 ms before beams rise; new pick → its beam rises; `selectedEventId` → `flyTo` (zoom 17.2, pitch 65, 1.8 s) and the selected beam becomes brighter and wider; `hoveredEventId` → brighter beam; new `runWeek` → all beams drop in 250 ms; `going` or `friends` change → friend stacks update.
7. Route line: dashed line from the last class before the event (or `profile.home`) to the selected event (straight line is enough).
8. "You are here" pin (white pulse) on `grokathon-yale-2026`, or `profile.home` if missing.
9. Slow idle rotation, stopped at first `mousedown` / `wheel` / `touchstart`.

**Check**: with the stub route, a 1280 × 720 screenshot showing extruded buildings, 6 gold beams with photos and friend stacks, the trajectory line, the blue dots. No console errors. Clicking a marker flies the camera. Clicking two goals in a row leaves no ghost beam. Tonight mode shows 3 light-blue beams over dimmed gold ones.

#### Package B2 — Map navigation (branch `map-navigation`, file `components/map/navigation.ts`)

Goal: the 3D campus should be as easy to move around as Google Maps, using MapLibre's own controls rather than new code.

**Added**
- MapLibre `NavigationControl`: zoom in and out, compass with tilt shown (a click on the compass resets north and tilt).
- "Back to campus" button: flies back to `HOME_VIEW` (same padding as the pick cards).
- "Find a building": a magnifier opens a field that searches `public/data/buildings.json` by name or address (arrows and Enter, or the mouse). It flies to the building (zoom 17.4, pitch 60) and drops a white labelled pin.
- Scale in feet, and the title and time of an unpicked event when the mouse is over its blue dot (MapLibre `Popup`).
- Keyboard, right-drag rotate and tilt, and pinch rotate are enabled explicitly (they are MapLibre defaults).

**Placement rule**: the controls sit at the right edge of the free strip between the panels: `right: 412px` (16 + 380 + 16), `top: 196px` (under the trajectory banner). If the panels or the banner move, update `.maplibregl-ctrl-top-right` in `NAV_CSS`.

**Considered and rejected**
- Switching library (deck.gl, Mapbox, Google Maps JS with photorealistic 3D tiles): Mapbox and Google need a key and billing, and the whole scene would have to be rewritten; deck.gl adds a dependency without helping navigation (§6.2 stays).
- MapLibre terrain: New Haven is flat, no visible gain.
- Another OpenFreeMap style (liberty, positron, bright): the recolored `dark` style already fits the night art direction; the 3D buildings come from the same `openmaptiles` source.
- `GeolocateControl`: indoor demo with sample data, not useful.
- Cooperative gestures: full-screen app, they would only get in the way.

**Known limits**
- On the welcome screen the controls are almost hidden under the dark gradient behind the goal question; they show once a goal runs.
- They can cover a marker that lands at the far right of the free strip.
- Clicking a blue dot does nothing (only the hover label).
- Search covers buildings only, not events or courses.
- Below about 900 px wide the controls go under the right panel.

**Checked**: `next build` passes; at 1280 × 720 no console error, beams, markers and trajectory unchanged, a pick card click still flies the camera, search and back to campus work. Not checked: trackpad pinch and keyboard by hand, other screen sizes, Vercel, and the merge with the latest interface on `main`.

**Merge**: `git fetch origin && git merge origin/map-navigation`, then build and deploy.

### Package C — The brain (`app/api/plan/`, `lib/grok.ts`, `lib/prompts.ts`, `lib/schedule.ts`, `lib/match.ts`)

Build **week mode first**, end to end with fallback, before touching tonight mode.

1. **Measure first** (§6.1): `scripts/bench.ts`, same prompt on `grok-4.7` and `grok-4.20-0309-non-reasoning`, 3 runs each, time-to-first-token and total time. Target: first pick on screen in under 3 s, everything in under 12 s. Write the winner in `.env.local`.
2. `lib/schedule.ts`, **pure code, tested**: `candidates(events, now, hours)` (168 for week, 48 for tonight; in tonight mode widen to 96 if fewer than 30 remain); `conflict(event, courses)`; `walkMin(a, b)` = straight-line distance × 1.3 ÷ 80 m/min, rounded up; `leaveBy` = start − walk − 5 min; `fitNote` in short English. Starting point = the building of the last class ending within 90 minutes before the event, else `profile.home`.
3. `lib/match.ts`, **pure code, tested**: `allowedMechanisms(event, mood): string[]` from the §5 table and matching rules; `validPick(pick, event, mode, mood): boolean`.
4. Pre-selection before Grok: drop events that conflict with a class; in tonight mode apply the mood exclusions and keep only events with at least one allowed mechanism; if more than 150 remain, keep the soonest. Real events are listed before sample ones.
5. Prompts (`lib/prompts.ts`). System: role ("you are Orbit's engine, not a chat assistant"), full profile as JSON, rules. User: goal (+ mood in tonight mode) + compact list, one line per event:
   `id | day time | title | place | tracks | kinds | friends going (first names) | summary` (tonight mode adds `| allowed mechanisms`).
   **Week rules:**
   - Return **exactly 6 JSON lines** in `GrokPick` format, lane `build`, `mechanismId` null, best first, then one last line `{"trajectory":"..."}` (≤ 160 chars: what this week sets up for the semester and after Yale). No other text.
   - `eventId` only from the list.
   - `why` cites **one precise element of the profile** (course code, club, contact) and ties it to the goal. Forbidden: "great opportunity", "aligns with your interests".
   - The six together read as a path toward the goal: mix learning, building, and meeting people; at most 2 events on the same day; at least 1 unexpected pick outside the student's major that still serves the goal; at least 2 `future` events when they exist.
   - `friendLine` names only friends listed on that event's line, or is `null`.
   - `withContactId`: the person for whom this event is a good reason to meet again, `new` contacts first. The same contact at most twice. `invite`: short, natural, first person, names the event, the day and the time, no emoji runs, no sales tone. `null` if nobody fits.
   **Tonight rules** (in addition): return **exactly 3 lines**, lane `feel`, or `both` when the event also serves the goal (prefer those); `mechanismId` only from that event's "allowed mechanisms"; 3 different mechanisms; tact (trap 14); for `lonely` and `sad`, events with friends going first and every pick has a `withContactId`. No trajectory line.
6. Route: `chat/completions` stream, split by lines, `zod`, unknown id = line dropped, `validPick` false = line dropped, `friendLine` checked against `friendsGoing` (if it names someone not going, rewrite it in code from the real list), then **added by code**: `conflict`, `walkMin`, `leaveBy`, `fitNote` → `PlanEvent pick`. `status` lines carry real numbers from `stats.json` and the profile.
7. Fallbacks: 6 s timer with no first pick, or an error, or fewer than 4 valid picks (week) / 2 (tonight) at the end → read the recorded file and emit it 350 ms apart with `done.source='fallback'`. Week: `fallback/week-<goalSlug>.json`; a free-text goal uses the preset with the most words in common, else `space`. Tonight: `fallback/tonight-<mood>.json`.
8. `scripts/bake-fallback.ts`: calls the real route for the 4 preset goals and for the 8 moods (default goal) and records the answers. Recorded picks store event ids only, so they stay valid when sample events are re-dated. **Re-run every time `events.json` or `friends.json` changes.**
   The 4 preset goals: `Break into the space industry` (slug `space`) · `Start a company before I graduate` (`startup`) · `Find a research lab in AI` (`research`) · `Meet people outside my major` (`people`).

**Check**: (a) tests of `schedule.ts` and `match.ts` pass; (b) `curl -N` on the route for each of the 4 goals: 6 picks, every `eventId` exists, no class conflict, `why` cites a profile element, a trajectory line; (c) two different goals give at least 4 different picks; (d) for each of the 8 moods: 3 picks, each with a `mechanismId` valid for that mood and event; (e) with `XAI_API_KEY=wrong`, both modes still answer through the fallback; (f) measured times written here.

### Package D — The interface (`components/ui/`, `lib/links.ts`, `app/globals.css`)

1. `Shell`: the zones of §8.1 over the map (`pointer-events-none` on the container, `auto` on panels). `TopBar`: "Orbit · for Yale" left; chip "Preview · sample data"; "Maya Chen · Yale NetID" right.
2. `ProfilePanel`: name, class, college, majors; `connected` chips; the 5 courses (code, professor, next meeting).
3. `FriendsRows` (in the left panel): **"Friends"** (initial circles, hover shows name and where they are going next); **"New this week"** (the 3 `new` contacts: initials, name, "via X · 2 days ago", one persona line); **"People you may know"** (6 suggestions with their `reason` and an **Add** button → `addFriend(id)`, the person moves into "Friends").
4. `GoalBar` (**the primary control**): when idle, **centered on screen**, "What are you building toward?" at 40 px, a large text field pre-filled with the default goal, the 4 preset goals as chips, a mic button (`webkitSpeechRecognition` if it exists, otherwise hidden); Enter or a chip → `runWeek(goal)`. After the first run the bar slides to the bottom center, smaller, showing "Building toward: [goal]" (click to edit) and, at its right end, the **"Tonight?"** button. While `thinking`: locked.
5. `TonightPanel` (secondary): opens from the "Tonight?" button as a small popover above the bar: "What should I do tonight? I feel…" and the 8 moods (icon + word). Click a mood → `runTonight(mood)`. A "Back to my week" link → `backToWeek()`.
6. `MissionLog`: while `thinking`, `status` lines scroll under the bar (3 lines max, the last one bright).
7. `WeekRail` + `PickCard`. Week mode: heading "Your week" with the goal under it. Tonight mode: heading "Tonight" with "Back to my week". Each pick slides in. Closed: 120 px photo banner (`object-cover`, dark gradient at the bottom for the title), day and time large, title, place, track icon, "Future" chip if `future`, friend stack + "Lena + 2 friends are going". Open (= selected): **Why you** (`why`), **Why it works** (mechanism line + citation in small italics, tonight picks only), **It fits** (`fitNote`), **Go with** (initials, name, `withWhy`), buttons **I'm going** (or **Join them** when friends are going) → `toggleGoing`, **Invite**, **Add to calendar**, "source" link when `sourceUrl` is not empty. Hover → `hover(id)`, click → `select(id)`.
8. In tonight mode, under the list, for `sad`, `lonely`, `anxious`, `stressed`: the safety line from §5, exact text.
9. Invite: a small dialog with the editable message and three actions: Copy, iMessage (`sms:&body=`), Telegram (`https://t.me/share/url?url=<link>&text=<message>`). After a click: "Sent to Sam ✓" on the card.
10. Add to calendar: Google Calendar link `https://calendar.google.com/calendar/render?action=TEMPLATE&text=..&dates=<UTC>/<UTC>&location=..&details=..` (dates as `YYYYMMDDTHHmmssZ`, end = start + 1 h when `end` is null).
11. Trajectory banner at top center when `trajectory` arrives.
12. Idle right column: "312 events this week. Tell Orbit where you're going." with the real number.

**Check**: screenshots at 1280 × 720 and 1440 × 900 of the states idle, thinking, week done, card open, invite dialog, after Add friend, after I'm going, Tonight popover, tonight done. No text cut mid-word, no overflow, nothing under 14 px, no missing image, every button has hover and pressed states. The calendar link opens the right day and time (verify one event by hand).

### Integration (the lead, 15 min)

Replace the temporaries in `page.tsx`, wire the real route, re-run `bake-fallback`, `pnpm build`, `vercel --prod`. Run the §1 flow **three times in a row** on the Vercel URL, then once with `?demo=1` and Wi-Fi off (tiles already loaded stay in the browser cache: load the page before cutting).

### Package A2 — The real Yale connector (after integration is green; `scripts/adapters/`, `scripts/ingest.ts`, `scripts/enrich.ts`)

1. `scripts/adapters/yale-calendar.ts` (source 1), implementing `EventSourceAdapter` (§2). An event with several instances = one entry per upcoming instance (max 3); drop `all_day` events and permanent exhibitions (duration over 8 hours). Then `luma.ts` (source 4), then `yaleconnect.ts` (source 3, public locations only, `node-ical`). `try/catch` per adapter: a dead source stops nothing. Log the count per source.
2. `scripts/ingest.ts`: run adapters, deduplicate (same normalized title + same day).
3. `scripts/enrich.ts`: Grok in batches of 25 events, structured output, **at most 4 calls in parallel**, results cached by `id` in `scripts/.cache/enrich.json`. For each event Grok returns: cleaned `title`, `summary` ≤ 140, `tracks`, `kinds`, `future`, `free`, `food`, `online`, `solo`, `durationMin`, and `building` = **an exact name from the building list given in the prompt, or `null`**. Prompt rule: "invent nothing; if the information is not in the text, return `null`".
4. Coordinates: the source's own `geo` when present; else `building` → `buildings.json`; else, if `locationRaw` contains a street address, Nominatim (`https://nominatim.openstreetmap.org/search?format=json&q=<address>, New Haven, CT`), 1 request per second, header `User-Agent: campus-events-hackathon`. Still nothing: drop the event.
5. Photos: download the event's own photo into `public/img/events/` (resize with `sharp`); if it has none or it is a poster full of text, use the building photo or a matching stock photograph per §3. Never leave a remote URL.
6. Merge with the sample dataset into `events.json` (`sample:false` for real ones), keep at most 400, update `stats.json`, re-run `sample-social.ts` so friends also go to real events, re-run `bake-fallback`.

**Time limit: 30 minutes.** If the check does not pass by then, revert `events.json` to the A1 version and stop: the app ships on sample data.

**Check**: `check-data.ts` still passes on the merged file; ≥ 150 real events; all real `start` in the future; open 5 random `sourceUrl`s and verify title and date match; the §1 flow still works on the deployed URL and at least 2 of the 6 week picks for the default goal are real events.

### Package T — Tonight mode end to end (after integration is green)

The pieces are already specified in packages B, C and D. This package is the pass that makes the secondary mode work on the deployed URL: all 8 moods, safety line, back to week, fallback. **Check**: on the Vercel URL, each mood returns 3 light-blue picks with a "Why it works" line that matches the §5 table character for character.

### Package E — Bonus 1: the person (only if A2 and T are green)

1. `POST /api/persona {handle}`: `/v1/responses`, strong model, tool `x_search` restricted to that account (`allowed_x_handles:[handle]`), output `{name, persona (2 sentences), interests[3-5], opener (one ice-breaker sentence), spoken (≤ 35 words, to be read aloud)}`. Then, in code, call the same picking engine to find **the** best event shared by that person and Maya. 25 s timer. Three pre-recorded cards for the demo.
2. `POST /api/tts {text}` → `/v1/tts` (`voice_id:'eve'`, `language:'en'`) → mp3 returned as is. Fallback: the browser's `speechSynthesis`.
3. `components/people/AddPerson.tsx`: in "New this week", a field "+ @handle". Result: a card opens, the voice reads `spoken`, the suggested event lights up on the map with the invite ready.

**Check**: a well-known public account returns an accurate card in under 25 s with `citations`; a non-existent account returns a clean message; audio plays after a click (browsers block audio without a user gesture).

### Package F — Bonus 2: Telegram (only if E is green and 40 minutes remain)

A bot (`node`, long polling, token created by Marceau with BotFather): `/start` → Maya's week in 6 lines with the map link; any other message = a new goal → same `/api/plan` route. Otherwise one sentence in the pitch ("the same brain answers on Telegram") **only if it is true**.

### Package Q — Fresh review and rehearsal (always, 20 minutes before the end)

A fresh agent with no context opens the Vercel URL in a browser and follows the §1 flow, noting every defect with a screenshot: anything that looks unfinished, a missing or mismatched photo, cut text, wrong time, past event, beam in the wrong place, dead button, console error, a citation that differs from the §5 table. Fix, then **freeze the code**: no change in the last 15 minutes.
Record a screen video of the full flow (backup if everything fails).

---

## 10. Clock

| Time | Milestone | If late |
|---|---|---|
| +20 min | Package 0 live on Vercel | Nothing starts before it |
| +50 min | A1: 60 sample events with photos · B: 3D map and beams · C: week mode returns 6 picks · D: panels | Fewer sample events (40), same photo rules |
| +75 min | Packages A1, B, C, D checked | Cut: route line, mic, "People you may know" |
| +90 min | **Full week flow live on sample data** (vital milestone) | Everyone helps integration, nothing else |
| +120 min | A2 (real Yale) and T (Tonight) | A2 reverts to sample data at its 30-minute limit |
| +150 min | Bonus 1 (person + voice) | Drop it without regret |
| 30 min before the end | Package Q, backup video | |
| 15 min before the end | **Code freeze**, rehearse the pitch twice | |

Cut order when time runs short: Telegram → voice → X persona → real Yale connector → "People you may know" → mic → route line → Tonight mode → "I'm going".
**Never cut**: the goal entry, the 3D map, gold beams with real photos, "Why you" tied to the profile, friend avatars on events, "Go with", the recorded fallback, the production finish.

---

## 11. The pitch (2 minutes, in English)

**Hook (20 s).** "Raise your hand if you found out about a great Yale event the day after it happened. There are hundreds a week, on a site nobody opens. So we miss the talk that would have changed our path, and the person we should have met there."

**Live demo (80 s).** Open the URL (already loaded). "This is Maya. No install, no sign-up: Orbit lives inside Yale, her NetID is her account, so everyone is already on it. It knows her classes, her clubs, her friends. It asks one thing: what are you building toward?" Click **Break into the space industry**. "Grok just read every event of the week, checked them against her schedule, and drew her trajectory: six events." Click the first. "Why her: it builds on her rocket team. It fits after Econ, leave by 5:40. Lena and two friends are already going. And someone to bring: Sam, who she met this week. The invite is written." Click I'm going, click Invite. Switch to **Start a company**. "Different goal, different campus." Click **Tonight?**, **Stressed**. "And if tonight is a rough one: three things nearby, each with the research behind it." (Bonus: "Give me your X handle.")

**Impact (20 s).** "Tonight is Yale's first night with SpaceX and xAI, and half the campus didn't know it was happening. With Orbit, the students who want to build the future find the room, and the people to walk in with."

Say exactly, about the science: "research-backed nudges, not therapy."
Be truthful about data: if package A2 passed, "the events come live from Yale's own calendar, plus sample ones"; if not, "this is a working preview on sample data; Yale's calendar has an open API and the connector is next". Maya, her friends and the NetID sign-in are sample in both cases.

---

## 12. What only Marceau can do (start now)

1. **xAI key**: create it on console.x.ai (ask the organizers for hackathon credits) and write it in `~/yale-orbit/.env.local` as `XAI_API_KEY=...`. Without it, sample-event generation, tagging and the brain all stop.
2. **Hackathon end time**: to set the clock in §10 (the venue is found: Tsai CITY).
3. (Bonus 2) a Telegram bot token from BotFather.
