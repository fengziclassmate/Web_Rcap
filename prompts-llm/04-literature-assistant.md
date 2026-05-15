# Prompt 04 — 文献精读助手

> **依赖：** 必须先完成 Prompt 01（LLM 基础架构）
> **目标：** 在文献详情页嵌入 LLM 面板，支持选中文本后快捷提问（一句话总结/创新点/方法/局限）
> 和自由提问，回答可一键插入到文献笔记中。

---

## 一、新增文件：`src/lib/llm/literature-prompts.ts`

文献相关的 prompt 模板。

```typescript
/** 预设快捷提问 action */
export type LiteratureQuickAction =
  | "summarize"
  | "contributions"
  | "method"
  | "limitations"
  | "keywords";

export const LITERATURE_QUICK_ACTIONS: {
  id: LiteratureQuickAction;
  label: string;
  icon: string;
  buildPrompt: (text: string) => string;
}[] = [
  {
    id: "summarize",
    label: "一句话总结",
    icon: "📝",
    buildPrompt: (text) =>
      `用一句话总结以下论文的核心贡献（50字以内）：\n\n${text}`,
  },
  {
    id: "contributions",
    label: "创新点",
    icon: "💡",
    buildPrompt: (text) =>
      `这篇论文的主要创新点有哪些？列出 3-5 点，每点一句话。\n\n${text}`,
  },
  {
    id: "method",
    label: "研究方法",
    icon: "🔬",
    buildPrompt: (text) =>
      `这篇论文使用了什么研究方法/技术路线？用简洁的语言描述核心步骤。\n\n${text}`,
  },
  {
    id: "limitations",
    label: "局限性",
    icon: "⚠️",
    buildPrompt: (text) =>
      `这篇论文有哪些局限性或未解决的问题？列出 2-3 点。\n\n${text}`,
  },
  {
    id: "keywords",
    label: "关键词提取",
    icon: "🏷️",
    buildPrompt: (text) =>
      `从以下论文中提取 5-8 个关键词（中英文均可），以逗号分隔。\n\n${text}`,
  },
];

/** 构建"这篇论文和我的项目是否相关"prompt */
export function buildRelevancePrompt(paperText: string, projectDescription: string): string {
  return `我正在研究以下项目：
${projectDescription}

请分析这篇论文与我的研究的相关性（1-10分），并说明理由：

${paperText}

格式：
- 相关性评分：X/10
- 理由：...
- 可能的结合点：...`;
}
```

## 二、新增组件：`src/components/llm/literature-assistant-panel.tsx`

文献详情页内联的 LLM 面板。

```tsx
"use client";

import { useState, useRef } from "react";
import { Bot, Send, Plus, Loader2 } from "lucide-react";
import { LITERATURE_QUICK_ACTIONS, type LiteratureQuickAction } from "@/lib/llm/literature-prompts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Markdown from "react-markdown";

type LiteratureAssistantPanelProps = {
  /** 当前文献的摘要或全文文本 */
  paperText: string;
  /** 当用户点击"插入到笔记"时触发 */
  onInsertToNotes: (text: string) => void;
};

export function LiteratureAssistantPanel({
  paperText,
  onInsertToNotes,
}: LiteratureAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<"quick" | "free">("quick");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [selectedAction, setSelectedAction] = useState<LiteratureQuickAction | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  async function handleQuickAction(action: LiteratureQuickAction) {
    if (!paperText.trim()) {
      toast.error("请先在文献详情中填入标题/摘要");
      return;
    }

    const actionConfig = LITERATURE_QUICK_ACTIONS.find((a) => a.id === action);
    if (!actionConfig) return;

    setSelectedAction(action);
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: actionConfig.buildPrompt(paperText) },
          ],
          temperature: 0.3,
          maxTokens: 1024,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "请求失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("响应体不可读");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setResponse((prev) => prev + delta);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请求失败";
      setResponse(`⚠️ ${msg}`);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleFreeQuestion() {
    const question = customQuestion.trim();
    if (!question) return;
    if (!paperText.trim()) {
      toast.error("请先在文献详情中填入标题/摘要");
      return;
    }

    setSelectedAction(null);
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `基于以下论文内容，回答我的问题。

论文内容：
${paperText}

