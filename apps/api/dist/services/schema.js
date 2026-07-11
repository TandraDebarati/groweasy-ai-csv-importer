import { CRM_STATUSES, DATA_SOURCES } from "@groweasy/shared";
import { z } from "zod";
export const crmRecordSchema = z.object({
    created_at: z.string().default(""),
    name: z.string().default(""),
    email: z.string().default(""),
    country_code: z.string().default(""),
    mobile_without_country_code: z.string().default(""),
    company: z.string().default(""),
    city: z.string().default(""),
    state: z.string().default(""),
    country: z.string().default(""),
    lead_owner: z.string().default(""),
    crm_status: z.union([z.enum(CRM_STATUSES), z.literal("")]).default(""),
    crm_note: z.string().default(""),
    data_source: z.union([z.enum(DATA_SOURCES), z.literal("")]).default(""),
    possession_time: z.string().default(""),
    description: z.string().default("")
});
export const aiBatchSchema = z.object({
    records: z.array(crmRecordSchema.extend({
        source_row_number: z.number()
    })),
    skipped: z.array(z.object({
        source_row_number: z.number(),
        reason: z.string()
    }))
});
export function emptyCrmRecord() {
    return {
        created_at: "",
        name: "",
        email: "",
        country_code: "",
        mobile_without_country_code: "",
        company: "",
        city: "",
        state: "",
        country: "",
        lead_owner: "",
        crm_status: "",
        crm_note: "",
        data_source: "",
        possession_time: "",
        description: ""
    };
}
