import { logger } from "./logger";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const MODEL = "gpt-4o-mini";

// ── Shared types ───────────────────────────────────────────────────────

export type NormalizedStatus =
  | "investigating"
  | "vendor_engaged"
  | "dispatch_scheduled"
  | "awaiting_update"
  | "monitoring"
  | "resolved"
  | "unknown";

export const VALID_NORMALIZED_STATUSES: NormalizedStatus[] = [
  "investigating",
  "vendor_engaged",
  "dispatch_scheduled",
  "awaiting_update",
  "monitoring",
  "resolved",
  "unknown",
];

export interface SummarizeResult {
  summary: string;
  confidence: number;
  keyDetails: {
    impactedService: string | null;
    currentAction: string | null;
    vendorStatus: string | null;
  };
  sourceText: string;
}

export interface NormalizeResult {
  status: NormalizedStatus;
  confidence: number;
  reasoning: string;
  sourceText: string;
}

export interface CustomerUpdateResult {
  update: string;
  confidence: number;
  containsETA: boolean;
  sourceText: string;
}

// ── Manual JSON validators (no external dep needed) ────────────────────

function clampConfidence(val: unknown): number {
  const n = typeof val === "number" ? Math.round(val) : 0;
  return Math.max(0, Math.min(100, n));
}

function validateSummarizeResponse(raw: unknown): { summary: string; confidence: number; keyDetails: { impactedService: string | null; currentAction: string | null; vendorStatus: string | null } } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.summary !== "string" || r.summary.length < 5) return null;
  return {
    summary: r.summary,
    confidence: clampConfidence(r.confidence),
    keyDetails: {
      impactedService: typeof (r.keyDetails as any)?.impactedService === "string" ? (r.keyDetails as any).impactedService : null,
      currentAction: typeof (r.keyDetails as any)?.currentAction === "string" ? (r.keyDetails as any).currentAction : null,
      vendorStatus: typeof (r.keyDetails as any)?.vendorStatus === "string" ? (r.keyDetails as any).vendorStatus : null,
    },
  };
}

function validateNormalizeResponse(raw: unknown): { status: NormalizedStatus; confidence: number; reasoning: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const status = typeof r.status === "string" ? r.status.toLowerCase().trim() : "";
  if (!VALID_NORMALIZED_STATUSES.includes(status as NormalizedStatus)) return null;
  return {
    status: status as NormalizedStatus,
    confidence: clampConfidence(r.confidence),
    reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
  };
}

function validateCustomerUpdateResponse(raw: unknown): { update: string; confidence: number; containsETA: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.update !== "string" || r.update.length < 5) return null;
  return {
    update: r.update,
    confidence: clampConfidence(r.confidence),
    containsETA: r.containsETA === true,
  };
}

// ── Core OpenAI caller ─────────────────────────────────────────────────

const TELECOM_NOC_SYSTEM_PROMPT = `You are a senior NOC (Network Operations Center) analyst at a telecom managed services provider. You have deep expertise in:
- Fiber, Ethernet, and wireless circuit troubleshooting and escalation
- Major US telecom carriers: AT&T, Zayo, Lumen/CenturyLink, Cogent, Windstream, Spectrum, Comcast Business, Verizon Business, GTT, Frontier, TW Telecom
- Connectivity technologies: DIA (Dedicated Internet Access), MPLS/IPVPN, SD-WAN, broadband, 4G/5G fixed wireless
- Network protocols: BGP, OSPF, MPLS, VLAN, QoS — and how they relate to customer-visible outage symptoms
- CLEC/ILEC circuit provisioning, FOC dates, dispatch processes, and cable/fiber restoration workflows
- SLA management, escalation paths (NOC → Management → Executive), and vendor accountability
- Distinction between customer-facing communication (no jargon, no speculation) and internal analysis (precise, technical)

You always respond with valid JSON matching the requested schema. Never include markdown, code blocks, or extra text outside the JSON.`;

