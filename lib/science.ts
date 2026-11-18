// Closed mechanism table (PLAN.md §5). Grok picks an id from this table; it never writes a citation itself.
// Wording is deliberately modest. Do not strengthen it.
import type { Mechanism } from './types';

export const MECHANISMS: Mechanism[] = [
  { id: 'activation', line: 'Scheduling one activity you value is the core of a therapy shown to reduce low mood.', citation: 'Ekers et al., 2014, PLoS ONE', kinds: 'all', moods: ['sad', 'unmotivated', 'tired'] },
  { id: 'move', line: 'Exercise (walking, yoga, dance, strength) is linked to fewer depressive symptoms.', citation: 'Noetel et al., 2024, BMJ', kinds: ['move', 'move-together'], moods: ['sad', 'stressed', 'anxious', 'tired'] },
  { id: 'weak-ties', line: 'On days with more casual chats, people report more happiness and belonging.', citation: 'Sandstrom & Dunn, 2014, Pers. Soc. Psychol. Bull.', kinds: ['social-small', 'food-together', 'social-big'], moods: ['lonely', 'sad', 'bored'] },
  { id: 'strangers', line: 'Talking to someone new feels better than we predict.', citation: 'Epley & Schroeder, 2014, J. Exp. Psychol. Gen.', kinds: ['social-small', 'social-big'], moods: ['lonely'] },
  { id: 'nature', line: 'A 90-minute walk in nature lowered rumination.', citation: 'Bratman et al., 2015, PNAS', kinds: ['nature'], moods: ['stressed', 'anxious', 'sad'] },
  { id: 'awe', line: 'In one study, weekly awe walks raised joy and eased daily distress.', citation: 'Sturm et al., 2022, Emotion', kinds: ['awe'], moods: ['stressed', 'bored', 'sad'] },
  { id: 'arts', line: 'A WHO review of 3,000+ studies links the arts to better health and well-being.', citation: 'Fancourt & Finn, 2019, WHO', kinds: ['create', 'music-live', 'arts-watch'], moods: ['sad', 'stressed', 'bored'] },
  { id: 'sync', line: 'Dancing or singing in sync with others bonds a group fast.', citation: 'Tarr et al., 2015, Biol. Lett. · Pearce et al., 2015, R. Soc. Open Sci.', kinds: ['move-together'], moods: ['lonely', 'sad'] },
  { id: 'kindness', line: 'Acts of kindness give a small-to-medium boost to your own well-being.', citation: 'Curry et al., 2018, J. Exp. Soc. Psychol.', kinds: ['help'], moods: ['sad', 'lonely', 'unmotivated'] },
  { id: 'calm', line: 'Mindfulness programs show moderate evidence of easing anxiety.', citation: 'Goyal et al., 2014, JAMA Intern. Med.', kinds: ['calm'], moods: ['anxious', 'stressed'] },
  { id: 'laugh', line: 'Laughing together raised pain tolerance, a sign of endorphin release.', citation: 'Dunbar et al., 2012, Proc. R. Soc. B', kinds: ['laugh'], moods: ['stressed'] },
  { id: 'novelty', line: 'People report better mood on days they visit more varied places.', citation: 'Heller et al., 2020, Nat. Neurosci.', kinds: ['learn', 'awe', 'create', 'build'], moods: ['bored', 'unmotivated'] },
  { id: 'progress', line: 'Small wins you can see are the strongest source of confidence.', citation: 'Bandura, 1977, Psychol. Rev.', kinds: ['build', 'learn'], moods: ['unmotivated', 'great'] },
];

export const MECHANISM_BY_ID: Record<string, Mechanism> = Object.fromEntries(MECHANISMS.map((m) => [m.id, m]));

export const SAFETY_MOODS = ['sad', 'lonely', 'anxious', 'stressed'] as const;
export const SAFETY_LINE = 'Feeling this way most days? Yale Mental Health & Counseling, 24/7: 203-432-0290 · 988 Lifeline (call or text)';
