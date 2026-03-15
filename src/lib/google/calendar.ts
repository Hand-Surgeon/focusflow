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

type CalendarEventsResponse = {
  items?: CalendarEvent[];
  nextPageToken?: string;
};

type CalendarEntry = {
  id: string;
  summary: string;
  selected?: boolean;
  accessRole: string;
};

type CalendarListResponse = {
  items?: CalendarEntry[];
};

/**
 * Fetches all calendar IDs the user has access to.
 */
async function fetchCalendarIds(token: string): Promise<string[]> {
  const url = `${CALENDAR_API}/users/me/calendarList?minAccessRole=reader`;
  const response = await googleFetch(url, token);
  const data: CalendarListResponse = await response.json();

  return (data.items ?? []).map((cal) => cal.id);
}

/**
 * Fetches upcoming calendar events for the authenticated user.
 * Returns events from ALL calendars within the specified time range.
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

  const calendarIds = await fetchCalendarIds(token);

  const results = await Promise.all(
    calendarIds.map(async (calId) => {
      const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calId)}/events?${params}`;
      const response = await googleFetch(url, token);
      const data: CalendarEventsResponse = await response.json();
      return (data.items ?? []).filter(
        (event) => event.status !== "cancelled",
      );
    }),
  );

  // Flatten and deduplicate by event id
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const batch of results) {
    for (const event of batch) {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        events.push(event);
      }
    }
  }

  // Sort by start time
  events.sort((a, b) => {
    const aTime = a.start.dateTime ?? a.start.date ?? "";
    const bTime = b.start.dateTime ?? b.start.date ?? "";
    return aTime.localeCompare(bTime);
  });

  return events;
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
