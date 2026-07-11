import type { CrmRecord } from "@groweasy/shared";
import { emptyCrmRecord } from "./schema.js";
import type { BatchInput } from "./providers.js";

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export function fallbackExtractBatch(rows: BatchInput) {
  const records: Array<CrmRecord & { source_row_number: number }> = [];
  const skipped: Array<{ source_row_number: number; reason: string }> = [];

  for (const row of rows) {
    const text = Object.values(row.data).join(" | ");
    const contactText = contactValues(row.data).join(" | ") || text;
    const emails = unique(text.match(emailRegex) ?? []);
    const phones = unique((contactText.match(phoneRegex) ?? []).map(normalizePhone).filter(isLikelyPhone));

    if (emails.length === 0 && phones.length === 0) {
      skipped.push({ source_row_number: row.rowNumber, reason: "No email or mobile number found." });
      continue;
    }

    const record = emptyCrmRecord() as CrmRecord & { source_row_number: number };
    record.source_row_number = row.rowNumber;
    record.email = emails[0] ?? "";

    const primaryPhone = phones[0] ?? "";
    if (primaryPhone.startsWith("91") && primaryPhone.length === 12) {
      record.country_code = "+91";
      record.mobile_without_country_code = primaryPhone.slice(2);
    } else if (primaryPhone.length === 10) {
      record.country_code = "+91";
      record.mobile_without_country_code = primaryPhone;
    } else {
      record.mobile_without_country_code = primaryPhone;
    }

    record.created_at = inferDate(row.data);
    record.name = pick(row.data, ["name", "full name", "full_name", "customer", "lead name", "contact name"]);
    record.company = pick(row.data, ["company", "organization", "business"]);
    record.city = pick(row.data, ["city", "location"]);
    record.lead_owner = pick(row.data, ["lead owner", "owner", "assigned to", "assigned_to"]);
    record.crm_status = inferStatus(text);
    record.data_source = inferSource(text);
    record.possession_time = pick(row.data, ["possession", "possession time", "possession_time"]);
    record.description = pick(row.data, ["description", "requirement", "interest", "property requirement"]);
    record.crm_note = buildNotes(row.data, emails.slice(1), phones.slice(1));

    records.push(record);
  }

  return { records, skipped };
}

function pick(row: Record<string, string>, names: string[]) {
  const normalized = Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[_-]/g, " ").trim(), value] as const);
  return normalized.find(([key, value]) => names.includes(key) && value)?.[1] ?? "";
}

function inferDate(row: Record<string, string>) {
  const value = pick(row, ["created at", "created time", "created_time", "timestamp", "date", "lead date"]);
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function inferStatus(text: string): CrmRecord["crm_status"] {
  const lower = text.toLowerCase();
  if (/(closed|won|sold|sale done|deal closed)/.test(lower)) return "SALE_DONE";
  if (/(not interested|junk|invalid|bad lead|remove)/.test(lower)) return "BAD_LEAD";
  if (/(busy|not reachable|did not connect|no answer|no response)/.test(lower)) return "DID_NOT_CONNECT";
  if (/(follow|new lead|interested|callback|call back|demo)/.test(lower)) return "GOOD_LEAD_FOLLOW_UP";
  return "";
}

function inferSource(text: string): CrmRecord["data_source"] {
  const lower = text.toLowerCase();
  if (lower.includes("meridian")) return "meridian_tower";
  if (lower.includes("eden")) return "eden_park";
  if (lower.includes("varah")) return "varah_swamy";
  if (lower.includes("sarjapur")) return "sarjapur_plots";
  if (lower.includes("leads on demand")) return "leads_on_demand";
  return "";
}

function buildNotes(row: Record<string, string>, extraEmails: string[], extraPhones: string[]) {
  const noteKeys = ["note", "notes", "remark", "remarks", "comment", "comments"];
  const notes = Object.entries(row)
    .filter(([key, value]) => noteKeys.some((needle) => key.toLowerCase().includes(needle)) && value)
    .map(([, value]) => value);
  if (extraEmails.length) notes.push(`Extra emails: ${extraEmails.join(", ")}`);
  if (extraPhones.length) notes.push(`Extra mobiles: ${extraPhones.join(", ")}`);
  return notes.join(" | ").replace(/\r?\n/g, "\\n");
}

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function isLikelyPhone(value: string) {
  if (value.length < 10 || value.length > 13) return false;
  if (/^(19|20)\d{6,}/.test(value)) return false;
  if (value.length === 12 && value.startsWith("91")) return true;
  if (value.length === 10 && /^[6-9]/.test(value)) return true;
  return value.length >= 10 && value.length <= 13;
}

function contactValues(row: Record<string, string>) {
  const keys = ["phone", "mobile", "contact", "whatsapp", "tel", "cell"];
  return Object.entries(row)
    .filter(([key, value]) => keys.some((needle) => key.toLowerCase().includes(needle)) && value)
    .map(([, value]) => value);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
