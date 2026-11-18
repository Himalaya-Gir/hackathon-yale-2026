// Shared contract (PLAN.md §2). Adapters return this shape and nothing else.

export type RawEvent = {
  source: string;
  sourceUrl: string;
  title: string;
  start: string; // ISO with offset
  end: string | null;
  locationRaw: string;
  descriptionRaw: string;
  host: string | null;
  photoRaw: string | null;
  lat?: number;
  lng?: number;
};

export interface EventSourceAdapter {
  id: string;
  label: string;
  fetch(days: number): Promise<RawEvent[]>;
}
