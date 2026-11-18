"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

type SyncItem = { kind: "task" | "checkin" | "mapping"; localId?: string; pageId?: string; date?: string };
type Conflict = SyncItem & { fields: string[] };
type Issue = SyncItem & { code: string };
type Status = {
  last_finished_at: string | null;
  last_error: string | null;
  last_result: { conflicts: Conflict[]; issues: Issue[] } | null;
};
type IdentifiedItem = { id: string; name: string };

const fieldLabels: Record<string, string> = {
  title: "名称", date: "计划执行日", notes: "备注", status: "状态", checked: "打卡状态", note: "打卡描述",
};
const issueLabels: Record<string, string> = {
  "invalid-values": "有字段无法同步",
  unavailable: "记录已删除、归档或无法读取",
  duplicate: "找到重复记录",
  "missing-project": "绑定的项目已不存在",
  "unrecognized-id": "任务 ID 无法对应",
};
const errorLabels: Record<string, string> = {
  configuration: "同步配置需要检查",
  notion_access: "无法访问 Notion 数据库，请检查连接授权",
  notion_rate: "Notion 请求过多，后台会重试",
  notion_request: "Notion 请求失败，后台会重试",
  timeout: "本次同步超时，后台会重试",
  concurrent_save: "检测到同时保存，后台会重新同步",
  sync_failed: "本次同步失败，后台会重试",
};
const displayTime = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "short", timeStyle: "short", timeZone: "Asia/Shanghai",
});

function NotionRecordLink({ pageId }: { pageId?: string }) {
  if (!pageId || !/^[0-9a-f-]{36}$/i.test(pageId)) return null;
  return <a className="underline underline-offset-2" href={`https://app.notion.com/p/${pageId.replaceAll("-", "")}`} target="_blank" rel="noreferrer">在 Notion 中查看</a>;
}

export function NotionSyncStatus({ userId, tasks, projects }: {
  userId: string;
  tasks: IdentifiedItem[];
  projects: IdentifiedItem[];
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState(false);

  async function refresh() {
    setLoading(true);
    setReadError(false);
    const result = await supabase.from("notion_sync_state")
      .select("last_finished_at,last_error,last_result").eq("user_id", userId)
      .abortSignal(AbortSignal.timeout(10_000)).maybeSingle<Status>();
    setStatus(result.data);
    setReadError(Boolean(result.error));
    setLoading(false);
  }

  function label(item: SyncItem) {
    const records = item.kind === "task" ? tasks : projects;
    const name = records.find(({ id }) => id === item.localId)?.name;
    return [name ?? (item.kind === "task" ? "日常任务" : "项目打卡"), item.date].filter(Boolean).join(" ");
  }

  const conflicts = status?.last_result?.conflicts ?? [];
  const issues = status?.last_result?.issues ?? [];
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(true); void refresh(); }}>
        Notion 同步
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notion 同步</DialogTitle>
            <DialogDescription>日常任务和项目打卡的后台同步状态</DialogDescription>
          </DialogHeader>
          <div className="space-y-1" role="status">
            {loading ? <p>正在读取同步状态…</p> : readError ? <p>无法读取同步状态，请刷新重试。</p> : !status ? (
              <p>尚未连接 Notion</p>
            ) : (
              <>
                <p>{status.last_error ? errorLabels[status.last_error] ?? errorLabels.sync_failed : status.last_finished_at ? "后台已完成最近一次同步" : "等待首次同步"}</p>
                {status.last_finished_at ? <p className="text-xs text-muted-foreground">最近一次运行 {displayTime.format(new Date(status.last_finished_at))}</p> : null}
              </>
            )}
          </div>
          {!loading && conflicts.length > 0 ? (
            <section aria-label="待处理的同步冲突" className="space-y-2">
              <h3 className="font-medium">待处理的冲突</h3>
              <p className="text-xs text-muted-foreground">在两端保留同一个值，下次同步会重新检查。</p>
              <ul className="space-y-2">
                {conflicts.map((item, index) => (
                  <li key={index} className="border-t border-border pt-2 break-words">
                    <p>{label(item)}（{item.fields.map((field) => fieldLabels[field] ?? field).join("、")}）</p>
                    <NotionRecordLink pageId={item.pageId} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {!loading && issues.length > 0 ? (
            <section aria-label="待检查的记录" className="space-y-2">
              <h3 className="font-medium">待检查的记录</h3>
              <ul className="space-y-2">
                {issues.map((item, index) => (
                  <li key={index} className="border-t border-border pt-2 break-words">
                    <p>{label(item)}（{issueLabels[item.code] ?? "同步时需要检查"}）</p>
                    <NotionRecordLink pageId={item.pageId} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} className="justify-self-start">
            刷新状态
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
