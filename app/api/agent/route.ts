import type Anthropic from "@anthropic-ai/sdk";
import type { Task, TaskStatus, ChatMessage } from "@/lib/agent-types";
import {
  dbConfigured,
  createWorkspace,
  insertTasks,
} from "@/lib/supabase-rest";
import { getAnthropic, aiConfigured, MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";

const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Design",
  "Support",
  "Operations",
  "Finance",
  "Legal",
] as const;

const VALID_STATUSES: TaskStatus[] = ["todo", "running", "needs_action", "done"];

const SYSTEM_PROMPT = `You are "Cofounder" — a superoptimizer manager agent that runs an entire company autonomously on the user's behalf.

You operate the company as a set of specialized departments, each staffed by agentic workers you can spin up on demand:
- Engineering — builds and ships the product, infrastructure, and integrations.
- Sales — outbound, pipeline, demos, and closing.
- Marketing — positioning, content, growth, and paid acquisition.
- Design — brand, product UI/UX, and visual identity.
- Support — customer success, onboarding, and helpdesk.
- Operations — logistics, vendor management, and internal process.
- Finance — accounting, fundraising, runway, and modeling.
- Legal — incorporation, contracts, compliance, and IP.

When the user gives you a goal, you act as the manager who decomposes it into concrete, parallelizable TASKS and dispatches each to the right department. You keep a human in the loop: tasks that could be risky or need a decision are marked "needs_action".

Behavior on every turn:
1. Briefly acknowledge the goal in one or two warm, confident sentences (no fluff, no markdown headers).
2. Propose a focused set of 3–6 concrete tasks to spin up across the relevant departments.

Each task has:
- title: short imperative phrase (e.g. "Draft launch announcement").
- department: EXACTLY one of [Engineering, Sales, Marketing, Design, Support, Operations, Finance, Legal].
- status: one of "todo" | "running" | "needs_action" | "done". Use "running" for things you can start immediately and "needs_action" when you need the user's approval or input.
- detail: one sentence on what the agent will actually do.

CRITICAL OUTPUT FORMAT:
End your reply with a single fenced code block tagged json containing exactly this shape and nothing else inside it:

\`\`\`json
{
  "reply": "your conversational acknowledgement here",
  "tasks": [
    { "title": "...", "department": "Engineering", "status": "running", "detail": "..." }
  ]
}
\`\`\`

The "reply" field must mirror your acknowledgement. The "tasks" array must be valid JSON. Do not include any other code block. Do not wrap the JSON in additional prose after the block.`;

interface AgentBody {
  messages?: ChatMessage[];
  companyContext?: string;
  workspaceId?: string;
}

interface AgentResult {
  reply: string;
  tasks: Omit<Task, "id">[];
}

