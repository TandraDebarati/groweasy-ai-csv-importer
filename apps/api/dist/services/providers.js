import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { buildExtractionPrompt } from "./prompt.js";
import { fallbackExtractBatch } from "./fallbackExtractor.js";
import { aiBatchSchema } from "./schema.js";
let aiCircuitOpenUntil = 0;
let lastProviderUsedFallback = false;
export async function extractBatch(rows) {
    const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
    lastProviderUsedFallback = false;
    if (provider === "mock") {
        lastProviderUsedFallback = true;
        return fallbackExtractBatch(rows);
    }
    if (Date.now() < aiCircuitOpenUntil) {
        lastProviderUsedFallback = true;
        return fallbackExtractBatch(rows);
    }
    try {
        if (provider === "openai")
            return await extractWithOpenAi(rows);
        if (provider === "gemini")
            return await extractWithGemini(rows);
        if (provider === "anthropic" || provider === "claude")
            return await extractWithAnthropic(rows);
        return fallbackExtractBatch(rows);
    }
    catch (error) {
        if (process.env.AI_FALLBACK_ON_ERROR !== "false") {
            if (isQuotaError(error)) {
                aiCircuitOpenUntil = Date.now() + getQuotaCooldownMs(error);
            }
            lastProviderUsedFallback = true;
            console.warn(`AI provider unavailable; using local fallback extractor. ${formatAiError(error)}`);
            return fallbackExtractBatch(rows);
        }
        throw new Error(formatAiError(error));
    }
}
export function getProviderRuntime() {
    const provider = process.env.AI_PROVIDER ?? "mock";
    const model = provider === "gemini"
        ? process.env.GEMINI_MODEL ?? "gemini-flash-latest"
        : provider === "openai"
            ? process.env.OPENAI_MODEL ?? "gpt-4o-mini"
            : provider === "anthropic" || provider === "claude"
                ? process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest"
                : "local-fallback";
    return {
        provider,
        model,
        usedFallback: lastProviderUsedFallback || provider === "mock"
    };
}
async function extractWithOpenAi(rows) {
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
        defaultHeaders: buildOpenAiCompatibleHeaders()
    });
    const isOpenRouter = process.env.OPENAI_BASE_URL?.includes("openrouter.ai") ?? false;
    const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        max_tokens: Number(process.env.OPENAI_MAX_TOKENS ?? 4096),
        ...(isOpenRouter ? {} : { response_format: { type: "json_object" } }),
        messages: [
            {
                role: "system",
                content: "Return only one valid JSON object. Do not include markdown, explanations, introductions, or code fences."
            },
            { role: "user", content: buildExtractionPrompt(rows) }
        ]
    });
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error(`AI provider returned no message content. Raw response: ${JSON.stringify(completion).slice(0, 600)}`);
    }
    return parseAiJson(content);
}
function buildOpenAiCompatibleHeaders() {
    if (!process.env.OPENAI_BASE_URL?.includes("openrouter.ai"))
        return undefined;
    return {
        "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
        "X-Title": process.env.APP_NAME ?? "GrowEasy AI CSV Importer"
    };
}
async function extractWithGemini(rows) {
    const key = process.env.GEMINI_API_KEY;
    if (!key)
        throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini.");
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = buildExtractionPrompt(rows);
    const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash";
    const response = await generateGeminiContent(ai, model, prompt).catch(async (error) => {
        if (model !== fallbackModel && isUnavailableModelError(error)) {
            console.warn(`Gemini model ${model} is unavailable. Retrying with ${fallbackModel}.`);
            return generateGeminiContent(ai, fallbackModel, prompt);
        }
        throw error;
    });
    return parseAiJson(response.text ?? "");
}
function generateGeminiContent(ai, model, contents) {
    return ai.models.generateContent({
        model,
        contents,
        config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: geminiBatchResponseSchema
        }
    });
}
const geminiBatchResponseSchema = {
    type: "object",
    properties: {
        records: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    source_row_number: { type: "number" },
                    created_at: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                    country_code: { type: "string" },
                    mobile_without_country_code: { type: "string" },
                    company: { type: "string" },
                    city: { type: "string" },
                    state: { type: "string" },
                    country: { type: "string" },
                    lead_owner: { type: "string" },
                    crm_status: { type: "string" },
                    crm_note: { type: "string" },
                    data_source: { type: "string" },
                    possession_time: { type: "string" },
                    description: { type: "string" }
                },
                required: [
                    "source_row_number",
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
                ]
            }
        },
        skipped: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    source_row_number: { type: "number" },
                    reason: { type: "string" }
                },
                required: ["source_row_number", "reason"]
            }
        }
    },
    required: ["records", "skipped"]
};
async function extractWithAnthropic(rows) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key)
        throw new Error("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic.");
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: "user", content: buildExtractionPrompt(rows) }]
    });
    const text = response.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("");
    return parseAiJson(text);
}
function parseAiJson(text) {
    const jsonText = extractJsonObject(text);
    const parsed = JSON.parse(jsonText);
    return aiBatchSchema.parse(parsed);
}
function extractJsonObject(text) {
    const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}"))
        return trimmed;
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start)
        return trimmed.slice(start, end + 1);
    return trimmed;
}
function formatAiError(error) {
    if (error instanceof Error) {
        if (isQuotaError(error)) {
            return "AI quota exceeded. Temporarily using local fallback. For local testing, set AI_PROVIDER=mock; for production, enable billing or use a key with higher quota.";
        }
        if (isUnavailableModelError(error)) {
            return "Selected Gemini model is unavailable for this API key. Try gemini-2.5-flash, gemini-3.5-flash, or set AI_PROVIDER=mock for local testing.";
        }
        return error.message;
    }
    return "Unknown AI provider error.";
}
function isUnavailableModelError(error) {
    return error instanceof Error && (error.message.includes("NOT_FOUND") || error.message.includes("404"));
}
function isQuotaError(error) {
    return error instanceof Error && (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("429"));
}
function getQuotaCooldownMs(error) {
    if (!(error instanceof Error))
        return 60_000;
    const retryDelay = error.message.match(/retryDelay"?\s*:\s*"?(\d+)s/i);
    if (retryDelay?.[1])
        return Number(retryDelay[1]) * 1000;
    const retryIn = error.message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
    if (retryIn?.[1])
        return Math.ceil(Number(retryIn[1]) * 1000);
    return 60_000;
}
