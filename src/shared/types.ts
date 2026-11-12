export type LicenseId = 'wav' | 'stems' | 'exclusive';
export type Lang = 'cs' | 'en';
export type ServiceId = 'mix' | 'master' | 'mixmaster';

export interface Beat {
  id: string;
  slug: string;
  title: string;
  bpm: number;
  key: string;
  genre: string;
  duration: number;
  /** base64 Uint8 waveform envelope */
  peaks: string;
  seed: number;
  prices: Record<LicenseId, number>;
  hasStems: boolean;
  status: 'draft' | 'active' | 'sold';
  previewUrl: string | null;
  createdAt: string;
}

export interface AdminBeat extends Beat {
  hasWav: boolean;
  hasPreview: boolean;
  wavName: string | null;
  stemsName: string | null;
  sortOrder: number;
}

export interface CatalogResponse {
  beats: Beat[];
  currency: string;
  servicePayments: boolean;
}

export interface OrderView {
  state: 'processing' | 'ready' | 'ended' | 'refunded' | 'service';
  kind: 'license' | 'service';
  beatTitle?: string;
  license?: LicenseId;
  licenseStatus?: string;
  orderNumber?: string;
  termEndsAt?: string | null;
  files?: { kind: 'wav' | 'stems'; name: string }[];
  isTest?: boolean;
}

export const LICENSE_IDS: LicenseId[] = ['wav', 'stems', 'exclusive'];