function makeId(): string {
  return `t_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceStatus(value: unknown): TaskStatus {
  return VALID_STATUSES.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : "todo";
}

function coerceDepartment(value: unknown): string {
  if (typeof value === "string") {
    const match = DEPARTMENTS.find(
      (d) => d.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) return match;
  }
  return "Operations";
}

/** Extract and parse the trailing ```json fenced block from a model reply. */
function parseAgentJson(text: string): AgentResult | null {
  const fenceMatch =
    text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  try {
    const parsed = JSON.parse(raw.trim());
    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    return {
      reply:
        typeof parsed?.reply === "string" && parsed.reply.trim()
          ? parsed.reply.trim()
          : text.replace(/```[\s\S]*?```/g, "").trim(),
      tasks: tasks.map((t: Record<string, unknown>) => ({
        title:
          typeof t?.title === "string" && t.title.trim()
            ? t.title.trim()
            : "Untitled task",
        department: coerceDepartment(t?.department),
        status: coerceStatus(t?.status),
        detail: typeof t?.detail === "string" ? t.detail.trim() : "",
      })),
    };
  } catch {
    return null;
  }
}

/** Deterministic fallback so the UI always works without an API key. */
function mockResult(lastUserMessage: string): AgentResult {
  const goal = lastUserMessage.trim() || "your new company";
  const short = goal.length > 60 ? `${goal.slice(0, 57)}…` : goal;

  const tasks: Omit<Task, "id">[] = [
    {
      title: "Scaffold the product codebase",
      department: "Engineering",
      status: "running",
      detail: `Stand up the repo, CI, and a deployable skeleton for "${short}".`,
    },
    {
      title: "Define brand & visual identity",
      department: "Design",
      status: "running",
      detail: "Draft a logo direction, color palette, and landing-page layout.",
    },
    {
      title: "Build the go-to-market message",
      department: "Marketing",
      status: "todo",
      detail: "Write positioning, a one-liner, and the launch announcement.",
    },
    {
      title: "Open early sales pipeline",
      department: "Sales",
      status: "todo",
      detail: "Assemble an initial prospect list and outreach sequence.",
    },
    {
      title: "Incorporate the company",
      department: "Legal",
      status: "needs_action",
      detail: "Prepare LLC filing — needs your approval before submitting.",
    },
  ];

  return {
    reply: `On it. I've broken "${short}" into a starter plan and spun up agents across Engineering, Design, Marketing, Sales, and Legal. A couple of items need your sign-off before they ship.`,
    tasks,
  };
}

function withIds(result: AgentResult): { reply: string; tasks: Task[] } {
  return {
    reply: result.reply,
    tasks: result.tasks.map((t) => ({ ...t, id: makeId() })),
  };
}

/**
 * Persist the generated plan to Postgres (creating the workspace on first turn)
 * and return DB-backed tasks with real ids. Falls back to in-memory ids if the
 * database isn't configured or a write fails — the UI always gets a valid shape.
 */
async function finalize(
  result: AgentResult,
  opts: { mock: boolean; workspaceId?: string; idea: string },
): Promise<Response> {
  if (dbConfigured) {
    try {
      const workspaceId =
        opts.workspaceId ||
        (await createWorkspace(opts.idea || "Untitled company", opts.idea));
      const tasks = await insertTasks(workspaceId, result.tasks);
      return Response.json({
        reply: result.reply,
        tasks,
        workspaceId,
        mock: opts.mock,
        persisted: true,
      });
    } catch {
      // fall through to in-memory
    }
  }
  const { reply, tasks } = withIds(result);
  return Response.json({ reply, tasks, mock: opts.mock, persisted: false });
}

export async function POST(req: Request): Promise<Response> {
  let body: AgentBody = {};
  try {
    body = (await req.json()) as AgentBody;
  } catch {
    body = {};
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser =
    [...messages].reverse().find((m) => m?.role === "user")?.content ?? "";

  // No credentials -> deterministic mock so the demo always works.
  const client = getAnthropic();
  if (!aiConfigured || !client) {
    return finalize(mockResult(lastUser), {
      mock: true,
      workspaceId: body.workspaceId,
      idea: lastUser,
    });
  }

  try {
    const contextSuffix = body.companyContext
      ? `\n\nCurrent company context:\n${body.companyContext}`
      : "";

    const apiMessages: Anthropic.MessageParam[] = messages
      .filter(
        (m) =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m?.content === "string",
      )
      .map((m) => ({ role: m.role, content: m.content }));

    if (apiMessages.length === 0) {
      apiMessages.push({ role: "user", content: lastUser || "Get started." });
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT + contextSuffix,
          // Prompt caching on the (large, stable) system prompt.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: apiMessages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const parsed = parseAgentJson(text);
    if (!parsed) {
      // Model replied but JSON was unparseable — fall back gracefully.
      const fallback = mockResult(lastUser);
      return finalize(
        { reply: text || fallback.reply, tasks: fallback.tasks },
        { mock: true, workspaceId: body.workspaceId, idea: lastUser },
      );
    }

    return finalize(parsed, {
      mock: false,
      workspaceId: body.workspaceId,
      idea: lastUser,
    });
  } catch {
    // Any API/network failure -> mock, never throw to the client.
    return finalize(mockResult(lastUser), {
      mock: true,
      workspaceId: body.workspaceId,
      idea: lastUser,
    });
  }
}
