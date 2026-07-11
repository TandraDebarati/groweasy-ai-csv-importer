import { CRM_FIELDS, CRM_STATUSES, DATA_SOURCES } from "@groweasy/shared";

export function buildExtractionPrompt(rows: Array<{ rowNumber: number; data: Record<string, string> }>) {
  return [
    "You are an expert CRM CSV import assistant for GrowEasy.",
    "Map arbitrary lead-export rows into the exact GrowEasy CRM JSON schema.",
    "",
    `Allowed fields: ${CRM_FIELDS.join(", ")}`,
    `Allowed crm_status values: ${CRM_STATUSES.join(", ")}`,
    `Allowed data_source values: ${DATA_SOURCES.join(", ")}. If none match confidently, use an empty string.`,
    "",
    "Rules:",
    "1. Return ONLY valid JSON. No markdown.",
    "2. Output shape: {\"records\": [{...}], \"skipped\": [{\"source_row_number\": number, \"reason\": string}]}",
    "3. Each record must include source_row_number plus all CRM fields.",
    "4. created_at must be parseable by JavaScript new Date(created_at). Use empty string if unknown.",
    "5. If multiple emails exist, use the first as email and append remaining emails to crm_note.",
    "6. If multiple mobiles exist, use the first as mobile_without_country_code and append remaining numbers to crm_note.",
    "7. Split Indian numbers into country_code +91 and 10 digit mobile when possible.",
    "8. Use crm_note for remarks, extra contacts, ambiguous values, and details that do not fit another field.",
    "9. Skip rows that contain neither an email nor a mobile number.",
    "10. Do not invent unavailable personal data. Leave uncertain fields blank.",
    "11. Normalize statuses: follow-up/new/interested => GOOD_LEAD_FOLLOW_UP, busy/no answer/not reachable => DID_NOT_CONNECT, not interested/junk/invalid => BAD_LEAD, closed/won/sold => SALE_DONE.",
    "12. Map projects/campaigns mentioning meridian tower, eden park, varah swamy, or sarjapur plots to the matching data_source.",
    "",
    "Rows:",
    JSON.stringify(rows)
  ].join("\n");
}
