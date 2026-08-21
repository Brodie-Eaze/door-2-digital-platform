/**
 * Shared Kanban ⇄ LeadStatus mapping + non-PII display derivations for the
 * pipeline BFF routes. Lives OUTSIDE route.ts because Next 14 route files may
 * only export route handlers/config — custom exports fail the build.
 */

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'appointment_set',
  'converted',
  'lost',
  'do_not_contact',
] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const KANBAN_LABEL: Record<LeadStatusValue, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  appointment_set: 'Appointment',
  converted: 'Converted',
  lost: 'Lost',
  do_not_contact: 'Do not contact',
};

export function isLeadStatus(v: unknown): v is LeadStatusValue {
  return typeof v === 'string' && (LEAD_STATUSES as readonly string[]).includes(v);
}

/**
 * Accepts either a raw LeadStatus enum value OR a human Kanban stage label
 * ("Appointment", "New", …) and normalises to the enum value. Returns null
 * for anything unrecognised so the caller can 400.
 */
export function toLeadStatus(input: unknown): LeadStatusValue | null {
  if (isLeadStatus(input)) return input;
  if (typeof input !== 'string') return null;
  const needle = input.trim().toLowerCase();
  const match = (Object.keys(KANBAN_LABEL) as LeadStatusValue[]).find(
    (status) => KANBAN_LABEL[status].toLowerCase() === needle,
  );
  return match ?? null;
}

/** e.g. "lead_01HF…ABCD" → "Lead ABCD" — stable, non-reversible to the name. */
export function displayLabel(id: string): string {
  const tail =
    id
      .replace(/^lead_/i, '')
      .slice(-4)
      .toUpperCase() || id.slice(-4).toUpperCase();
  return `Lead ${tail}`;
}

export function initialsFromId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (clean.slice(-2) || '??').padEnd(2, '?');
}
