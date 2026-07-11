"use client";

import type { CrmRecord, ImportResponse } from "@groweasy/shared";
import { CRM_FIELDS } from "@groweasy/shared";
import {
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  Loader2,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud
} from "lucide-react";
import Papa from "papaparse";
import { useMemo, useState } from "react";

type PreviewRow = Record<string, string>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const previewLimit = 1000;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dark, setDark] = useState(false);
  const [progressText, setProgressText] = useState("Waiting for CSV");

  const previewStats = useMemo(
    () => ({
      rows: previewRows.length,
      columns: headers.length,
      fileSize: file ? `${(file.size / 1024).toFixed(1)} KB` : "0 KB"
    }),
    [file, headers.length, previewRows.length]
  );

  async function handleFile(nextFile: File) {
    setError("");
    setResult(null);
    setFile(nextFile);
    setIsParsing(true);
    setProgressText("Parsing CSV locally");

    Papa.parse<PreviewRow>(nextFile, {
      header: true,
      skipEmptyLines: "greedy",
      preview: previewLimit,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (parsed) => {
        setHeaders(parsed.meta.fields ?? []);
        setPreviewRows(parsed.data);
        setIsParsing(false);
        setProgressText("Preview ready");
      },
      error: (parseError) => {
        setError(parseError.message);
        setIsParsing(false);
        setProgressText("CSV parse failed");
      }
    });
  }

  async function confirmImport() {
    if (!file) return;
    setIsImporting(true);
    setError("");
    setResult(null);
    setProgressText("Uploading CSV to backend");

    try {
      const form = new FormData();
      form.append("file", file);
      setProgressText("AI extraction running in batches");
      const response = await fetch(`${API_URL}/api/import`, {
        method: "POST",
        body: form
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Import failed.");
      setResult(data);
      setProgressText(data.meta?.usedFallback ? "Imported with fallback safety" : "Imported with AI extraction");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
      setProgressText("Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreviewRows([]);
    setHeaders([]);
    setResult(null);
    setError("");
    setProgressText("Waiting for CSV");
  }

  return (
    <main className={dark ? "app dark" : "app"}>
      <section className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">GrowEasy Assignment</p>
            <h1>AI CSV Importer</h1>
          </div>
          <button className="iconButton" onClick={() => setDark((value) => !value)} aria-label="Toggle dark mode" title="Toggle dark mode">
            <Moon size={18} />
          </button>
        </header>

        <section className="workspace">
          <aside className="side">
            <div
              className="dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) void handleFile(dropped);
              }}
            >
              <UploadCloud size={30} />
              <strong>Drop CSV here</strong>
              <span>or choose a file to preview first</span>
              <label className="primaryButton">
                <FileSpreadsheet size={17} />
                Select CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) void handleFile(selected);
                  }}
                />
              </label>
            </div>

            <div className="metricGrid">
              <Metric label="Rows" value={previewStats.rows.toLocaleString()} />
              <Metric label="Columns" value={previewStats.columns.toLocaleString()} />
              <Metric label="Size" value={previewStats.fileSize} />
            </div>

            <div className="statusBox">
              <Info size={16} />
              <span>{progressText}</span>
            </div>

            <div className="actions">
              <button className="primaryButton" disabled={!file || isParsing || isImporting} onClick={confirmImport}>
                {isImporting ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
                Confirm Import
              </button>
              <button className="secondaryButton" disabled={!file || isImporting} onClick={reset}>
                <RotateCcw size={16} />
                Reset
              </button>
            </div>

            {isImporting && (
              <div className="progress">
                <span />
              </div>
            )}
          </aside>

          <section className="mainPanel">
            {error && <div className="error">{error}</div>}
            <PanelTitle
              icon={<FileSpreadsheet size={18} />}
              title="Upload Preview"
              subtitle={file ? `${file.name} · previewing up to ${previewLimit.toLocaleString()} rows` : "No AI call happens until you confirm"}
            />
            <DataTable headers={headers} rows={previewRows} emptyText={isParsing ? "Parsing CSV..." : "Upload a CSV to preview rows"} />
          </section>
        </section>

        {result && <Results result={result} />}
      </section>
    </main>
  );
}

