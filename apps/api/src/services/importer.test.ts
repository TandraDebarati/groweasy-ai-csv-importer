import { describe, expect, it, vi } from "vitest";
import { fallbackExtractBatch } from "./fallbackExtractor.js";
import { importRows } from "./importer.js";

vi.mock("./providers.js", () => ({
  extractBatch: vi.fn((rows) => Promise.resolve(fallbackExtractBatch(rows))),
  getProviderRuntime: vi.fn(() => ({
    provider: "mock",
    model: "local-fallback",
    usedFallback: true
  }))
}));

describe("importRows", () => {
  it("imports valid rows and skips rows without contact details", async () => {
    const result = await importRows([
      {
        Timestamp: "2026-05-13T14:20:48+05:30",
        Customer: "John Doe",
        Contact: "+91 9876543210",
        Email: "john@example.com",
        City: "Mumbai",
        Campaign: "Meridian Tower",
        Status: "follow up"
      },
      {
        Customer: "No Contact",
        Notes: "Missing phone and email"
      }
    ]);

    expect(result.summary.totalRows).toBe(2);
    expect(result.summary.totalImported).toBe(1);
    expect(result.summary.totalSkipped).toBe(1);
    expect(result.records[0].data_source).toBe("meridian_tower");
    expect(result.records[0].crm_status).toBe("GOOD_LEAD_FOLLOW_UP");
    expect(result.records[0].mobile_without_country_code).toBe("9876543210");
    expect(result.records[0].state).toBe("Maharashtra");
    expect(result.quality[0].confidence).toMatch(/high|medium|low/);
    expect(result.summary.averageCompleteness).toBeGreaterThan(0);
    expect(result.meta.usedFallback).toBe(true);
  });

  it("moves extra contact data into notes", () => {
    const result = fallbackExtractBatch([
      {
        rowNumber: 1,
        data: {
          Name: "Sarah",
          Contact: "+91 9876543211, +91 9000011111",
          Emails: "sarah@example.com; sarah.work@example.com",
          Remarks: "Busy"
        }
      }
    ]);

    expect(result.records[0].email).toBe("sarah@example.com");
    expect(result.records[0].crm_note).toContain("sarah.work@example.com");
    expect(result.records[0].crm_note).toContain("9000011111");
    expect(result.records[0].crm_status).toBe("DID_NOT_CONNECT");
  });
});
