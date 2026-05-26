/**
 * Per-account fleet + zone fixtures for live satellite maps.
 *
 * Each sub-account gets a scoped slice of FleetRep + AiZone data, with its
 * own map center/zoom appropriate to where the business operates. Rep
 * coordinates and metadata come from the central seed (`lib/seed/roster.ts`)
 * — so the map shows the SAME knockers that appear on `/knockers` and
 * `/roster`, and the count scales to Pilot-Charlie levels (40-60+ active
 * reps per account rather than the original 12).
 *
 * The hand-authored zones / anomalies / activity copy stays — those are
 * vertical-specific narratives that need editorial control.
 */

import type { FleetRep, AiZone } from './fleet-reps';
import type { AiZoneSuggestion, AnomalyItem, ActivityEvent } from '@/components/field-ops/types';
import { buildRoster } from './seed/roster';
import { ACCOUNT_SEEDS } from './seed/kpis';

export interface AccountFleetData {
  /** [lat, lng] for initial map center */
  center: [number, number];
  zoom: number;
  reps: FleetRep[];
  zones: AiZone[];
  /** Display label for the floating "Live · …" badge */
  scopeLabel: string;
  /** Rich field-ops panel data — AI next zones */
  aiSuggestions: AiZoneSuggestion[];
  /** Rich field-ops panel data — anomalies */
  anomalies: AnomalyItem[];
  /** Rich field-ops panel data — live activity feed */
  activity: ActivityEvent[];
}

interface FleetTemplate {
  center: [number, number];
  zoom: number;
  scopeLabel: string;
  zones: AiZone[];
  aiSuggestions: AiZoneSuggestion[];
  anomalies: AnomalyItem[];
  activity: ActivityEvent[];
  /** Display name of the account (used on rep `.account` field). */
  accountDisplay: string;
}

