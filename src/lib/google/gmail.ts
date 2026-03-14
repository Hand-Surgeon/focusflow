import { googleFetch } from "./client";

const GMAIL_API = "https://www.googleapis.com/gmail/v1/users/me";

type GmailMessageHeader = {
  name: string;
  value: string;
};

type GmailMessagePayload = {
  headers: GmailMessageHeader[];
  body?: { data?: string };
  parts?: Array<{ mimeType: string; body?: { data?: string } }>;
};

type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  payload: GmailMessagePayload;
  internalDate: string;
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
};

export type ParsedEmail = {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  snippet: string;
  receivedAt: string;
};

/**
 * Searches Gmail for messages matching the given query.
 * Defaults to recent unread messages from the past 3 days.
 */
export async function searchEmails(
  token: string,
  options?: {
    query?: string;
    maxResults?: number;
  },
): Promise<ParsedEmail[]> {
  const maxResults = options?.maxResults ?? 20;
  const query =
    options?.query ?? "is:unread newer_than:3d -category:promotions -category:social";

  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });

  const listUrl = `${GMAIL_API}/messages?${params}`;
  const listResponse = await googleFetch(listUrl, token);
  const listData: GmailListResponse = await listResponse.json();

  if (!listData.messages?.length) {
    return [];
  }

  // Fetch message details in parallel (max 10 concurrent)
  const messageIds = listData.messages.slice(0, maxResults);
  const emails: ParsedEmail[] = [];

  for (let i = 0; i < messageIds.length; i += 10) {
    const batch = messageIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map((msg) => fetchMessageDetail(token, msg.id)),
    );
    emails.push(...results.filter(Boolean) as ParsedEmail[]);
  }

  return emails;
}

async function fetchMessageDetail(
  token: string,
  messageId: string,
): Promise<ParsedEmail | null> {
  try {
    const url = `${GMAIL_API}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
    const response = await googleFetch(url, token);
    const message: GmailMessage = await response.json();

    const headers = message.payload.headers;
    const subject =
      headers.find((h) => h.name.toLowerCase() === "subject")?.value ??
      "(No subject)";
    const sender =
      headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "Unknown";

    return {
      id: message.id,
      threadId: message.threadId,
      subject,
      sender,
      snippet: message.snippet,
      receivedAt: new Date(Number(message.internalDate)).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Converts a parsed email into a task-compatible shape.
 */
export function emailToTaskData(email: ParsedEmail): {
  title: string;
  description: string | null;
  source_type: "EMAIL";
  source_id: string;
  emailMetadata: {
    sender: string;
    subject: string;
    received_at: string;
  };
} {
  return {
    title: `[Email] ${email.subject}`,
    description: email.snippet.slice(0, 500) || null,
    source_type: "EMAIL",
    source_id: email.id,
    emailMetadata: {
      sender: email.sender,
      subject: email.subject,
      received_at: email.receivedAt,
    },
  };
}
