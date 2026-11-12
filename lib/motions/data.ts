import type { MotionDef } from './types';
import { TOP_MOTIONS } from './data-top';
import { REST_MOTIONS } from './data-rest';
import { CIVIL2_MOTIONS } from './data-civil2';
import { CIVIL3_MOTIONS } from './data-civil3';
import { INITIATING_MOTIONS } from './data-initiating';
import { INITIATING2_MOTIONS } from './data-initiating2';
import { FAMILY2_MOTIONS } from './data-family2';
import { FAMILY3_MOTIONS } from './data-family3';
import { CRIMINAL2_MOTIONS } from './data-criminal2';
import { CRIMINAL3_MOTIONS } from './data-criminal3';
import { LANDLORD2_MOTIONS } from './data-landlord2';
import { POSTJUDGMENT2_MOTIONS } from './data-postjudgment2';
import { PROBATE_MOTIONS } from './data-probate';
import { PROBATE2_MOTIONS } from './data-probate2';
import { DEBT_MOTIONS } from './data-debt';
import { TRAFFIC_MOTIONS } from './data-traffic';
import { APPEALS_MOTIONS } from './data-appeals';
import { PROTECTION_MOTIONS } from './data-protection';
import { ADMIN_MOTIONS } from './data-admin';
import { FORMS_MOTIONS } from './data-forms';
import { FORMS2_MOTIONS } from './data-forms2';

export const ALL_MOTIONS: MotionDef[] = [
  ...TOP_MOTIONS,
  ...REST_MOTIONS,
  ...CIVIL2_MOTIONS,
  ...CIVIL3_MOTIONS,
  ...INITIATING_MOTIONS,
  ...INITIATING2_MOTIONS,
  ...FAMILY2_MOTIONS,
  ...FAMILY3_MOTIONS,
  ...CRIMINAL2_MOTIONS,
  ...CRIMINAL3_MOTIONS,
  ...LANDLORD2_MOTIONS,
  ...POSTJUDGMENT2_MOTIONS,
  ...PROBATE_MOTIONS,
  ...PROBATE2_MOTIONS,
  ...DEBT_MOTIONS,
  ...TRAFFIC_MOTIONS,
  ...APPEALS_MOTIONS,
  ...PROTECTION_MOTIONS,
  ...ADMIN_MOTIONS,
  ...FORMS_MOTIONS,
  ...FORMS2_MOTIONS,
].sort((a, b) => a.num - b.num);

export const CATEGORIES = [
  'General Civil',
  'Initiating & Small Claims',
  'Family',
  'Criminal & Post-Conviction',
  'Landlord–Tenant',
  'Post-Judgment & Enforcement',
  'Probate, Guardianship & Estates',
  'Debt, Consumer & Foreclosure',
  'Traffic & Municipal',
  'Appeals',
  'Protection Orders',
  'Administrative Review',
  'Forms & Companions',
] as const;