const FLEET_TEMPLATES: Record<string, FleetTemplate> = {
  'hope-forward': {
    center: [31.2, -97.0],
    zoom: 6,
    scopeLabel: 'Hope Forward · US',
    accountDisplay: 'Hope Forward',
    zones: [
      {
        lat: 30.2415,
        lng: -97.7689,
        label: 'Austin South · 78704',
        reason: 'Propensity 0.81 · ACS median income $94k · 14% conv (lookalike)',
      },
      {
        lat: 33.0198,
        lng: -96.6989,
        label: 'Plano · 75024',
        reason: 'Propensity 0.78 · lookalike to Highland Park (top cohort)',
      },
      {
        lat: 29.6197,
        lng: -95.6349,
        label: 'Sugar Land · 77479',
        reason: 'Propensity 0.74 · low cannibalisation w/ Houston SE',
      },
    ],
    aiSuggestions: [
      {
        id: 'hf-zone-1',
        name: 'Austin South · 78704',
        propensity: 0.81,
        reasonOneLiner: 'ACS median income $94k · charity-giving propensity 0.83 · 0% saturation',
        estLiftPp: 14,
        saturationPercent: 0,
        recommendedReps: 4,
      },
      {
        id: 'hf-zone-2',
        name: 'Plano · 75024',
        propensity: 0.78,
        reasonOneLiner: 'Lookalike to top-performing Highland Park · low Dallas saturation',
        estLiftPp: 11,
        saturationPercent: 12,
        recommendedReps: 6,
      },
      {
        id: 'hf-zone-3',
        name: 'Sugar Land · 77479',
        propensity: 0.74,
        reasonOneLiner: '24% knocks-not-converted in nearby Bellaire = warm re-engage pool',
        estLiftPp: 9,
        saturationPercent: 8,
        recommendedReps: 3,
      },
    ],
    anomalies: [
      {
        id: 'hf-anom-1',
        severity: 'critical',
        title: '14 reps offline · auto-SMS dispatched',
        detail:
          'Houston SE shift coverage at 78%. Reassign 4 reps from Houston Central or escalate to ops lead.',
        actionLabel: 'Reassign',
      },
      {
        id: 'hf-anom-2',
        severity: 'warn',
        title: '8 reps on break > 45min',
        detail:
          'Auto-reminder push sent. Watch for chronic-late patterns (3 reps now flagged 2x this week).',
        actionLabel: 'Nudge all',
      },
      {
        id: 'hf-anom-3',
        severity: 'warn',
        title: 'Plano conv. rate dropped 9pp · last 4hr',
        detail:
          'Two new reps onboarding; script v3.2 not pushed to their iPads yet. Push update or rotate veteran in.',
        actionLabel: 'Open 1:1',
      },
    ],
    activity: [
      {
        id: 'hf-act-1',
        at: '14:42',
        actorInitials: 'JD',
        type: 'conversion',
        primary: 'Conversion captured',
        secondary: 'Maria Santos · $32/mo recurring · Austin East',
      },
      {
        id: 'hf-act-2',
        at: '14:41',
        actorInitials: 'JM',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '4218 Lakeview Dr, Austin TX',
      },
      {
        id: 'hf-act-3',
        at: '14:40',
        actorInitials: 'KP',
        type: 'callback_scheduled',
        primary: 'Callback scheduled',
        secondary: 'Robert Kim · Tue 3pm · Houston Central',
      },
      {
        id: 'hf-act-4',
        at: '14:38',
        actorInitials: 'AR',
        type: 'shift_start',
        primary: 'Started shift',
        secondary: 'Austin North · 8h shift',
      },
      {
        id: 'hf-act-5',
        at: '14:36',
        actorInitials: 'AM',
        type: 'conversion',
        primary: 'Conversion captured',
        secondary: 'James Whitfield · $48/mo · Dallas Metro',
      },
      {
        id: 'hf-act-6',
        at: '14:35',
        actorInitials: 'TM',
        type: 'shift_break_return',
        primary: 'Returned from break',
        secondary: 'Lunch 45m · Austin South',
      },
      {
        id: 'hf-act-7',
        at: '14:32',
        actorInitials: 'ML',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '1502 Cedar St, Houston · $48/mo recurring',
      },
      {
        id: 'hf-act-8',
        at: '14:31',
        actorInitials: 'JM',
        type: 'knock_not_home',
        primary: 'Knock recorded · NOT HOME',
        secondary: '4216 Lakeview Dr, Austin TX',
      },
      {
        id: 'hf-act-9',
        at: '14:30',
        actorInitials: 'CS',
        type: 'conversion',
        primary: 'Conversion captured',
        secondary: 'Patricia Adler · $30/mo · Dallas North',
      },
      {
        id: 'hf-act-10',
        at: '14:28',
        actorInitials: 'RV',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '6004 Legacy Dr, Plano TX',
      },
      {
        id: 'hf-act-11',
        at: '14:26',
        actorInitials: 'JD',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '2210 Manor Rd, Austin · $24/mo recurring',
      },
      {
        id: 'hf-act-12',
        at: '14:25',
        actorInitials: 'DR',
        type: 'shift_break_start',
        primary: 'Started break',
        secondary: 'Lunch · Houston SE',
      },
      {
        id: 'hf-act-13',
        at: '14:23',
        actorInitials: 'EB',
        type: 'conversion',
        primary: 'Conversion captured',
        secondary: 'Marcus Reeves · $36/mo · Plano',
      },
      {
        id: 'hf-act-14',
        at: '14:21',
        actorInitials: 'AR',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '912 Anderson Ln, Austin · $40/mo',
      },
      {
        id: 'hf-act-15',
        at: '14:18',
        actorInitials: 'KP',
        type: 'conversion',
        primary: 'Conversion captured',
        secondary: 'Lily Tran · $25/mo · Houston Central',
      },
      {
        id: 'hf-act-16',
        at: '14:16',
        actorInitials: 'ML',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '8814 Memorial Dr, Houston',
      },
      {
        id: 'hf-act-17',
        at: '14:14',
        actorInitials: 'AM',
        type: 'knock_not_home',
        primary: 'Knock recorded · NOT HOME',
        secondary: '402 Knox St, Dallas',
      },
      {
        id: 'hf-act-18',
        at: '14:12',
        actorInitials: 'CS',
        type: 'callback_scheduled',
        primary: 'Callback scheduled',
        secondary: 'Hassan Khalil · Thu 6pm · Dallas Metro',
      },
      {
        id: 'hf-act-19',
        at: '14:09',
        actorInitials: 'JM',
        type: 'conversion',
        primary: 'Conversion captured',
        secondary: 'Naomi Walker · $36/mo · Austin East',
      },
      {
        id: 'hf-act-20',
        at: '14:07',
        actorInitials: 'TM',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '344 Live Oak St, Austin · $30/mo',
      },
    ],
  },
  'world-vision': {
    center: [-32.5, 148.0],
    zoom: 5,
    scopeLabel: 'World Vision · AU',
    accountDisplay: 'World Vision',
    zones: [
      {
        lat: -33.8174,
        lng: 151.0023,
        label: 'Parramatta · 2150',
        reason: 'Propensity 0.79 · SEIFA decile 9 · large multicultural cohort',
      },
      {
        lat: -37.7693,
        lng: 144.9844,
        label: 'Brunswick · 3056',
        reason: 'Propensity 0.82 · charity supporter density top quintile',
      },
      {
        lat: -27.4015,
        lng: 153.1198,
        label: 'Chermside · 4032',
        reason: 'Propensity 0.76 · CoreLogic AU growth corridor · low saturation',
      },
    ],
    aiSuggestions: [
      {
        id: 'wv-zone-1',
        name: 'Parramatta · 2150',
        propensity: 0.79,
        reasonOneLiner:
          'SEIFA decile 9 · large multicultural cohort · child sponsorship affinity 0.84',
        estLiftPp: 13,
        saturationPercent: 4,
        recommendedReps: 5,
      },
      {
        id: 'wv-zone-2',
        name: 'Brunswick · 3056',
        propensity: 0.82,
        reasonOneLiner: 'Charity supporter density top quintile · prior campaign uplift 17pp',
        estLiftPp: 15,
        saturationPercent: 6,
        recommendedReps: 6,
      },
      {
        id: 'wv-zone-3',
        name: 'Chermside · 4032',
        propensity: 0.76,
        reasonOneLiner:
          'CoreLogic AU growth corridor · low Brisbane saturation · 11k door catchment',
        estLiftPp: 10,
        saturationPercent: 3,
        recommendedReps: 3,
      },
    ],
    anomalies: [
      {
        id: 'wv-anom-1',
        severity: 'critical',
        title: '11 reps offline · Sydney West uncovered',
        detail:
          'Sydney West shift at 64% coverage. Auto-SMS sent. Backup roster offered $40 short-shift bonus.',
        actionLabel: 'Reassign',
      },
      {
        id: 'wv-anom-2',
        severity: 'warn',
        title: '6 reps on break > 50min',
        detail:
          'Mostly Melbourne CBD. Auto-reminder push sent to iPad. Pattern flagged for ops review.',
        actionLabel: 'Nudge all',
      },
      {
        id: 'wv-anom-3',
        severity: 'warn',
        title: 'Brisbane CBD conv. rate dropped 7pp',
        detail:
          'Last 4 hours vs trailing avg. Try sponsorship script v4.1 + check Brisbane CBD saturation.',
        actionLabel: 'Open 1:1',
      },
    ],
    activity: [
      {
        id: 'wv-act-1',
        at: '14:42',
        actorInitials: 'AC',
        type: 'conversion',
        primary: 'Child sponsorship captured',
        secondary: 'Sarah Mitchell · A$50/mo · Sydney CBD',
      },
      {
        id: 'wv-act-2',
        at: '14:40',
        actorInitials: 'EM',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '142 Adelaide St, Brisbane CBD',
      },
      {
        id: 'wv-act-3',
        at: '14:38',
        actorInitials: 'IN',
        type: 'conversion',
        primary: 'Child sponsorship captured',
        secondary: 'Daniel Tran · A$45/mo · Melbourne CBD',
      },
      {
        id: 'wv-act-4',
        at: '14:36',
        actorInitials: 'ZH',
        type: 'callback_scheduled',
        primary: 'Callback scheduled',
        secondary: 'Priya Sharma · Thu 6pm · Sydney East',
      },
      {
        id: 'wv-act-5',
        at: '14:34',
        actorInitials: 'HK',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '88 Sydney Rd, Brunswick · A$60/mo recurring',
      },
      {
        id: 'wv-act-6',
        at: '14:32',
        actorInitials: 'JW',
        type: 'shift_break_return',
        primary: 'Returned from break',
        secondary: 'Lunch 50m · Sydney South',
      },
      {
        id: 'wv-act-7',
        at: '14:30',
        actorInitials: 'GO',
        type: 'conversion',
        primary: 'Child sponsorship captured',
        secondary: 'Aroha Wilson · A$50/mo · Melbourne East',
      },
      {
        id: 'wv-act-8',
        at: '14:28',
        actorInitials: 'AS',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '14 Hamilton Rd, Chermside',
      },
      {
        id: 'wv-act-9',
        at: '14:26',
        actorInitials: 'NR',
        type: 'knock_not_home',
        primary: 'Knock recorded · NOT HOME',
        secondary: '212 Barkly St, Footscray',
      },
      {
        id: 'wv-act-10',
        at: '14:24',
        actorInitials: 'MT',
        type: 'conversion',
        primary: 'Child sponsorship captured',
        secondary: 'Jamal Chen · A$40/mo · Brisbane South',
      },
      {
        id: 'wv-act-11',
        at: '14:22',
        actorInitials: 'EM',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '67 Wickham Tce, Brisbane · A$75/mo · 2 children',
      },
      {
        id: 'wv-act-12',
        at: '14:19',
        actorInitials: 'LO',
        type: 'shift_break_start',
        primary: 'Started break',
        secondary: 'Lunch · Sydney Inner West',
      },
      {
        id: 'wv-act-13',
        at: '14:17',
        actorInitials: 'AC',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '203 Pitt St, Sydney CBD',
      },
      {
        id: 'wv-act-14',
        at: '14:15',
        actorInitials: 'IN',
        type: 'conversion',
        primary: 'Child sponsorship captured',
        secondary: 'Liam OBrien · A$55/mo · Melbourne CBD',
      },
      {
        id: 'wv-act-15',
        at: '14:13',
        actorInitials: 'HK',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '34 Lygon St, Carlton · A$45/mo',
      },
      {
        id: 'wv-act-16',
        at: '14:10',
        actorInitials: 'GO',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '88 Riversdale Rd, Hawthorn',
      },
      {
        id: 'wv-act-17',
        at: '14:08',
        actorInitials: 'EM',
        type: 'conversion',
        primary: 'Child sponsorship captured',
        secondary: 'Mia Brown · A$48/mo · Brisbane North',
      },
      {
        id: 'wv-act-18',
        at: '14:06',
        actorInitials: 'ZH',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '12 Bondi Rd, Bondi · A$50/mo',
      },
      {
        id: 'wv-act-19',
        at: '14:04',
        actorInitials: 'AS',
        type: 'conversion',
        primary: 'Child sponsorship captured',
        secondary: 'Tyson Williams · A$45/mo · Brisbane CBD',
      },
      {
        id: 'wv-act-20',
        at: '14:01',
        actorInitials: 'MT',
        type: 'callback_scheduled',
        primary: 'Callback scheduled',
        secondary: 'Ava Singh · Fri 2pm · Brisbane South',
      },
    ],
  },
  pestmax: {
    center: [32.0, -103.0],
    zoom: 5,
    scopeLabel: 'PestMax · US',
    accountDisplay: 'PestMax',
    zones: [
      {
        lat: 32.8136,
        lng: -96.6483,
        label: 'Garland · 75040',
        reason: 'Propensity 0.71 · termite hotspot · high SFR density',
      },
      {
        lat: 33.4942,
        lng: -111.926,
        label: 'Scottsdale · 85251',
        reason: 'Propensity 0.74 · premium service tier · low cannibalisation',
      },
    ],
    aiSuggestions: [
      {
        id: 'pm-zone-1',
        name: 'Garland · 75040',
        propensity: 0.71,
        reasonOneLiner: 'Termite hotspot · high SFR density · 38% commercial property mix',
        estLiftPp: 10,
        saturationPercent: 5,
        recommendedReps: 3,
      },
      {
        id: 'pm-zone-2',
        name: 'Scottsdale · 85254',
        propensity: 0.74,
        reasonOneLiner: 'Premium service tier · low Phoenix cannibalisation · HOA-permitted',
        estLiftPp: 12,
        saturationPercent: 7,
        recommendedReps: 4,
      },
      {
        id: 'pm-zone-3',
        name: 'Cypress · 77433',
        propensity: 0.69,
        reasonOneLiner: 'New-build subdivision · termite scope · Houston West expansion play',
        estLiftPp: 8,
        saturationPercent: 2,
        recommendedReps: 2,
      },
    ],
    anomalies: [
      {
        id: 'pm-anom-1',
        severity: 'critical',
        title: '4 reps no completed calls in 2hr · Houston SE',
        detail: 'Houston SE route. Possible vehicle issue or no-knock zone — check in via call.',
        actionLabel: 'Call reps',
      },
      {
        id: 'pm-anom-2',
        severity: 'warn',
        title: '3 reps lunch > 60min',
        detail: 'Dallas Metro cluster. Auto-reminder push sent.',
        actionLabel: 'Nudge',
      },
      {
        id: 'pm-anom-3',
        severity: 'warn',
        title: 'Installer no-show on 8 pending appts',
        detail:
          'Dallas Metro install crew offline. Reassign install slots before customer SLA breach.',
        actionLabel: 'Reassign installs',
      },
    ],
    activity: [
      {
        id: 'pm-act-1',
        at: '14:42',
        actorInitials: 'BC',
        type: 'conversion',
        primary: 'Service contract closed',
        secondary: 'Henderson Properties · $89/mo · 1yr · Dallas Metro',
      },
      {
        id: 'pm-act-2',
        at: '14:40',
        actorInitials: 'RG',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '4502 Lemmon Ave, Dallas',
      },
      {
        id: 'pm-act-3',
        at: '14:38',
        actorInitials: 'HK',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '2210 McKinney Ave · termite scope · $1,240',
      },
      {
        id: 'pm-act-4',
        at: '14:35',
        actorInitials: 'TN',
        type: 'conversion',
        primary: 'Service contract closed',
        secondary: 'Camelback Plaza · $145/mo · commercial · Phoenix Metro',
      },
      {
        id: 'pm-act-5',
        at: '14:33',
        actorInitials: 'AT',
        type: 'callback_scheduled',
        primary: 'Callback scheduled',
        secondary: 'Northside Office Park · Wed 10am · Houston SE',
      },
      {
        id: 'pm-act-6',
        at: '14:30',
        actorInitials: 'SK',
        type: 'shift_break_start',
        primary: 'Started break',
        secondary: 'Lunch · Dallas Metro',
      },
      {
        id: 'pm-act-7',
        at: '14:27',
        actorInitials: 'JL',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '7820 W Thomas Rd, Phoenix',
      },
      {
        id: 'pm-act-8',
        at: '14:24',
        actorInitials: 'RG',
        type: 'conversion',
        primary: 'Service contract closed',
        secondary: 'Oak Lawn Dental · $69/mo · 1yr · Dallas South',
      },
      {
        id: 'pm-act-9',
        at: '14:21',
        actorInitials: 'BC',
        type: 'knock_not_home',
        primary: 'Knock recorded · NOT HOME',
        secondary: '1880 Greenville Ave, Dallas',
      },
      {
        id: 'pm-act-10',
        at: '14:18',
        actorInitials: 'AT',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '4120 Kirby Dr, Houston · $99/mo · quarterly service',
      },
      {
        id: 'pm-act-11',
        at: '14:14',
        actorInitials: 'HK',
        type: 'shift_break_return',
        primary: 'Returned from break',
        secondary: 'Lunch 40m · Dallas North',
      },
      {
        id: 'pm-act-12',
        at: '14:08',
        actorInitials: 'TN',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '6890 N Central Ave, Phoenix',
      },
      {
        id: 'pm-act-13',
        at: '14:05',
        actorInitials: 'JL',
        type: 'conversion',
        primary: 'Service contract closed',
        secondary: 'Desert Sun Apartments · $245/mo · Phoenix West',
      },
      {
        id: 'pm-act-14',
        at: '14:02',
        actorInitials: 'AT',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '1402 Kirby Dr, Houston · termite scope · $1,840',
      },
      {
        id: 'pm-act-15',
        at: '13:58',
        actorInitials: 'BC',
        type: 'callback_scheduled',
        primary: 'Callback scheduled',
        secondary: 'Sigma Logistics · Wed 2pm · Dallas Metro',
      },
    ],
  },
  'gold-coast-hospital': {
    center: [-28.02, 153.4],
    zoom: 11,
    scopeLabel: 'Gold Coast Hospital · AU',
    accountDisplay: 'Gold Coast Hospital',
    zones: [
      {
        lat: -28.0421,
        lng: 153.4019,
        label: 'Mermaid Waters · 4218',
        reason: 'Propensity 0.78 · SEIFA decile 9 · capital campaign lookalike',
      },
      {
        lat: -28.0226,
        lng: 153.3672,
        label: 'Nerang · 4211',
        reason: 'Propensity 0.71 · low saturation · family households · catchment 12k doors',
      },
    ],
    aiSuggestions: [
      {
        id: 'gc-zone-1',
        name: 'Mermaid Waters · 4218',
        propensity: 0.78,
        reasonOneLiner: 'SEIFA decile 9 · capital campaign lookalike · 4.6k doors retiree-skew',
        estLiftPp: 12,
        saturationPercent: 4,
        recommendedReps: 3,
      },
      {
        id: 'gc-zone-2',
        name: 'Nerang · 4211',
        propensity: 0.71,
        reasonOneLiner:
          'Low saturation · family households · catchment 12k doors · GP referral overlap',
        estLiftPp: 9,
        saturationPercent: 2,
        recommendedReps: 2,
      },
      {
        id: 'gc-zone-3',
        name: 'Tweed Heads · 2485',
        propensity: 0.69,
        reasonOneLiner: 'Cross-border NSW catchment · hospital service area · older demographic',
        estLiftPp: 8,
        saturationPercent: 1,
        recommendedReps: 1,
      },
    ],
    anomalies: [
      {
        id: 'gc-anom-1',
        severity: 'critical',
        title: '2 reps offline · Southport uncovered',
        detail: 'Southport route uncovered. Auto-SMS sent. Backup: reassign from Surfers Paradise.',
        actionLabel: 'Reassign',
      },
      {
        id: 'gc-anom-2',
        severity: 'warn',
        title: '1 rep lunch break > 50min',
        detail: 'On break since 12:50 AEST. Auto-reminder push sent.',
        actionLabel: 'Nudge',
      },
      {
        id: 'gc-anom-3',
        severity: 'warn',
        title: 'Robina pledge rate dropped 7pp',
        detail:
          'Last 4 hours vs trailing avg. Try the new capital campaign script + check Robina saturation.',
        actionLabel: 'Open 1:1',
      },
    ],
    activity: [
      {
        id: 'gc-act-1',
        at: '14:42',
        actorInitials: 'CO',
        type: 'conversion',
        primary: 'One-off donation captured',
        secondary: 'Margaret Wells · A$200 · Surfers Paradise',
      },
      {
        id: 'gc-act-2',
        at: '14:40',
        actorInitials: 'JK',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '24 Cavill Ave, Surfers Paradise',
      },
      {
        id: 'gc-act-3',
        at: '14:38',
        actorInitials: 'EH',
        type: 'conversion',
        primary: 'Monthly pledge captured',
        secondary: 'Geoff Tan · A$35/mo · Broadbeach',
      },
      {
        id: 'gc-act-4',
        at: '14:35',
        actorInitials: 'MC',
        type: 'knock_sale',
        primary: 'Knock recorded · CAPITAL PLEDGE',
        secondary: '188 Goodwin Tce, Burleigh Heads · A$1,500 over 12mo',
      },
      {
        id: 'gc-act-5',
        at: '14:32',
        actorInitials: 'SR',
        type: 'callback_scheduled',
        primary: 'Callback scheduled',
        secondary: 'Dr Anita Rao · Fri 2pm · Robina',
      },
      {
        id: 'gc-act-6',
        at: '14:30',
        actorInitials: 'OP',
        type: 'shift_break_start',
        primary: 'Started break',
        secondary: 'Lunch · Broadbeach',
      },
      {
        id: 'gc-act-7',
        at: '14:27',
        actorInitials: 'CO',
        type: 'knock_lead',
        primary: 'Knock recorded · LEAD',
        secondary: '76 Esplanade, Surfers Paradise',
      },
      {
        id: 'gc-act-8',
        at: '14:24',
        actorInitials: 'EH',
        type: 'conversion',
        primary: 'One-off donation captured',
        secondary: 'Kelly Brennan · A$150 · Broadbeach',
      },
      {
        id: 'gc-act-9',
        at: '14:21',
        actorInitials: 'JK',
        type: 'knock_not_home',
        primary: 'Knock recorded · NOT HOME',
        secondary: '12 Hanlan St, Surfers Paradise',
      },
      {
        id: 'gc-act-10',
        at: '14:18',
        actorInitials: 'SR',
        type: 'conversion',
        primary: 'Monthly pledge captured',
        secondary: 'Hiro Yamamoto · A$50/mo · Robina',
      },
      {
        id: 'gc-act-11',
        at: '14:14',
        actorInitials: 'MC',
        type: 'knock_sale',
        primary: 'Knock recorded · SALE',
        secondary: '210 W Burleigh Rd, Burleigh Heads · A$80/mo recurring',
      },
      {
        id: 'gc-act-12',
        at: '14:08',
        actorInitials: 'LD',
        type: 'shift_break_return',
        primary: 'Returned from break',
        secondary: 'Lunch 35m · Robina',
      },
    ],
  },
};

