import Papa from "papaparse";
export function parseCsvBuffer(buffer) {
    const csv = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const parsed = Papa.parse(csv, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim()
    });
    if (parsed.errors.length > 0) {
        const first = parsed.errors[0];
        throw new Error(`CSV parse error on row ${first.row ?? "unknown"}: ${first.message}`);
    }
    const rows = parsed.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim().length > 0));
    return {
        rows,
        fields: parsed.meta.fields ?? []
    };
}
