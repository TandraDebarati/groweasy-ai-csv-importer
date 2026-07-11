import { extractBatch, getProviderRuntime } from "./providers.js";
import { assessRecord, normalizeRecord } from "./postProcess.js";
import { crmRecordSchema } from "./schema.js";
const BATCH_SIZE = 50;
const MAX_RETRIES = 2;
export async function importRows(rows) {
    const startedAt = Date.now();
    const records = [];
    const quality = [];
    const skipped = [];
    const numbered = rows.map((data, index) => ({ rowNumber: index + 1, data }));
    let usedFallback = false;
    let batchesProcessed = 0;
    for (let index = 0; index < numbered.length; index += BATCH_SIZE) {
        const batch = numbered.slice(index, index + BATCH_SIZE);
        const result = await withRetry(() => extractBatch(batch));
        const runtime = getProviderRuntime();
        usedFallback = usedFallback || runtime.usedFallback;
        batchesProcessed += 1;
        for (const record of result.records) {
            const { source_row_number: _sourceRowNumber, ...crmRecord } = record;
            const parsed = crmRecordSchema.parse(normalizeRecord(crmRecord));
            if (!parsed.email && !parsed.mobile_without_country_code) {
                skipped.push({
                    rowNumber: record.source_row_number,
                    reason: "AI output did not include email or mobile number.",
                    original: numbered[record.source_row_number - 1]?.data ?? {}
                });
            }
            else {
                records.push(parsed);
                quality.push(assessRecord(parsed, record.source_row_number));
            }
        }
        for (const item of result.skipped) {
            skipped.push({
                rowNumber: item.source_row_number,
                reason: item.reason,
                original: numbered[item.source_row_number - 1]?.data ?? {}
            });
        }
    }
    const averageCompleteness = quality.length > 0 ? Math.round(quality.reduce((sum, item) => sum + item.completeness, 0) / quality.length) : 0;
    const runtime = getProviderRuntime();
    return {
        records,
        quality,
        skipped,
        meta: {
            provider: runtime.provider,
            model: runtime.model,
            usedFallback,
            batchSize: BATCH_SIZE,
            batchesProcessed,
            processedAt: new Date().toISOString(),
            processingMs: Date.now() - startedAt
        },
        summary: {
            totalRows: rows.length,
            totalImported: records.length,
            totalSkipped: skipped.length,
            averageCompleteness
        }
    };
}
async function withRetry(operation) {
    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt < MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}