async function callOpenAIJson<T>(
  userPrompt: string,
  validate: (raw: unknown) => T | null,
  fallback: T
): Promise<T> {
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
      model: MODEL,
      messages: [
        { role: "system", content: TELECOM_NOC_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const rawText = data.choices[0]?.message?.content?.trim() ?? "";

  try {
    const parsed: unknown = JSON.parse(rawText);
    const validated = validate(parsed);
    if (validated !== null) {
      return validated;
    }
    logger.warn({ rawText }, "AI JSON response failed validation, using fallback");
    return fallback;
  } catch (parseErr) {
    logger.warn({ rawText, parseErr }, "AI response is not valid JSON, using fallback");
    return fallback;
  }
}

// ── Exported AI functions ──────────────────────────────────────────────

export async function summarizeTicket(params: {
  title: string;
  severity: string;
  status: string;
  outageType: string;
  description: string | null;
  vendorTicketId: string | null;
  circuitId: string | null;
  vendorName: string | null;
  updates: Array<{ updateType: string; rawText: string; createdAt: Date }>;
}): Promise<SummarizeResult> {
  const recentUpdates = params.updates.slice(-12);
  const updateText = recentUpdates
    .map(
      (u) =>
        `[${u.updateType.toUpperCase()} — ${new Date(u.createdAt).toISOString()}]\n${u.rawText}`
    )
    .join("\n\n");

  const sourceText = [
    `TITLE: ${params.title}`,
    `SEVERITY: ${params.severity} | STATUS: ${params.status} | OUTAGE TYPE: ${params.outageType}`,
    params.circuitId ? `CIRCUIT: ${params.circuitId} (${params.vendorName || "Unknown vendor"})` : "",
    params.vendorTicketId ? `VENDOR TICKET: ${params.vendorTicketId}` : "",
    `DESCRIPTION: ${params.description ?? "None provided"}`,
    `\nUPDATES:\n${updateText || "No updates yet"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Analyze this telecom trouble ticket and return a JSON summary.

Return EXACTLY this JSON structure (no extra fields, no markdown):
{
  "summary": "2-4 sentence executive summary for the ops team. Be specific: name the carrier, circuit ID, and vendor ticket number if present. State the current status and what actions have been taken. Do NOT speculate about root cause or ETAs unless explicitly stated.",
  "confidence": <integer 0-100: 90-100=rich detail with vendor updates, 70-89=some updates but gaps, 50-69=limited info, below 50=very sparse>,
  "keyDetails": {
    "impactedService": "Concise description of the affected circuit/service, or null",
    "currentAction": "What is currently being done to resolve this, or null",
    "vendorStatus": "What the vendor has communicated (their latest status/ETA if given), or null"
  }
}

${sourceText}`;

  try {
    const result = await callOpenAIJson(
      prompt,
      validateSummarizeResponse,
      {
        summary: `Ticket ${params.title} — AI summary unavailable due to validation error.`,
        confidence: 0,
        keyDetails: { impactedService: null, currentAction: null, vendorStatus: null },
      }
    );
    return {
      summary: result.summary,
      confidence: result.confidence,
      keyDetails: {
        impactedService: result.keyDetails?.impactedService ?? null,
        currentAction: result.keyDetails?.currentAction ?? null,
        vendorStatus: result.keyDetails?.vendorStatus ?? null,
      },
      sourceText,
    };
  } catch (err) {
    logger.error({ err }, "AI summarization failed");
    throw err;
  }
}

export async function normalizeStatus(params: {
  text: string;
  ticketSeverity?: string;
  ticketStatus?: string;
}): Promise<NormalizeResult> {
  const prompt = `Classify the following telecom trouble ticket update into exactly one normalized operational status.

Return EXACTLY this JSON structure (no extra fields, no markdown):
{
  "status": "<one of: investigating | vendor_engaged | dispatch_scheduled | awaiting_update | monitoring | resolved | unknown>",
  "confidence": <integer 0-100: higher when the text clearly matches a status, lower when ambiguous>,
  "reasoning": "One sentence explaining why you chose this status based on specific phrases in the text"
}

Status definitions (choose the MOST ADVANCED applicable status):
- investigating: Initial troubleshooting underway, collecting data, running tests — vendor not yet contacted
- vendor_engaged: Carrier/vendor has been notified and has acknowledged; a case is open; they are actively working; NOC is on the call
- dispatch_scheduled: A field technician, cable crew, or engineer has been physically dispatched or a site visit is confirmed scheduled
- awaiting_update: Explicitly waiting for vendor callback, ETR, test results, or information from another party
- monitoring: Issue appears stable or improved; watching for confirmation of full restoration; no further action pending
- resolved: Circuit/service confirmed restored; case is closing or closed; customer has confirmed restoration
- unknown: Insufficient information to classify — use only as last resort

Current ticket context:
- Severity: ${params.ticketSeverity ?? "unknown"}
- Current status in system: ${params.ticketStatus ?? "unknown"}

UPDATE TEXT TO CLASSIFY:
${params.text}`;

  try {
    const result = await callOpenAIJson(
      prompt,
      validateNormalizeResponse,
      { status: "unknown" as NormalizedStatus, confidence: 0, reasoning: "Validation failed" }
    );
    return {
      status: result.status,
      confidence: result.confidence,
      reasoning: result.reasoning ?? "",
      sourceText: params.text,
    };
  } catch (err) {
    logger.error({ err }, "AI status normalization failed");
    throw err;
  }
}

export async function generateCustomerUpdate(params: {
  title: string;
  severity: string;
  currentStatus: string;
  aiNormalizedStatus: string | null;
  updates: Array<{ updateType: string; rawText: string; visibility: string; createdAt: Date }>;
}): Promise<CustomerUpdateResult> {
  // Only use recent, meaningful updates as source material — prefer visible updates but include internal context
  const sourceUpdates = params.updates
    .filter((u) => u.updateType !== "system_event" && u.updateType !== "ai_generated")
    .slice(-8)
    .map((u) => `[${u.updateType.toUpperCase()}] ${u.rawText}`)
    .join("\n\n");

  const sourceText = [
    `TICKET: ${params.title}`,
    `SEVERITY: ${params.severity} | STATUS: ${params.currentStatus} | OPERATIONAL STATUS: ${params.aiNormalizedStatus ?? "unknown"}`,
    `\nSOURCE UPDATES:\n${sourceUpdates || "No updates available"}`,
  ].join("\n");

  const prompt = `Write a professional, customer-facing status update for a telecom service disruption.

Return EXACTLY this JSON structure (no extra fields, no markdown):
{
  "update": "The complete customer-facing message — 2-4 sentences, professional tone",
  "confidence": <integer 0-100: how well the available source material supports a useful customer update>,
  "containsETA": <true ONLY if you included a specific time/date/ETA in the update text, false otherwise>
}

MANDATORY RULES:
1. NEVER mention a specific ETA or restoration time unless those exact words/times appear verbatim in the source updates — if no ETA exists, say "we will continue to provide updates" instead
2. NEVER use technical jargon: no BGP, OSPF, DWDM, MPLS, LOS, CPE, hand-off, or carrier acronyms
3. NEVER speculate about root cause unless explicitly stated
4. NEVER use alarming language — keep tone calm, professional, and in control
5. Always acknowledge the service impact from the customer's perspective
6. Always end with a commitment: when you will provide the next update, or that the team is actively monitoring
7. Do NOT start with "We apologize" or excessive apologetic language — focus on facts and next steps
8. If the situation is critical or the SLA is breaching, communicate urgency without panic

GOOD EXAMPLE: "We are actively working with your carrier to restore connectivity at [Site]. A field technician is currently on-site investigating. We will provide you with an update within the next 30 minutes."

BAD EXAMPLE: "We're so sorry your BGP session dropped and the OSPF adjacency went down. We think it might be a fiber cut but we're not sure. We'll fix it soon."

${sourceText}`;

  try {
    const result = await callOpenAIJson(
      prompt,
      validateCustomerUpdateResponse,
      {
        update: "We are actively investigating the reported service disruption and will provide an update shortly.",
        confidence: 0,
        containsETA: false,
      }
    );
    return {
      update: result.update,
      confidence: result.confidence,
      containsETA: result.containsETA,
      sourceText,
    };
  } catch (err) {
    logger.error({ err }, "AI customer update generation failed");
    throw err;
  }
}

// ── AI test function (admin panel) ─────────────────────────────────────

export async function testNormalization(text: string): Promise<NormalizeResult> {
  return normalizeStatus({ text });
}
