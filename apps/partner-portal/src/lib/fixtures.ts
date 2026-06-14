/** Fixture data for partner-portal pages.  All amounts in USD cents. */

// ─── Invoices ───────────────────────────────────────────────────────────────

export interface InvoiceFixture {
  id: string;
  period: string;
  issuedDate: string;
  dueDate: string;
  status: 'paid' | 'outstanding' | 'overdue';
  platformFeeCents: number;
  doorRakeCents: number;
  insideSalesRakeCents: number;
  retargetingRakeCents: number;
  totalCents: number;
}

export const INVOICES: InvoiceFixture[] = [
  {
    id: 'inv_01HW3K4NVDF',
    period: 'May 2026',
    issuedDate: '2026-06-01',
    dueDate: '2026-06-15',
    status: 'outstanding',
    platformFeeCents: 250_000,
    doorRakeCents: 184_350,
    insideSalesRakeCents: 63_200,
    retargetingRakeCents: 21_750,
    totalCents: 519_300,
  },
  {
    id: 'inv_01HV2J3MNCE',
    period: 'April 2026',
    issuedDate: '2026-05-01',
    dueDate: '2026-05-15',
    status: 'paid',
    platformFeeCents: 250_000,
    doorRakeCents: 167_100,
    insideSalesRakeCents: 54_800,
    retargetingRakeCents: 18_200,
    totalCents: 490_100,
  },
  {
    id: 'inv_01HU1H2LMBD',
    period: 'March 2026',
    issuedDate: '2026-04-01',
    dueDate: '2026-04-15',
    status: 'paid',
    platformFeeCents: 250_000,
    doorRakeCents: 152_250,
    insideSalesRakeCents: 47_600,
    retargetingRakeCents: 14_900,
    totalCents: 464_750,
  },
];

// ─── Conversions ─────────────────────────────────────────────────────────────

export interface ConversionWeek {
  week: string;
  door: number;
  insideSales: number;
  retargeting: number;
}

export const CONVERSION_WEEKS: ConversionWeek[] = [
  { week: '21-Apr', door: 312, insideSales: 87, retargeting: 44 },
  { week: '28-Apr', door: 341, insideSales: 91, retargeting: 52 },
  { week: '05-May', door: 298, insideSales: 83, retargeting: 61 },
  { week: '12-May', door: 367, insideSales: 104, retargeting: 58 },
  { week: '19-May', door: 389, insideSales: 112, retargeting: 73 },
  { week: '26-May', door: 421, insideSales: 119, retargeting: 81 },
  { week: '02-Jun', door: 354, insideSales: 97, retargeting: 69 },
  { week: '09-Jun', door: 398, insideSales: 108, retargeting: 77 },
];

export interface ConversionSummary {
  label: string;
  value: number;
  rake: number;
  color: string;
}

export const CONVERSION_SUMMARY: ConversionSummary[] = [
  { label: 'Door closed', value: 2880, rake: 15, color: '#3B82F6' },
  { label: 'Inside sales', value: 801, rake: 10, color: '#0F172A' },
  { label: 'Retargeting', value: 515, rake: 5, color: '#94A3B8' },
];

// ─── Compliance ──────────────────────────────────────────────────────────────

export type ClearanceStatus = 'cleared' | 'pending' | 'expired' | 'not_filed';

export interface StateClearance {
  state: string;
  code: string;
  status: ClearanceStatus;
  clearedDate?: string;
  expiresDate?: string;
  bondAmountDollars?: number;
  registrationNumber?: string;
  notes?: string;
}

export const STATE_CLEARANCES: StateClearance[] = [
  {
    state: 'California',
    code: 'CA',
    status: 'cleared',
    clearedDate: '2026-01-15',
    expiresDate: '2027-01-14',
    bondAmountDollars: 25_000,
    registrationNumber: 'CT-2026-88421',
  },
  {
    state: 'Florida',
    code: 'FL',
    status: 'cleared',
    clearedDate: '2026-02-03',
    expiresDate: '2027-02-02',
    bondAmountDollars: 15_000,
    registrationNumber: 'FL-SRS-2026-14192',
  },
  {
    state: 'Texas',
    code: 'TX',
    status: 'cleared',
    clearedDate: '2026-02-28',
    expiresDate: '2027-02-27',
    bondAmountDollars: 10_000,
    registrationNumber: 'TX-CS-20-0934',
  },
  {
    state: 'New York',
    code: 'NY',
    status: 'pending',
    notes: 'Bond posted; awaiting AG approval (est. 4–6 wk)',
    bondAmountDollars: 50_000,
  },
  {
    state: 'Illinois',
    code: 'IL',
    status: 'pending',
    notes: 'Filed 2026-05-20; processing 6–8 wk',
  },
  {
    state: 'Ohio',
    code: 'OH',
    status: 'pending',
    notes: 'Filed 2026-06-01; processing 4–8 wk',
  },
  {
    state: 'Georgia',
    code: 'GA',
    status: 'not_filed',
    notes: 'Scheduled Q3 2026',
  },
  {
    state: 'North Carolina',
    code: 'NC',
    status: 'not_filed',
    notes: 'Scheduled Q3 2026',
  },
  {
    state: 'Michigan',
    code: 'MI',
    status: 'not_filed',
    notes: 'Scheduled Q4 2026',
  },
  {
    state: 'Pennsylvania',
    code: 'PA',
    status: 'not_filed',
    notes: 'Scheduled Q4 2026',
  },
];

// ─── Payouts ─────────────────────────────────────────────────────────────────

export interface PayoutStatementFixture {
  id: string;
  period: string;
  generatedDate: string;
  status: 'acknowledged' | 'instructed' | 'ready_to_pay';
  knockerCount: number;
  totalCents: number;
}

export const PAYOUT_STATEMENTS: PayoutStatementFixture[] = [
  {
    id: 'pob_01HW5M6OPEG',
    period: 'May 2026 (2nd half)',
    generatedDate: '2026-06-01',
    status: 'acknowledged',
    knockerCount: 187,
    totalCents: 284_320,
  },
  {
    id: 'pob_01HV4L5NNDH',
    period: 'May 2026 (1st half)',
    generatedDate: '2026-05-16',
    status: 'acknowledged',
    knockerCount: 183,
    totalCents: 261_750,
  },
  {
    id: 'pob_01HU3K4MMCG',
    period: 'April 2026 (2nd half)',
    generatedDate: '2026-05-01',
    status: 'acknowledged',
    knockerCount: 176,
    totalCents: 247_100,
  },
  {
    id: 'pob_01HT2J3LLBF',
    period: 'April 2026 (1st half)',
    generatedDate: '2026-04-16',
    status: 'acknowledged',
    knockerCount: 171,
    totalCents: 238_900,
  },
];
