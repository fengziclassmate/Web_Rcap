import type { NotionDataSource } from "./notion-client.ts";
import type { SyncConfig } from "./worker.ts";

export class SyncConfigurationError extends Error {}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SyncConfigurationError(`${name} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new SyncConfigurationError(`${name} 不能为空`);
  }
  return value.trim();
}

function id(value: unknown, name: string): string {
  const text = requiredText(value, name);
  if (!uuid.test(text)) throw new SyncConfigurationError(`${name} 必须是 UUID`);
  return text.toLowerCase();
}

export async function resolveSyncConfig(
  input: unknown,
  retrieveDataSource: (id: string) => Promise<NotionDataSource>,
): Promise<SyncConfig> {
  const values = record(input, "同步配置");
  const enabledAt = requiredText(values.enabledAt, "enabledAt");
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(enabledAt)
    || !Number.isFinite(Date.parse(enabledAt))) {
    throw new SyncConfigurationError("enabledAt 需要包含时区");
  }
  const todo = record(values.todo, "todo");
  const daily = record(values.daily, "daily");
  const todoId = id(todo.dataSourceId, "todo.dataSourceId");
  const dailyId = id(daily.dataSourceId, "daily.dataSourceId");
  if (todoId === dailyId) throw new SyncConfigurationError("两个数据源必须不同");
  if (!Array.isArray(daily.bindings)) {
    throw new SyncConfigurationError("daily.bindings 必须是数组");
  }
  const [todoSource, dailySource] = await Promise.all([
    retrieveDataSource(todoId),
    retrieveDataSource(dailyId),
  ]);

  function property(source: NotionDataSource, value: unknown, type: string, name: string) {
    const key = requiredText(value, name);
    const field = Object.values(source.properties).find(({ id }) => id === key)
      ?? Object.entries(source.properties).find(([label]) => label === key)?.[1];
    if (field?.type !== type) throw new SyncConfigurationError(`${name} 需要 ${type} 类型的字段`);
    return field;
  }

  const status = property(todoSource, todo.status, "select", "todo.status");
  const options = new Set(status.select?.options.map(({ name }) => name));
  if (["待处理", "已完成", "取消"].some((name) => !options.has(name))) {
    throw new SyncConfigurationError("TodoLists 状态需要包含待处理、已完成、取消");
  }
  const todoConfig = {
    dataSourceId: todoId,
    title: property(todoSource, todo.title, "title", "todo.title").id,
    date: todo.date === undefined ? undefined : property(todoSource, todo.date, "date", "todo.date").id,
    notes: todo.notes === undefined ? undefined : property(todoSource, todo.notes, "rich_text", "todo.notes").id,
    status: status.id,
    rcapId: property(todoSource, todo.rcapId, "rich_text", "todo.rcapId").id,
  };
  if (todoConfig.notes === todoConfig.rcapId) {
    throw new SyncConfigurationError("TodoLists 的备注和 RCAP 任务 ID 需要各用一个字段");
  }
  const bindings = daily.bindings.map((value, index) => {
    const path = `daily.bindings[${index}]`;
    const binding = record(value, path);
    const projectId = requiredText(binding.projectId, `${path}.projectId`);
    if (projectId === "routine-checkin-task") {
      throw new SyncConfigurationError("日常时段打卡不能绑定到项目打卡");
    }
    return {
      projectId,
      checkbox: property(dailySource, binding.checkbox, "checkbox", `${path}.checkbox`).id,
      note: binding.note === undefined ? undefined : property(dailySource, binding.note, "rich_text", `${path}.note`).id,
    };
  });
  const checkinFields = bindings.flatMap(({ checkbox, note }) => note ? [checkbox, note] : [checkbox]);
  if (new Set(bindings.map(({ projectId }) => projectId)).size !== bindings.length
    || new Set(checkinFields).size !== checkinFields.length) {
    throw new SyncConfigurationError("每个打卡项目和 Notion 字段只能绑定一次");
  }
  const rawPairs = values.existingTaskPairs ?? [];
  if (!Array.isArray(rawPairs)) throw new SyncConfigurationError("existingTaskPairs 必须是数组");
  const existingTaskPairs = rawPairs.map((value, index) => {
    const path = `existingTaskPairs[${index}]`;
    const pair = record(value, path);
    return { rcapId: requiredText(pair.rcapId, `${path}.rcapId`), pageId: id(pair.pageId, `${path}.pageId`) };
  });
  if (new Set(existingTaskPairs.map(({ rcapId }) => rcapId)).size !== existingTaskPairs.length
    || new Set(existingTaskPairs.map(({ pageId }) => pageId)).size !== existingTaskPairs.length) {
    throw new SyncConfigurationError("历史任务需要一对一配对");
  }
  return {
    enabledAt: new Date(enabledAt).toISOString(),
    todo: todoConfig,
    daily: {
      dataSourceId: dailyId,
      title: property(dailySource, daily.title, "title", "daily.title").id,
      date: property(dailySource, daily.date, "date", "daily.date").id,
      bindings,
    },
    existingTaskPairs,
  };
}
