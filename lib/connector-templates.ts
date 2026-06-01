// Client-safe, pure data: a curated set of business-connector TEMPLATES the
// founder can add from the Connections UI with one click. Each template seeds a
// CUSTOM http-mcp connector — the endpoint/secret is supplied later by ENV VAR
// NAME (never a value), and every tool flows through the same risk policy +
// human-approval gate as the built-ins. NO server imports (type-only), so this
// is safe to import from client components. See lib/connectors.ts for how a
// chosen template's ConnectorConfig is turned into a live registry entry.
import type { ConnectorToolSpec } from "@/lib/agent-types";

/** A one-click connector blueprint. `secretEnvVar` is the env-var NAME the
 *  operator sets to the connector's MCP endpoint (read at call time only). Every
 *  tool name is namespaced with the connector id so it can never collide with a
 *  built-in tool. Read tools are 'safe' (auto-run); anything that sends/creates/
 *  posts externally is 'sensitive' (queued for human approval). */
export interface ConnectorTemplate {
  id: string;
  label: string;
  secretEnvVar: string;
  blurb: string;
  tools: ConnectorToolSpec[];
}

/** The curated business connector set. Read tools are 'safe', write/send tools
 *  are 'sensitive'. Deliberately NOTHING that moves money — payment actions are
 *  out of scope (a Stripe invoice here is a DRAFT only, never a charge). */
export const CONNECTOR_TEMPLATES: ConnectorTemplate[] = [
  {
    id: "slack",
    label: "Slack",
    secretEnvVar: "SLACK_MCP_URL",
    blurb: "Read channels and search history, and post messages for approval.",
    tools: [
      {
        name: "slack_list_channels",
        description:
          "List the Slack channels the workspace can see (names + ids). Read-only — runs automatically.",
        risk: "safe",
      },
      {
        name: "slack_search",
        description:
          "Search Slack messages for a query and return matching snippets. Read-only — runs automatically.",
        risk: "safe",
        params: ["query"],
      },
      {
        name: "slack_send_message",
        description:
          "Send a message to a Slack channel. This posts externally-visible content, so it is QUEUED for human approval before it is sent.",
        risk: "sensitive",
        params: ["channel", "text"],
      },
    ],
  },
  {
    id: "gmail",
    label: "Gmail",
    secretEnvVar: "GMAIL_MCP_URL",
    blurb: "Search and read email, and send messages for approval.",
    tools: [
      {
        name: "gmail_search",
        description:
          "Search the mailbox for messages matching a query and return their ids + summaries. Read-only — runs automatically.",
        risk: "safe",
        params: ["query"],
      },
      {
        name: "gmail_read",
        description:
          "Read the full content of a single email by id. Read-only — runs automatically.",
        risk: "safe",
        params: ["id"],
      },
      {
        name: "gmail_send",
        description:
          "Send an email to a recipient. This takes a real, externally-visible action, so it is QUEUED for human approval before it is sent.",
        risk: "sensitive",
        params: ["to", "subject", "body"],
      },
    ],
  },
  {
    id: "stripe",
    label: "Stripe",
    secretEnvVar: "STRIPE_MCP_URL",
    blurb: "Look up customers and balance, and draft invoices for approval.",
    tools: [
      {
        name: "stripe_list_customers",
        description:
          "List Stripe customers (names, emails, ids). Read-only — runs automatically.",
        risk: "safe",
      },
      {
        name: "stripe_get_balance",
        description:
          "Read the current Stripe account balance. Read-only — runs automatically.",
        risk: "safe",
      },
      {
        name: "stripe_create_invoice",
        description:
          "Create a DRAFT invoice for a customer (no charge or transfer — money is never moved). Because it creates an external record, it is QUEUED for human approval first.",
        risk: "sensitive",
        params: ["customer", "amount", "currency"],
      },
    ],
  },
  {
    id: "notion",
    label: "Notion",
    secretEnvVar: "NOTION_MCP_URL",
    blurb: "Search the workspace and create pages for approval.",
    tools: [
      {
        name: "notion_search",
        description:
          "Search Notion pages and databases for a query and return matching results. Read-only — runs automatically.",
        risk: "safe",
        params: ["query"],
      },
      {
        name: "notion_create_page",
        description:
          "Create a new Notion page with a title and content. Because it writes to the workspace, it is QUEUED for human approval first.",
        risk: "sensitive",
        params: ["title", "content"],
      },
    ],
  },
  {
    id: "hubspot",
    label: "HubSpot",
    secretEnvVar: "HUBSPOT_MCP_URL",
    blurb: "Search CRM contacts, and create contacts or log notes for approval.",
    tools: [
      {
        name: "hubspot_search_contacts",
        description:
          "Search HubSpot contacts for a query and return matching records. Read-only — runs automatically.",
        risk: "safe",
        params: ["query"],
      },
      {
        name: "hubspot_create_contact",
        description:
          "Create a new HubSpot contact. Because it writes to the CRM, it is QUEUED for human approval first.",
        risk: "sensitive",
        params: ["email", "name"],
      },
      {
        name: "hubspot_log_note",
        description:
          "Log a note against a HubSpot contact. Because it writes to the CRM, it is QUEUED for human approval first.",
        risk: "sensitive",
        params: ["contact", "note"],
      },
    ],
  },
  {
    id: "gcal",
    label: "Calendar",
    secretEnvVar: "GCAL_MCP_URL",
    blurb: "List calendar events, and create events for approval.",
    tools: [
      {
        name: "gcal_list_events",
        description:
          "List calendar events within a date range. Read-only — runs automatically.",
        risk: "safe",
        params: ["range"],
      },
      {
        name: "gcal_create_event",
        description:
          "Create a calendar event with a title and start/end times. Because it writes to the calendar, it is QUEUED for human approval first.",
        risk: "sensitive",
        params: ["title", "start", "end"],
      },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    secretEnvVar: "GITHUB_MCP_URL",
    blurb: "Search repositories and code, and open issues for approval.",
    tools: [
      {
        name: "github_search",
        description:
          "Search GitHub repositories, code, and issues for a query. Read-only — runs automatically.",
        risk: "safe",
        params: ["query"],
      },
      {
        name: "github_create_issue",
        description:
          "Open a new issue in a repository with a title and body. Because it writes externally, it is QUEUED for human approval first.",
        risk: "sensitive",
        params: ["repo", "title", "body"],
      },
    ],
  },
];
