export const CRM_STATUSES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE"
] as const;

export const DATA_SOURCES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots"
] as const;

export const CRM_FIELDS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description"
] as const;

export type CrmStatus = (typeof CRM_STATUSES)[number];
export type DataSource = (typeof DATA_SOURCES)[number] | "";
export type CrmField = (typeof CRM_FIELDS)[number];

export type CrmRecord = {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CrmStatus | "";
  crm_note: string;
  data_source: DataSource;
  possession_time: string;
  description: string;
};

export type RecordQuality = {
  rowNumber: number;
  confidence: "high" | "medium" | "low";
  completeness: number;
  presentFields: CrmField[];
  missingFields: CrmField[];
  warnings: string[];
};

export type SkippedRecord = {
  rowNumber: number;
  reason: string;
  original: Record<string, unknown>;
};

export type ImportMeta = {
  provider: string;
  model: string;
  usedFallback: boolean;
  batchSize: number;
  batchesProcessed: number;
  processedAt: string;
  processingMs: number;
};

export type ImportResponse = {
  records: CrmRecord[];
  quality: RecordQuality[];
  skipped: SkippedRecord[];
  meta: ImportMeta;
  summary: {
    totalRows: number;
    totalImported: number;
    totalSkipped: number;
    averageCompleteness: number;
  };
};
