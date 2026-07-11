import { CRM_FIELDS, CRM_STATUSES, DATA_SOURCES } from "@groweasy/shared";
const cityStateMap = {
    mumbai: { city: "Mumbai", state: "Maharashtra", country: "India" },
    pune: { city: "Pune", state: "Maharashtra", country: "India" },
    bangalore: { city: "Bangalore", state: "Karnataka", country: "India" },
    bengaluru: { city: "Bangalore", state: "Karnataka", country: "India" },
    sarjapur: { city: "Bangalore", state: "Karnataka", country: "India" },
    delhi: { city: "Delhi", state: "Delhi", country: "India" },
    hyderabad: { city: "Hyderabad", state: "Telangana", country: "India" },
    chennai: { city: "Chennai", state: "Tamil Nadu", country: "India" },
    gurgaon: { city: "Gurugram", state: "Haryana", country: "India" },
    gurugram: { city: "Gurugram", state: "Haryana", country: "India" },
    noida: { city: "Noida", state: "Uttar Pradesh", country: "India" }
};
const weightedFields = ["name", "email", "mobile_without_country_code", "created_at", "crm_status", "data_source", "city", "state"];
export function normalizeRecord(record) {
    const normalized = {
        ...record,
        created_at: normalizeDate(record.created_at),
        name: clean(record.name),
        email: clean(record.email).toLowerCase(),
        country_code: clean(record.country_code),
        mobile_without_country_code: normalizeMobile(record.mobile_without_country_code),
        company: clean(record.company),
        city: clean(record.city),
        state: clean(record.state),
        country: clean(record.country),
        lead_owner: clean(record.lead_owner).toLowerCase(),
        crm_status: CRM_STATUSES.includes(record.crm_status) ? record.crm_status : "",
        crm_note: clean(record.crm_note).replace(/\r?\n/g, "\\n"),
        data_source: DATA_SOURCES.includes(record.data_source) ? record.data_source : "",
        possession_time: clean(record.possession_time),
        description: clean(record.description).replace(/\r?\n/g, "\\n")
    };
    applyLocationCleanup(normalized);
    if (normalized.mobile_without_country_code && !normalized.country_code && normalized.mobile_without_country_code.length === 10) {
        normalized.country_code = "+91";
    }
    return normalized;
}
export function assessRecord(record, rowNumber) {
    const presentFields = CRM_FIELDS.filter((field) => Boolean(record[field]));
    const missingFields = CRM_FIELDS.filter((field) => !record[field]);
    const weightedPresent = weightedFields.filter((field) => Boolean(record[field])).length;
    const completeness = Math.round((weightedPresent / weightedFields.length) * 100);
    const warnings = [];
    if (!record.email)
        warnings.push("Missing email");
    if (!record.mobile_without_country_code)
        warnings.push("Missing mobile");
    if (!record.crm_status)
        warnings.push("Status could not be confidently mapped");
    if (!record.data_source)
        warnings.push("Data source not confidently matched");
    if (record.created_at && Number.isNaN(new Date(record.created_at).getTime()))
        warnings.push("Date may need review");
    return {
        rowNumber,
        confidence: completeness >= 75 && warnings.length <= 1 ? "high" : completeness >= 50 ? "medium" : "low",
        completeness,
        presentFields,
        missingFields,
        warnings
    };
}
function applyLocationCleanup(record) {
    const text = `${record.city} ${record.state} ${record.description} ${record.crm_note}`.toLowerCase();
    const match = Object.keys(cityStateMap).find((place) => text.includes(place));
    if (!match)
        return;
    const inferred = cityStateMap[match];
    if (!record.city || record.city.toLowerCase() === match || record.state.toLowerCase() === inferred.city.toLowerCase()) {
        record.city = inferred.city;
    }
    if (!record.state || record.state.toLowerCase() === inferred.city.toLowerCase()) {
        record.state = inferred.state;
    }
    if (!record.country) {
        record.country = inferred.country;
    }
}
function normalizeDate(value) {
    const cleaned = clean(value);
    if (!cleaned)
        return "";
    const parsed = new Date(cleaned);
    return Number.isNaN(parsed.getTime()) ? cleaned : parsed.toISOString();
}
function normalizeMobile(value) {
    const digits = clean(value).replace(/[^\d]/g, "");
    if (digits.startsWith("91") && digits.length === 12)
        return digits.slice(2);
    return digits;
}
function clean(value) {
    return String(value ?? "").trim();
}
