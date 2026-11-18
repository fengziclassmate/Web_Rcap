import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotionClient, findNotionProperty, notionText, notionTextValue } from "./notion-client";

const basePage = {
  object: "page",
  id: "sample-page",
  created_time: "2026-11-18T01:10:00.000Z",
  last_edited_time: "2026-11-18T03:50:00.000Z",
  in_trash: false,
  parent: { type: "data_source_id", data_source_id: "tasks-source" },
  properties: { "已改名的标题": { type: "title", id: "title", title: [{ plain_text: "核对任务" }] } },
};

afterEach(() => vi.useRealTimers());

describe("Notion API client", () => {
  it("queries the current data-source API with property IDs and follows opaque cursors", async () => {
    const fetchNotion = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => Response.json({
        results: [basePage], has_more: true, next_cursor: "next-token",
      }))
      .mockImplementationOnce(async () => Response.json({
        results: [{ ...basePage, id: "second-page" }], has_more: false, next_cursor: null,
      }));
    const notion = createNotionClient("test-token", { fetch: fetchNotion });
    const pages = await notion.query("tasks-source", {
      filter: { timestamp: "last_edited_time", last_edited_time: { on_or_after: basePage.last_edited_time } },
      propertyIds: ["title", "a%3Ab"],
    });

    const [url, initial] = fetchNotion.mock.calls[0];
    const requestUrl = new URL(String(url));
    expect(requestUrl.origin).toBe("https://api.notion.com");
    expect(requestUrl.pathname).toBe("/v1/data_sources/tasks-source/query");
    expect(requestUrl.searchParams.getAll("filter_properties")).toEqual(["title", "a%3Ab"]);
    expect(new Headers(initial?.headers).get("Notion-Version")).toBe("2026-03-11");
    expect(new Headers(initial?.headers).get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(String(initial?.body))).toEqual({
      result_type: "page", page_size: 100,
      filter: { timestamp: "last_edited_time", last_edited_time: { on_or_after: basePage.last_edited_time } },
    });
    expect(JSON.parse(String(fetchNotion.mock.calls[1][1]?.body)).start_cursor).toBe("next-token");
    expect(pages.map((page) => page.id)).toEqual(["sample-page", "second-page"]);
    expect(notionText(findNotionProperty(pages[0], "title"))).toBe("核对任务");
  });

  it("stops after enough exact-key matches to detect a duplicate", async () => {
    const fetchNotion = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
      results: [basePage, { ...basePage, id: "duplicate" }], has_more: true, next_cursor: "more",
    }));
    const notion = createNotionClient("test-token", { fetch: fetchNotion });
    const filter = { property: "rcap%3Aid", rich_text: { equals: "task-123" } };
    expect(await notion.query("tasks-source", { filter, limit: 2 })).toHaveLength(2);
    expect(fetchNotion).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchNotion.mock.calls[0][1]?.body))).toMatchObject({ filter, page_size: 2 });
  });

  it("rejects a capped query instead of reporting partial records as complete", async () => {
    const fetchNotion = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
      results: [basePage], has_more: false, next_cursor: null, request_status: { type: "incomplete" },
    }));
    const notion = createNotionClient("test-token", { fetch: fetchNotion });
    await expect(notion.query("tasks-source")).rejects.toThrow("pagination limit");
  });

  it("creates rows under a data source and patches only the selected properties", async () => {
    const fetchNotion = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(basePage));
    const notion = createNotionClient("test-token", { fetch: fetchNotion });
    const title = { title: notionTextValue("核对任务") };
    const checkbox = { checkbox: true };

    await notion.createPage("tasks-source", { title });
    await notion.updatePage("sample-page", { "done%3A1": checkbox });

    const [createUrl, create] = fetchNotion.mock.calls[0];
    expect(createUrl).toBe("https://api.notion.com/v1/pages");
    expect(create?.method).toBe("POST");
    expect(JSON.parse(String(create?.body))).toEqual({
      parent: { type: "data_source_id", data_source_id: "tasks-source" }, properties: { title },
    });
    const [updateUrl, update] = fetchNotion.mock.calls[1];
    expect(updateUrl).toBe("https://api.notion.com/v1/pages/sample-page");
    expect(update?.method).toBe("PATCH");
    expect(JSON.parse(String(update?.body))).toEqual({ properties: { "done%3A1": checkbox } });
  });

  it("waits for the 429 Retry-After before making another request", async () => {
    vi.useFakeTimers();
    const fetchNotion = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => Response.json({ code: "rate_limited" }, {
        status: 429, headers: { "Retry-After": "1" },
      }))
      .mockImplementationOnce(async () => Response.json(basePage));
    const notion = createNotionClient("test-token", { fetch: fetchNotion });
    const result = notion.getPage("sample-page");

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchNotion).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({ id: "sample-page" });
    expect(fetchNotion).toHaveBeenCalledTimes(2);
  });

  it("aborts pending rate-limit retry and exposes retry timing", async () => {
    const stop = new AbortController();
    const fetchNotion = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ code: "rate_limited" }, {
      status: 429, headers: { "Retry-After": "120" },
    }));
    const notion = createNotionClient("test-token", { fetch: fetchNotion, signal: stop.signal });
    const result = notion.getPage("sample-page");
    stop.abort();

    await expect(result).rejects.toMatchObject({ status: 429, code: "rate_limited", retryAfterMs: 120_000 });
    expect(fetchNotion).toHaveBeenCalledOnce();
  });

  it("leaves an ambiguous write failure for reconciliation and keeps raw Notion errors private", async () => {
    const fetchNotion = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
      code: "service_unavailable", message: "private record content",
    }, { status: 503 }));
    const notion = createNotionClient("test-token", { fetch: fetchNotion });
    await expect(notion.createPage("tasks-source", {})).rejects.toMatchObject({
      status: 503, code: "service_unavailable", message: "Notion API returned HTTP 503 (service_unavailable).",
    });
    expect(fetchNotion).toHaveBeenCalledOnce();
  });

  it("preserves multibyte characters while observing per-fragment text limits", () => {
    const source = `${"条".repeat(1999)}🗓️\n确认`;
    const parts = notionTextValue(source);
    expect(parts.map((part) => part.text.content.length)).toEqual([1999, 6]);
    expect(notionText({ type: "rich_text", id: "notes", rich_text: parts })).toBe(source);
    expect(notionTextValue("")).toEqual([]);
  });
});
