import { googleFetch } from "./client";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: string;
};

type CalendarListResponse = {
  items?: CalendarEvent[];
  nextPageToken?: string;
};

/**
 * Fetches upcoming calendar events for the authenticated user.
 * Returns events from the primary calendar within the specified time range.
 */
export async function fetchUpcomingEvents(
  token: string,
  options?: {
    maxResults?: number;
    daysAhead?: number;
  },
): Promise<CalendarEvent[]> {
  const maxResults = options?.maxResults ?? 50;
  const daysAhead = options?.daysAhead ?? 7;

  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
  });

  const url = `${CALENDAR_API}/calendars/primary/events?${params}`;
  const response = await googleFetch(url, token);
  const data: CalendarListResponse = await response.json();

  return (data.items ?? []).filter(
    (event) => event.status !== "cancelled",
  );
}

/**
 * Converts a Google Calendar event into a task-compatible shape.
 */
export function eventToTaskData(event: CalendarEvent): {
  title: string;
  description: string | null;
  due_date: string | null;
  source_type: "CALENDAR";
  source_id: string;
} {
  const startTime = event.start.dateTime ?? event.start.date ?? null;

  return {
    title: event.summary || "Untitled Event",
    description: event.description?.slice(0, 500) ?? null,
    due_date: startTime,
    source_type: "CALENDAR",
    source_id: event.id,
  };
}