我的问题：${question}

请基于论文内容回答，如果论文中没有相关信息，请如实说明。`,
            },
          ],
          temperature: 0.3,
          maxTokens: 1024,
          stream: true,
        }),
      });

      // ... 流式读取逻辑同上
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "请求失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("响应体不可读");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setResponse((prev) => prev + delta);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请求失败";
      setResponse(`⚠️ ${msg}`);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleInsertToNotes() {
    if (!response.trim()) return;
    onInsertToNotes(response);
    toast.success("已插入到笔记");
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* 标签栏 */}
      <div className="flex border-b border-stone-100">
        <button
          type="button"
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "quick"
              ? "bg-stone-950 text-white"
              : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
          }`}
          onClick={() => setActiveTab("quick")}
        >
          快捷分析
        </button>
        <button
          type="button"
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "free"
              ? "bg-stone-950 text-white"
              : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
          }`}
          onClick={() => setActiveTab("free")}
        >
          自由提问
        </button>
      </div>

      {/* 内容区 */}
      <div className="p-4 space-y-4">
        {/* 快捷操作 */}
        {activeTab === "quick" && (
          <div className="grid grid-cols-2 gap-2">
            {LITERATURE_QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleQuickAction(action.id)}
                disabled={loading}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                  selectedAction === action.id && loading
                    ? "border-stone-400 bg-stone-50 text-stone-700"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <span className="text-base">{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* 自由提问 */}
        {activeTab === "free" && (
          <div className="space-y-2">
            <Textarea
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="例如：这篇论文的方法和 XXX 相比有什么优势？"
              rows={3}
              className="resize-none"
            />
            <Button
              type="button"
              onClick={handleFreeQuestion}
              disabled={loading || !customQuestion.trim()}
              className="w-full"
              size="sm"
            >
              {loading ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> 思考中…</>
              ) : (
                <><Send className="mr-1 h-4 w-4" /> 提问</>
              )}
            </Button>
          </div>
        )}

        {/* 加载状态 */}
        {loading && !response && (
          <div className="flex items-center justify-center py-8 text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">分析中…</span>
          </div>
        )}

        {/* 响应区 */}
        {response && (
          <div className="space-y-3">
            <div
              ref={responseRef}
              className="rounded-xl bg-stone-50 p-4 text-sm leading-relaxed prose prose-sm prose-stone max-w-none"
            >
              <Markdown>{response}</Markdown>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInsertToNotes}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                插入到笔记
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setResponse("")}
              >
                清空
              </Button>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !response && activeTab === "quick" && (
          <p className="text-center text-xs text-stone-400">
            选择一个快捷操作，AI 将分析当前文献并返回结果
          </p>
        )}
      </div>
    </div>
  );
}
```

## 三、修改文件：`src/components/monitoring/literature-page.tsx`

在文献详情/编辑页面中嵌入 `LiteratureAssistantPanel`。

需要找到文献详情展示的位置（编辑弹窗或详情页），在其中添加：

```tsx
import { LiteratureAssistantPanel } from "@/components/llm/literature-assistant-panel";

// 在文献详情/编辑表单下方添加：
<LiteratureAssistantPanel
  paperText={/* 当前文献的 title + abstract 组合 */}
  onInsertToNotes={(text) => {
    // 将 text 添加到文献的 notes 字段中
    // 通过 onUpdateLiterature(id, { notes: currentNotes + "\n" + text }) 实现
  }}
/>
```

**关键：** 需要从 `LiteratureFormInput` 中获取 `title` 和 `abstract` 字段。查看 `src/lib/literature.ts` 中的类型定义，确认 `LiteratureFormInput` 和 `LiteratureItem` 的字段。

如果当前文献详情是一个 Dialog 或详情面板，将 `LiteratureAssistantPanel` 放在表单下方或侧边作为辅助面板。

## 验收标准

- [ ] `npm run build` 通过
- [ ] 在文献详情页中出现"快捷分析"和"自由提问"两个标签页
- [ ] 点击"一句话总结"等快捷按钮，流式返回结果
- [ ] 自由提问输入框正常发送和接收
- [ ] "插入到笔记"按钮将 LLM 回复追加到文献笔记
- [ ] 无 API Key 时显示友好错误
