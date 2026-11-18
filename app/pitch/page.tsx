// The submission page: one link for the judges. Video, live app, how it works, how Grok is used, team.
// To add the video: put it at public/pitch/orbit.mp4, or set VIDEO_URL to a YouTube link.
// To add the Grok screenshot: put it at public/pitch/grok.png.
import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { ArrowRight, Brain, CalendarDays, Compass, HeartHandshake, MapPinned, ShieldCheck, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Orbit for Yale: find the room, and the people to walk in with',
  description: 'Yale posts 400+ events a week. Orbit reads them all and lights up the few that move you toward what you are building.',
};

const VIDEO_URL = ''; // e.g. 'https://www.youtube.com/watch?v=XXXX' (leave empty to use public/pitch/orbit.mp4)

const has = (file: string) => fs.existsSync(path.join(process.cwd(), 'public', 'pitch', file));

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

const STEPS = [
  { icon: Compass, title: 'Sign in, Orbit reads your Yale', text: 'Your Yale NetID is your account. Orbit reads your classes, the Yale calendar, Yale Connect, your mailing lists and your friends. No install, no sign-up.' },
  { icon: MapPinned, title: 'Say what you are building toward', text: '"Break into the space industry." Grok reads every event of the week and lights up the six that move you there, on a 3D map of campus, checked against your class schedule.' },
  { icon: Users, title: 'Go, and go together', text: 'Each pick says why it is for you, when to leave, which friends are going, and who to invite, with the message already written.' },
  { icon: HeartHandshake, title: 'And on the hard nights', text: 'Tell Orbit how you feel. It suggests three things nearby tonight, each matched to the research behind it. A nudge, not therapy.' },
];

export default function Pitch() {
  const yt = youtubeId(VIDEO_URL);
  const mp4 = !yt && has('orbit.mp4');
  const grokShot = has('grok.png') ? '/pitch/grok.png' : has('grok.jpg') ? '/pitch/grok.jpg' : null;

  return (
    <div className="h-full overflow-y-auto bg-night text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="whitespace-nowrap text-lg font-semibold">Orbit <span className="font-normal text-ink-dim">for Yale</span></div>
        <a href="/" className="btn-yale inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold">Open the app <ArrowRight size={16} aria-hidden /></a>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <section className="pt-10 pb-12 text-center sm:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">Grokathon Yale 2026</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] sm:text-6xl">Find the room. And the people to walk in with.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-dim">
            Yale posts <span className="font-semibold text-ink">400+ events</span> a week, on sites nobody opens and in emails nobody reads. Orbit reads them all and lights up the few that move you toward what you are building.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/" className="inline-flex h-12 items-center gap-2 rounded-xl bg-gold px-6 font-semibold text-night transition hover:brightness-110">Try the live app <ArrowRight size={18} aria-hidden /></a>
            <a href="#video" className="inline-flex h-12 items-center rounded-xl border border-white/15 px-6 font-semibold transition hover:bg-white/5">Watch the 2-minute video</a>
          </div>
        </section>

        <section id="video" className="scroll-mt-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            {yt ? (
              <div className="relative aspect-video">
                <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube.com/embed/${yt}`} title="Orbit, 2-minute video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            ) : mp4 ? (
              <video className="aspect-video w-full" src="/pitch/orbit.mp4" poster="/pitch/app.jpg" controls playsInline preload="metadata" />
            ) : (
              <a href="/" className="group relative block aspect-[16/10]">
                <img src="/pitch/app.jpg" alt="Orbit: the profile, connected sources, and the question What are you building toward?" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-left text-lg font-semibold">Open the live app <ArrowRight size={18} className="inline" aria-hidden /></span>
              </a>
            )}
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-3xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/15 text-gold"><s.icon size={20} aria-hidden /></span>
                  <span className="text-sm font-semibold text-ink-dim">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-dim">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="flex items-center gap-3 text-3xl font-semibold"><Brain className="text-sky" aria-hidden /> Built with Grok</h2>
            <ul className="mt-6 space-y-4 leading-relaxed text-ink-dim">
              <li><span className="font-semibold text-ink">Grok picks and explains, live.</span> Every request to the plan engine streams through the xAI Grok API: Grok reads the week&apos;s events and the student&apos;s profile, chooses the six that serve the goal, and writes why, who to go with, and the invite.</li>
              <li><span className="font-semibold text-ink">Code checks every line.</span> Grok returns only event ids and reasons. Times, places, class conflicts, walking time, friends and study citations come from our data, so Grok cannot invent an event or a study.</li>
              <li><span className="font-semibold text-ink">Never a blank screen.</span> If the API is slow, Orbit replays Grok&apos;s recorded answer with the same animation.</li>
            </ul>
          </div>
          {grokShot ? (
            <img src={grokShot} alt="Building Orbit with Grok" className="w-full rounded-2xl border border-white/10" />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 font-mono text-sm leading-relaxed text-ink-dim">
              <div className="text-ink">POST https://api.x.ai/v1/chat/completions</div>
              <div className="mt-2">stream: true</div>
              <div>model: grok (fast model, from the environment)</div>
              <div className="mt-2 text-gold">{'{"eventId":"…","score":94,"why":"Builds on MENG 2511 and your rocket team…"}'}</div>
            </div>
          )}
        </section>

        <section className="mt-20">
          <h2 className="flex items-center gap-3 text-3xl font-semibold"><ShieldCheck className="text-sky" aria-hidden /> What is real</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { icon: CalendarDays, title: 'Yale calendar', text: 'Live from events.yale.edu: real events of the week, with their own photos and links.' },
              { icon: Users, title: 'Yale Connect', text: 'Club events from Yale Connect’s public feed, placed on the map.' },
              { icon: MapPinned, title: 'Campus and courses', text: 'Real buildings, real Fall 2026 courses and meeting times.' },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <c.icon size={20} className="text-sky" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-ink-dim">{c.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-dim">Preview: the student&apos;s friends, the mailing lists and part of the events are sample data. Sign-in with NetID, Canvas and mailing lists are the next connectors.</p>
        </section>

        <section className="mt-20 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <h2 className="text-2xl font-semibold">Made at Tsai CITY, in one evening</h2>
          <p className="mt-2 text-ink-dim">Himalaya Girard and Marceau</p>
          <a href="/" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-gold px-6 font-semibold text-night transition hover:brightness-110">Try Orbit now <ArrowRight size={18} aria-hidden /></a>
        </section>
      </main>
    </div>
  );
}
