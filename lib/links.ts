// Outbound links built by code (PLAN.md §9, package D): calendar and message links.
import type { YaleEvent } from './types';

function utcStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** Google Calendar template. End = start + 1 h when `end` is null. Dates stay UTC stamps with a literal slash. */
export function calendarLink(event: YaleEvent): string {
  const start = new Date(event.start);
  const parsedEnd = event.end ? new Date(event.end) : null;
  const end = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : new Date(start.getTime() + 3600000);
  const details = [event.summary, event.host ? `Hosted by ${event.host}` : '', event.sourceUrl].filter(Boolean).join('\n');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    location: event.locationName,
    details,
    ctz: 'America/New_York',
  });
  const dates = `${utcStamp(start)}/${utcStamp(end)}`;
  return `https://calendar.google.com/calendar/render?${q.toString()}&dates=${dates}`;
}

/** Opens Messages with the text ready (no recipient: the student picks the thread). */
export function smsLink(message: string): string {
  return `sms:&body=${encodeURIComponent(message)}`;
}

/** Telegram share sheet with the event link and the message. */
export function telegramLink(url: string, message: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`;
}

/** Page to share for an event: its source page when it has one, else the app itself. */
export function eventLink(event: YaleEvent): string {
  if (event.sourceUrl) return event.sourceUrl;
  return typeof window !== 'undefined' ? window.location.origin : '';
}
