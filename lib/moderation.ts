// This is only a preview hint. The authoritative filter lives in Supabase (schema.sql).
const REVIEW_TERMS = [
  'stupid', 'idiot', 'hate', 'kill', 'shut up', 'crap', 'fah', 'fuck',
  'shit', 'shid', 'dumb', 'asshole', 'bastard', 'bitch', 'bullshit', 'damn',
  'jerk', 'loser', 'moron', 'sucks', 'piss off', 'go to hell',
  'shut your mouth', 'freaking', 'frigging', 'porn', 'sexy', 'naked',
];

export function moderationReason(content: string): string | null {
  const normalized = content.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const match = REVIEW_TERMS.find((term) => normalized.includes(term));
  return match ? `Possible unsafe language: “${match}”` : null;
}
