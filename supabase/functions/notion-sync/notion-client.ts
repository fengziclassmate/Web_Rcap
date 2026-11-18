const NOTION_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11";

type NotionTextInput = { type: "text"; text: { content: string } };
type NotionText = { plain_text?: string; text?: { content: string } };
type NotionOption = { id: string; name: string };
type NotionDate = { start: string; end?: string | null; time_zone?: string | null };

export type NotionProperty = { id: string } & (
  | { type: "title"; title: NotionText[] }
  | { type: "rich_text"; rich_text: NotionText[] }
  | { type: "date"; date: NotionDate | null }
  | { type: "select"; select: NotionOption | null }
  | { type: "status"; status: NotionOption | null }
  | { type: "checkbox"; checkbox: boolean }
);

export type NotionPropertyWrites = Record<string,
  | { title: NotionTextInput[] }
  | { rich_text: NotionTextInput[] }
  | { date: NotionDate | null }
  | { select: { id: string } | { name: string } | null }
  | { status: { id: string } | { name: string } }
  | { checkbox: boolean }
>;

export type NotionPage = {
  object: "page";
  id: string;
  created_time: string;
  last_edited_time: string;
  in_trash: boolean;
  parent: { type: string; data_source_id?: string; database_id?: string };
  properties: Record<string, NotionProperty>;
};

export type NotionDataSource = {
  object: "data_source";
  id: string;
  properties: Record<string, {
    id: string;
    type: string;
    select?: { options: NotionOption[] };
    status?: { options: NotionOption[] };
  }>;
};

type DateConditions = {
  equals?: string;
  before?: string;
  after?: string;
  on_or_before?: string;
  on_or_after?: string;
};

export type NotionQueryFilter =
  | { property: string; date: DateConditions }
  | { property: string; rich_text: { equals: string } }
  | { timestamp: "created_time"; created_time: DateConditions }
  | { timestamp: "last_edited_time"; last_edited_time: DateConditions }
  | { and: NotionQueryFilter[] }
  | { or: NotionQueryFilter[] };

export type NotionQuerySort = {
  direction: "ascending" | "descending";
} & ({ timestamp: "created_time" | "last_edited_time" } | { property: string });

type NotionQueryOptions = {
  filter?: NotionQueryFilter;
  sorts?: NotionQuerySort[];
  limit?: number;
  propertyIds?: string[];
};

export class NotionApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly retryAfterMs: number | null,
  ) {
    super(`Notion API returned HTTP ${status}${code ? ` (${code})` : ""}.`);
    this.name = "NotionApiError";
  }
}