/**
 * Convert a SeededKnocker (which carries lat/lng + status + hours) into the
 * FleetRep shape consumed by the Leaflet map components. Only knockers who
 * are on-shift (active/break/idle) are rendered as pins; offline reps are
 * filtered out at the map layer.
 */
function buildReps(slug: string, accountDisplay: string): FleetRep[] {
  const cfg = ACCOUNT_SEEDS[slug];
  if (!cfg) return [];
  const roster = buildRoster({ slug });
  // Show every on-shift rep up to a hard cap. 60 pins on a 640px map is
  // crowded but legible; >80 makes the map a sea of dots.
  const MAX_VISIBLE = 60;
  const fielded = roster.filter((k) => k.status !== 'offline');
  const visible = fielded.slice(0, MAX_VISIBLE);
  return visible.map((k) => ({
    id: k.id,
    initials: k.initials,
    name: k.name,
    account: accountDisplay,
    lat: k.lat,
    lng: k.lng,
    status: k.status === 'break' ? 'break' : k.status === 'idle' ? 'idle' : 'active',
    shiftStart: k.shiftStart,
    hoursToday: k.hoursToday,
    knocksToday: k.knocksToday,
    conversionsToday: k.conversionsToday,
    lastKnockMin: k.lastKnockMin,
    territory: k.territory,
  }));
}

function buildFleetData(slug: string): AccountFleetData | undefined {
  const tpl = FLEET_TEMPLATES[slug];
  if (!tpl) return undefined;
  return {
    center: tpl.center,
    zoom: tpl.zoom,
    reps: buildReps(slug, tpl.accountDisplay),
    zones: tpl.zones,
    scopeLabel: tpl.scopeLabel,
    aiSuggestions: tpl.aiSuggestions,
    anomalies: tpl.anomalies,
    activity: tpl.activity,
  };
}

// Build all four account fleets eagerly so consumers can stay synchronous
// (parity with the previous static-record API).
export const ACCOUNT_FLEET: Record<string, AccountFleetData> = Object.fromEntries(
  Object.keys(FLEET_TEMPLATES).map((slug) => {
    const data = buildFleetData(slug);
    return [slug, data!];
  }),
);

export function getAccountFleet(slug: string): AccountFleetData | undefined {
  return ACCOUNT_FLEET[slug];
}
