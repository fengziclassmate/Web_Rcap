# 日程安排 App — Prompt 索引

> 项目路径：`C:\Users\25371\Desktop\日程安排_app`
> total: 15 个 prompt — 7 个 LLM 功能 + 2 个重构 + 1 个缓存 + 1 个架构改造 + 1 个可视化 + 1 个 Bugfix + 1 个速记 + 1 个新功能

---

## 推荐执行顺序

```
第 1 梯队 ─── 基础设施
├── Prompt 01 (LLM 基础设施)        — 必须先做（其他 LLM prompt 依赖）
├── Prompt 09 (page.tsx 拆 Context) — 高推荐（2000+ 行单文件→300 行）

第 2 梯队 ─── 性能与架构
├── Prompt 10 (React Query 缓存)    — 依赖 Prompt 09，消除切换闪屏
├── Prompt 11 (循环事件重构)         — 依赖 Prompt 09，拖拽+持久化
├── Prompt 14 (离线优先 IndexedDB)  — 依赖 Prompt 09+10，离线可用

第 3 梯队 ─── 新功能（可并行）
├── Prompt 02 (科研对话侧边栏)      — 依赖 Prompt 01
├── Prompt 03 (周报自动生成)        — 依赖 Prompt 01
├── Prompt 04 (文献精读助手)        — 依赖 Prompt 01，依赖 literature-page
├── Prompt 05 (智能任务分解)        — 依赖 Prompt 01
├── Prompt 06 (效率分析)            — 依赖 Prompt 01
├── Prompt 07 (自然语言日程)        — 依赖 Prompt 01
├── Prompt 12 (上下文注入+历史)     — 依赖 Prompt 01+02
├── Prompt 13 (数据可视化)          — 零依赖，随时可做
├── Prompt 08 (速记)                — 零依赖，随时可做

第 4 梯队 ─── 打磨
├── Prompt 15 (Bug 修复+体验打磨)   — 可随时独立执行
```

## 文件清单

| 文件 | 类别 | 说明 |
|------|------|------|
| `01-llm-infrastructure.md` | LLM 基础设施 | API Route + Provider 适配 + 用户配置弹窗 |
| `02-llm-chat-sidebar.md` | LLM 功能 | 固定侧边栏对话浮窗 |
| `03-weekly-report.md` | LLM 功能 | 基于日程数据自动生成周报 |
| `04-literature-assistant.md` | LLM 功能 | 文献详情页的 LLM 分析面板 |
| `05-task-decomposition.md` | LLM 功能 | 子任务自动生成 + 一键导入 |
| `06-efficiency-analysis.md` | LLM 功能 | 月度科研模式分析报告 |
| `07-quick-event-input.md` | LLM 功能 | 文字输入 → 事件创建 |
| `08-quick-notes.md` | 速记工具 | 浮动 FAB + localStorage 速记 |
| `09-page-refactor-contexts.md` | 代码重构 | 2000+ 行 page.tsx 拆分为 6 个 Context + Provider |
| `10-react-query-cache.md` | 性能优化 | @tanstack/react-query 缓存层 + prefetch |
| `11-event-recurrence-refactor.md` | 架构改造 | 循环事件持久化展开 + 拖拽支持 + scope 记忆 |
| `12-llm-context-injection.md` | 新功能 | 卡片点击注入上下文 + 对话历史归档 |
| `13-data-visualization.md` | 新功能 | 环形图/趋势图/气泡图 — recharts 交互图表 |
| `14-offline-first-idb.md` | 架构改造 | IndexedDB 主存储 + 后台同步引擎 |
| `15-bugfixes-polish.md` | Bug 修复 | 月视图翻页/足迹天数/confirm 样式/scope 记忆等 |

## 各 prompt 新增文件总览（01~08 — LLM 功能）

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
│   │   ├── client.ts          ← 01
│   │   ├── literature-prompts.ts ← 04
│   │   ├── task-prompts.ts    ← 05
│   │   ├── analysis-prompts.ts ← 06
│   │   └── schedule-prompts.ts ← 07
│   ├── report/
│   │   └── weekly-report.ts   ← 03
│   └── types.ts               ← 08（追加 QuickNote 类型）
```

## 各 prompt 新增文件总览（09~15 — 重构+新功能）

```
src/
├── providers/
│   ├── auth-context.tsx       ← 09
│   ├── ui-context.tsx         ← 09
│   ├── schedule-context.tsx   ← 09
│   ├── research-context.tsx   ← 09
│   ├── log-context.tsx        ← 09
│   └── literature-context.tsx ← 09
├── lib/
│   ├── query-keys.ts          ← 10
│   ├── recurrence-expand.ts   ← 11
│   ├── recurrence-instance.ts ← 11
│   ├── db.ts                  ← 14（IndexedDB）
│   ├── sync-engine.ts         ← 14
│   └── llm/context-types.ts   ← 12
├── components/schedule/
│   ├── category-pie-chart.tsx ← 13
│   ├── weekly-task-trend.tsx  ← 13
│   ├── priority-bubble-chart.tsx ← 13
│   ├── sync-indicator.tsx     ← 14
│   └── network-banner.tsx     ← 14
├── components/llm/
│   └── context-badge.tsx      ← 12
├── components/ui/
│   └── confirm-dialog.tsx     ← 15
├── hooks/
│   └── useChatHistory.ts      ← 12
├── hooks/ (if pattern)
│   ├── use-schedule.ts        ← 09
│   ├── use-research.ts        ← 09
│   └── use-logs.ts            ← 09
├── app/layout.tsx             ← 09（添加 Provider 包裹）
├── app/page.tsx               ← 09（大幅瘦身）
```

## 执行方式

1. 每次选一个 prompt，按推荐顺序执行
2. 每个 prompt 执行完成后 `npm run build` 验证
3. 如果出现类型错误，参考该 prompt 的注意事项章节

## 关键设计决策

1. **API Key 存储**：httpOnly cookie，前端 JS 不可读，通过 `/api/llm/chat` API Route 调用
2. **Provider 适配**：所有 provider 使用 OpenAI 兼容格式，通过 `baseUrl` + `chatPath` 区分
3. **流式渲染**：API Route 将 LLM 的 SSE 流 pipe 回前端
4. **离线优先**：IndexedDB 为主存储 + Supabase 为同步后端，写操作不依赖网络
5. **Context 拆分**：6 个窄职责 Provider 替代 1 个巨型 page.tsx，可单独维护和测试