export class NotionTextLimitError extends Error {
  constructor() {
    super("Synced text exceeds Notion's rich-text length limit.");
    this.name = "NotionTextLimitError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePage(value: unknown): NotionPage {
  if (!isObject(value) || value.object !== "page" || typeof value.id !== "string"
    || typeof value.created_time !== "string" || typeof value.last_edited_time !== "string"
    || typeof value.in_trash !== "boolean" || !isObject(value.parent) || !isObject(value.properties)) {
    throw new Error("Notion API returned an invalid page.");
  }
  return value as NotionPage;
}

function withProperties(path: string, propertyIds?: string[]): string {
  const params = new URLSearchParams();
  for (const propertyId of propertyIds ?? []) params.append("filter_properties", propertyId);
  return params.size ? `${path}?${params}` : path;
}

function waitForRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function findNotionProperty(page: NotionPage, propertyId: string): NotionProperty | undefined {
  return Object.values(page.properties).find((property) => property.id === propertyId);
}

export function notionText(property: NotionProperty | undefined): string {
  const items = property?.type === "title" ? property.title : property?.type === "rich_text" ? property.rich_text : [];
  return items.map((item) => item.plain_text ?? item.text?.content ?? "").join("");
}

export function notionTextValue(value: string): NotionTextInput[] {
  const items: NotionTextInput[] = [];
  let chunk = "";
  for (const character of value) {
    if (chunk.length + character.length > 2000) {
      items.push({ type: "text", text: { content: chunk } });
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) items.push({ type: "text", text: { content: chunk } });
  if (items.length > 100) throw new NotionTextLimitError();
  return items;
}

export function createNotionClient(token: string, options: { signal?: AbortSignal; fetch?: typeof fetch } = {}) {
  const fetchNotion = options.fetch ?? fetch;

  async function request(method: "GET" | "POST" | "PATCH", path: string, body?: object): Promise<unknown> {
    const deadline = options.signal ?? AbortSignal.timeout(90_000);
    for (let attempt = 0; ; attempt++) {
      deadline.throwIfAborted();
      const response = await fetchNotion(`${NOTION_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: body && JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.any([deadline, AbortSignal.timeout(15_000)]),
      });
      if (response.ok) return response.json();

      const failure: unknown = await response.json().catch(() => null);
      const code = isObject(failure) && typeof failure.code === "string" && /^[a-z_]+$/.test(failure.code)
        ? failure.code : null;
      const retryHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) * 1000 : null;
      const error = new NotionApiError(response.status, code, retryAfterMs);
      const delay = retryAfterMs ?? 1000 * 2 ** attempt;
      // Only 429 guarantees that Notion rejected the request before applying a write.
      if (response.status !== 429 || attempt >= 2 || delay > 2_147_483_647) throw error;
      try {
        await waitForRetry(delay, deadline);
      } catch {
        throw error;
      }
    }
  }

  return {
    async retrieveDataSource(dataSourceId: string): Promise<NotionDataSource> {
      const value = await request("GET", `/data_sources/${encodeURIComponent(dataSourceId)}`);
      if (!isObject(value) || value.object !== "data_source" || typeof value.id !== "string" || !isObject(value.properties)) {
        throw new Error("Notion API returned an invalid data source.");
      }
      return value as NotionDataSource;
    },
    async getPage(pageId: string, propertyIds?: string[]): Promise<NotionPage> {
      return parsePage(await request("GET", withProperties(`/pages/${encodeURIComponent(pageId)}`, propertyIds)));
    },
    async query(dataSourceId: string, { filter, sorts, limit = Infinity, propertyIds }: NotionQueryOptions = {}): Promise<NotionPage[]> {
      const path = withProperties(`/data_sources/${encodeURIComponent(dataSourceId)}/query`, propertyIds);
      const pages: NotionPage[] = [];
      const seenCursors = new Set<string>();
      let cursor: string | undefined;
      while (pages.length < limit) {
        const list = await request("POST", path, {
          result_type: "page",
          filter,
          sorts,
          page_size: Math.min(100, limit - pages.length),
          start_cursor: cursor,
        });
        if (!isObject(list) || !Array.isArray(list.results) || typeof list.has_more !== "boolean") {
          throw new Error("Notion API returned an invalid query result.");
        }
        if (isObject(list.request_status) && list.request_status.type === "incomplete") {
          throw new Error("Notion query exceeded the pagination limit. Narrow the query and retry.");
        }
        pages.push(...list.results.slice(0, limit - pages.length).map(parsePage));
        if (!list.has_more || pages.length >= limit) break;
        if (typeof list.next_cursor !== "string" || !list.next_cursor || seenCursors.has(list.next_cursor)) {
          throw new Error("Notion API returned an invalid pagination cursor.");
        }
        cursor = list.next_cursor;
        seenCursors.add(cursor);
      }
      return pages;
    },
    async createPage(dataSourceId: string, properties: NotionPropertyWrites): Promise<NotionPage> {
      return parsePage(await request("POST", "/pages", {
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties,
      }));
    },
    async updatePage(pageId: string, properties: NotionPropertyWrites): Promise<NotionPage> {
      return parsePage(await request("PATCH", `/pages/${encodeURIComponent(pageId)}`, { properties }));
    },
  };
}

export type NotionClient = ReturnType<typeof createNotionClient>;
