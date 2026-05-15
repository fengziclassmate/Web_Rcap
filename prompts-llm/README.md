# 日程安排 App — LLM 功能 Prompt 索引

> 项目路径：`C:\Users\25371\Desktop\日程安排_app`
> total: 8 个 prompt，覆盖 LLM 基础架构 + 6 个 LLM 功能 + 1 个速记工具

---

## 执行顺序

```
Prompt 01 ─────────────────────── 必须先做（基础设施）
    │
    ├── Prompt 02 (科研对话侧边栏)  ← 无数据耦合，随时可做
    ├── Prompt 03 (周报自动生成)     ← 依赖 useScheduleData 状态
    ├── Prompt 04 (文献精读助手)     ← 依赖 literature-page 组件
    ├── Prompt 05 (智能任务分解)     ← 依赖 task-dashboard 组件
    ├── Prompt 06 (效率分析)         ← 依赖 events/tasks/achievements 数据
    ├── Prompt 07 (自然语言日程)     ← 依赖 weekly-time-grid 组件
    │
    └── Prompt 08 (速记/脑洞捕获)    ← 不依赖 LLM，随时可做
```

## 文件清单

| 文件 | 对应 Prompt | 说明 |
|------|-------------|------|
| `01-llm-infrastructure.md` | 基础架构 | API Route + Provider 适配 + 用户配置弹窗 |
| `02-llm-chat-sidebar.md` | 通用对话 | 固定侧边栏对话浮窗 |
| `03-weekly-report.md` | 周报 | 基于日程数据自动生成周报 |
| `04-literature-assistant.md` | 文献助手 | 文献详情页的 LLM 分析面板 |
| `05-task-decomposition.md` | 任务分解 | 子任务自动生成 + 一键导入 |
| `06-efficiency-analysis.md` | 效率分析 | 月度科研模式分析报告 |
| `07-quick-event-input.md` | 自然语言日程 | 文字输入 → 事件创建 |
| `08-quick-notes.md` | 速记 | 浮动 FAB + localStorage 速记 |

## 各 prompt 新增文件总览

```
src/
├── app/api/llm/
│   ├── chat/route.ts          ← 01
│   └── config/route.ts        ← 01
├── components/llm/
│   ├── settings-dialog.tsx    ← 01
│   ├── settings-button.tsx    ← 01（可选）
│   ├── chat-sidebar.tsx       ← 02
│   ├── weekly-report-dialog.tsx  ← 03
│   ├── literature-assistant-panel.tsx ← 04
│   ├── task-decomposition-dialog.tsx ← 05
│   ├── analysis-dialog.tsx    ← 06
│   ├── quick-event-input.tsx  ← 07
│   └── quick-note-fab.tsx     ← 08
├── hooks/
│   ├── useLLMConfig.ts        ← 01
│   ├── useLLMChat.ts          ← 02
│   ├── useWeekReportData.ts   ← 03
│   └── useQuickNotes.ts       ← 08
├── lib/
│   ├── llm/
│   │   ├── types.ts           ← 01
│   │   ├── client.ts          ← 01（仅 API Route 用）
│   │   ├── literature-prompts.ts ← 04
│   │   ├── task-prompts.ts    ← 05
│   │   ├── analysis-prompts.ts ← 06
│   │   └── schedule-prompts.ts ← 07
│   ├── report/
│   │   └── weekly-report.ts   ← 03
│   └── types.ts               ← 08（追加 QuickNote 类型）
```

## 执行方式

1. 每个 prompt 独立执行，从 `01` 开始顺序执行
2. 每个 prompt 执行完成后 `npm run build` 验证
3. 最后一个 prompt 执行完后再跑一次完整 `npm run build`
4. 如果出现 `@/lib/types` 找不到的情况，请先确保 Prompt 01（或之前独立重构）已执行完毕

## 关键设计决策

1. **API Key 存储**：httpOnly cookie，前端 JS 不可读，通过 `/api/llm/chat` API Route 调用
2. **Provider 适配**：所有 provider 使用 OpenAI 兼容格式，通过 `baseUrl` + `chatPath` 区分
3. **流式渲染**：API Route 将 LLM 的 SSE 流 pipe 回前端
4. **文件位置**：组件放在 `@/components/llm/`，hooks 在 `@/hooks/`，工具函数在 `@/lib/llm/`
