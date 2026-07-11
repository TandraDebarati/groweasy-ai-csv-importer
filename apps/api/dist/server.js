import "./config/env.js";
import express from "express";
import cors from "cors";
import multer from "multer";
import { parseCsvBuffer } from "./services/csv.js";
import { importRows } from "./services/importer.js";
const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }
});
app.use(cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => {
    const provider = process.env.AI_PROVIDER ?? "mock";
    const model = provider === "gemini"
        ? process.env.GEMINI_MODEL
        : provider === "openai"
            ? process.env.OPENAI_MODEL
            : provider === "anthropic" || provider === "claude"
                ? process.env.ANTHROPIC_MODEL
                : undefined;
    res.json({
        ok: true,
        provider,
        model,
        fallbackOnError: process.env.AI_FALLBACK_ON_ERROR !== "false"
    });
});
app.post("/api/import", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "CSV file is required." });
        }
        const parsed = parseCsvBuffer(req.file.buffer);
        if (parsed.rows.length === 0) {
            return res.status(400).json({ message: "CSV does not contain any data rows." });
        }
        const result = await importRows(parsed.rows);
        return res.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected import failure.";
        return res.status(500).json({ message });
    }
});
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    console.log(`GrowEasy API listening on http://localhost:${port}`);
});