function Results({ result }: { result: ImportResponse }) {
  const qualityRows = result.quality.map((row) => ({
    rowNumber: row.rowNumber,
    confidence: row.confidence,
    completeness: `${row.completeness}%`,
    presentFields: row.presentFields.join(", "),
    warnings: row.warnings.join(" | ") || "Ready"
  }));

  return (
    <section className="results">
      <div className="resultHeader">
        <PanelTitle
          icon={<CheckCircle2 size={18} />}
          title="Parsed CRM Records"
          subtitle={`${result.summary.totalImported} imported, ${result.summary.totalSkipped} skipped from ${result.summary.totalRows} rows`}
        />
        <div className="downloadActions">
          <button className="secondaryButton" onClick={() => downloadCsv(result.records)}>
            <Download size={16} />
            CRM CSV
          </button>
          <button className="secondaryButton" onClick={() => downloadJson(result)}>
            <FileJson size={16} />
            JSON
          </button>
        </div>
      </div>

      <div className="summary">
        <Metric label="Imported" value={result.summary.totalImported.toLocaleString()} />
        <Metric label="Skipped" value={result.summary.totalSkipped.toLocaleString()} />
        <Metric label="Completeness" value={`${result.summary.averageCompleteness}%`} />
        <Metric label="Batches" value={result.meta.batchesProcessed.toLocaleString()} />
      </div>

      <div className={result.meta.usedFallback ? "notice warning" : "notice"}>
        <ShieldCheck size={17} />
        <span>
          Provider: {result.meta.provider} · Model: {result.meta.model} · {result.meta.usedFallback ? "fallback safety used" : "AI extraction completed"} ·{" "}
          {result.meta.processingMs}ms
        </span>
      </div>

      <DataTable headers={[...CRM_FIELDS]} rows={result.records} emptyText="No parsed records returned" />

      <PanelTitle icon={<ShieldCheck size={18} />} title="Extraction Quality" subtitle="Confidence, field coverage, and values that may need review" />
      <DataTable headers={["rowNumber", "confidence", "completeness", "presentFields", "warnings"]} rows={qualityRows} emptyText="No quality data" />

      {result.skipped.length > 0 && (
        <>
          <PanelTitle icon={<RotateCcw size={18} />} title="Skipped Records" subtitle="Rows without usable contact details or invalid AI output" />
          <DataTable
            headers={["rowNumber", "reason", "original"]}
            rows={result.skipped.map((row) => ({
              rowNumber: String(row.rowNumber),
              reason: row.reason,
              original: JSON.stringify(row.original)
            }))}
            emptyText="No skipped rows"
          />
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="panelTitle">
      <div className="titleIcon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyText
}: {
  headers: readonly string[];
  rows: Array<Record<string, unknown>>;
  emptyText: string;
}) {
  const renderedRows = rows.slice(0, 300);
  if (headers.length === 0 || rows.length === 0) {
    return <div className="emptyState">{emptyText}</div>;
  }

  return (
    <div className="tableShell">
      {rows.length > renderedRows.length && <div className="tableNote">Showing first {renderedRows.length.toLocaleString()} rows for browser performance.</div>}
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderedRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((header) => (
                  <td key={header}>{String(row[header] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function downloadCsv(records: CrmRecord[]) {
  const csv = Papa.unparse(records, {
    columns: [...CRM_FIELDS],
    quotes: true,
    newline: "\n"
  });
  downloadBlob(csv, "groweasy-crm-records.csv", "text/csv;charset=utf-8");
}

function downloadJson(result: ImportResponse) {
  downloadBlob(JSON.stringify(result, null, 2), "groweasy-import-result.json", "application/json");
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
