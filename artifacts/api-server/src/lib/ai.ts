import { logger } from "./logger";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = "https://api.openai.com/v1";

type NormalizedStatus =
  | "investigating"
  | "vendor_engaged"
  | "dispatch_scheduled"
  | "awaiting_update"
  | "monitoring"
  | "resolved"
  | "unknown";

async function callOpenAI(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content?.trim() ?? "";
}

export async function summarizeTicket(params: {
  title: string;
  description: string | null;
  updates: Array<{ updateType: string; rawText: string; createdAt: Date }>;
}): Promise<string> {
  const updateText = params.updates
    .slice(-10)
    .map((u) => `[${u.updateType}] ${u.rawText}`)
    .join("\n");

  const prompt = `You are a telecom operations specialist. Summarize the following trouble ticket for the internal ops team. Be concise (2-4 sentences). Focus on current status, impact, and what actions have been taken. Do NOT speculate about root cause or ETAs unless explicitly stated in the updates. If uncertain, say so.

TICKET TITLE: ${params.title}
DESCRIPTION: ${params.description ?? "No description provided"}
RECENT UPDATES:
${updateText || "No updates yet"}

Provide a concise operational summary:`;

  try {
    return await callOpenAI(prompt);
  } catch (err) {
    logger.error({ err }, "AI summarization failed");
    throw err;
  }
}

export async function normalizeStatus(text: string): Promise<NormalizedStatus> {
  const prompt = `You are a telecom operations expert. Analyze the following update text from a vendor or engineer and classify it into EXACTLY ONE of these normalized statuses:
- investigating: Initial troubleshooting, gathering data, running tests
- vendor_engaged: Carrier/vendor has been contacted or is actively working the issue
- dispatch_scheduled: A technician dispatch or field visit has been scheduled
- awaiting_update: Waiting for information from vendor, customer, or another team
- monitoring: Issue appears resolved or improved, watching for stability
- resolved: Issue is confirmed resolved, service restored
- unknown: Cannot determine status from the text

Respond with ONLY the status keyword, nothing else.

UPDATE TEXT:
${text}

Status:`;

  try {
    const result = await callOpenAI(prompt);
    const cleaned = result.toLowerCase().trim();
    const validStatuses: NormalizedStatus[] = [
      "investigating",
      "vendor_engaged",
      "dispatch_scheduled",
      "awaiting_update",
      "monitoring",
      "resolved",
      "unknown",
    ];
    return validStatuses.includes(cleaned as NormalizedStatus)
      ? (cleaned as NormalizedStatus)
      : "unknown";
  } catch (err) {
    logger.error({ err }, "AI status normalization failed");
    throw err;
  }
}

export async function generateCustomerUpdate(params: {
  title: string;
  currentStatus: string;
  aiNormalizedStatus: string | null;
  updates: Array<{ updateType: string; rawText: string; visibility: string }>;
}): Promise<string> {
  const customerVisibleUpdates = params.updates
    .filter((u) => u.visibility === "customer")
    .slice(-5)
    .map((u) => u.rawText)
    .join("\n");

  const prompt = `You are a professional telecom service manager writing a customer-facing update. Write a brief, professional status update (2-3 sentences) for the customer. Be calm and factual. Do NOT over-promise, fabricate ETAs, or speculate about root cause. If the situation is uncertain, say so professionally. Do NOT use technical jargon the customer wouldn't understand.

TICKET: ${params.title}
CURRENT STATUS: ${params.currentStatus}
NORMALIZED STATUS: ${params.aiNormalizedStatus ?? "unknown"}
RECENT CUSTOMER-VISIBLE UPDATES:
${customerVisibleUpdates || "No customer updates yet"}

Customer-facing update:`;

  try {
    return await callOpenAI(prompt);
  } catch (err) {
    logger.error({ err }, "AI customer update generation failed");
    throw err;
  }
}
