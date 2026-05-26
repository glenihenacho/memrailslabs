import { randomUUID } from 'node:crypto';

export function claimSlug(text: string, suffix?: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  const safe = base.length > 0 ? base : 'claim';
  const tail = suffix ?? randomUUID().replace(/-/g, '').slice(0, 6);
  return `${safe}-${tail}`;
}

export function slugToClaimId(slug: string): string {
  return `clm_${slug.replace(/-/g, '_')}`;
}
