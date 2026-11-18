import { createClient } from "@supabase/supabase-js";
import { resolveSyncConfig, SyncConfigurationError } from "./config.ts";
import { createNotionClient, NotionApiError } from "./notion-client.ts";
import {
  runNotionSync,
  ConcurrentScheduleError,
  type ScheduleSnapshot,
  type SyncLedger,
  type SyncReport,
  type SyncStore,
} from "./worker.ts";

function runtimeSetting(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new SyncConfigurationError(`缺少 ${name}`);
  return value;
}

async function digest(secret: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function errorCode(error: unknown): string {
  if (error instanceof SyncConfigurationError) return "configuration";
  if (error instanceof NotionApiError) {
    if ([401, 403, 404].includes(error.status)) return "notion_access";
    if (error.status === 429) return "notion_rate";
    return "notion_request";
  }
  if (error instanceof ConcurrentScheduleError) return "concurrent_save";
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";
  return "sync_failed";
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const secret = request.headers.get("x-rcap-notion-secret");
  if (!secret || !/^[0-9a-f]{64}$/.test(secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const mode = new URL(request.url).searchParams.get("mode") ?? "sync";
  if (mode !== "sync" && mode !== "preview") {
    return Response.json({ error: "invalid_mode" }, { status: 400 });
  }
  const preview = mode === "preview";
  const signal = AbortSignal.timeout(85_000);
  let finish: ((report: SyncReport | null, error: string | null) => Promise<void>) | undefined;

  try {
    const database = createClient(runtimeSetting("SUPABASE_URL"), runtimeSetting("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const registration = await database.from("notion_sync_state").select("user_id,configuration")
      .eq("invocation_digest", await digest(secret)).abortSignal(signal)
      .maybeSingle<{ user_id: string; configuration: unknown }>();
    if (registration.error) throw new Error(`读取同步配置失败 (${registration.error.code})`);
    if (!registration.data) return Response.json({ error: "unauthorized" }, { status: 401 });
    const { user_id: userId, configuration } = registration.data;
    const leaseId = crypto.randomUUID();
    if (!preview) {
      const claim = await database.rpc("claim_notion_sync", {
        p_user_id: userId, p_lease_id: leaseId,
      }).abortSignal(signal);
      if (claim.error) throw new Error(`获取同步锁失败 (${claim.error.code})`);
      if (!claim.data) return Response.json({ busy: true }, { status: 409 });
      finish = async (report, error) => {
        const finished = await database.from("notion_sync_state").update({
          lease_id: null,
          lease_until: "-infinity",
          last_finished_at: new Date().toISOString(),
          last_error: error,
          ...(report ? { last_result: report } : {}),
        }).eq("user_id", userId).eq("lease_id", leaseId).abortSignal(AbortSignal.timeout(5_000));
        if (finished.error) console.error("notion-sync status", finished.error.code);
      };
    }

    const notion = createNotionClient(runtimeSetting("NOTION_SYNC_TOKEN"), { signal });
    const config = await resolveSyncConfig(configuration, notion.retrieveDataSource);
    const store: SyncStore = {
      async load() {
        const [schedule, state] = await Promise.all([
          database.from("schedule_data").select("updated_at,tasks,events,project_checkins")
            .eq("user_id", userId).abortSignal(signal).maybeSingle<{
              updated_at: string;
              tasks: ScheduleSnapshot["tasks"];
              events: ScheduleSnapshot["events"];
              project_checkins: ScheduleSnapshot["projectCheckins"];
            }>(),
          database.from("notion_sync_state").select("ledger").eq("user_id", userId)
            .abortSignal(signal).maybeSingle<{ ledger: SyncLedger }>(),
        ]);
        if (schedule.error || state.error) {
          throw new Error(`读取同步数据失败 (${schedule.error?.code ?? state.error?.code})`);
        }
        return {
          schedule: {
            updatedAt: schedule.data?.updated_at ?? null,
            tasks: schedule.data?.tasks ?? [],
            events: schedule.data?.events ?? [],
            projectCheckins: schedule.data?.project_checkins ?? [],
          },
          ledger: state.data?.ledger ?? {},
        };
      },
      async checkpoint(ledger) {
        if (preview) throw new Error("预览流程尝试写入");
        const saved = await database.from("notion_sync_state").update({ ledger })
          .eq("user_id", userId).eq("lease_id", leaseId)
          .gt("lease_until", new Date().toISOString()).select("user_id")
          .abortSignal(signal).maybeSingle();
        if (saved.error) throw new Error(`记录待写入变更失败 (${saved.error.code})`);
        if (!saved.data) throw new ConcurrentScheduleError();
      },
      async commit(expectedRevision, changes, ledger) {
        if (preview) throw new Error("预览流程尝试写入");
        const committed = await database.rpc("commit_notion_sync", {
          p_user_id: userId,
          p_lease_id: leaseId,
          p_revision: expectedRevision,
          p_changes: changes,
          p_ledger: ledger,
        }).abortSignal(signal);
        if (committed.error) throw new Error(`保存同步数据失败 (${committed.error.code})`);
        return committed.data === true;
      },
    };

    const report = await runNotionSync(config, notion, store, { dryRun: preview, signal });
    await finish?.(report, null);
    return Response.json(preview ? { report, resolvedConfig: config } : { report });
  } catch (error) {
    const code = errorCode(error);
    console.error("notion-sync", code, error instanceof Error ? error.message : "");
    await finish?.(null, code);
    return Response.json({
      error: code,
      ...(error instanceof SyncConfigurationError ? { detail: error.message } : {}),
    }, { status: error instanceof SyncConfigurationError ? 422 : 502 });
  }
}

Deno.serve(handle);
