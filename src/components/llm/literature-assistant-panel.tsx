"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLLMChat } from "@/hooks/useLLMChat";
import { buildLiteraturePrompt, buildLiteratureQuestionPrompt, type LiteratureQuickAction } from "@/lib/llm/literature-prompts";
import type { LiteratureItem } from "@/lib/literature";

type LiteratureAssistantPanelProps = {
  item: LiteratureItem;
  onInsertToNote: (content: string) => Promise<void> | void;
};

const quickActions: Array<{ value: LiteratureQuickAction; label: string }> = [
  { value: "summary", label: "一句话总结" },
  { value: "contribution", label: "主要贡献" },
  { value: "method", label: "方法借鉴" },
  { value: "limitations", label: "局限性" },
  { value: "paper_usage", label: "论文使用位置" },
];

export function LiteratureAssistantPanel({ item, onInsertToNote }: LiteratureAssistantPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const { loading, sendMessage } = useLLMChat();

  async function runPrompt(prompt: string) {
    const result = await sendMessage(prompt, { temperature: 0.35 });
    if (result) setAnswer(result);
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4" />
            文献精读助手
          </h3>
          <p className="mt-1 text-xs text-gray-500">基于当前文献信息分析，不会替你编造缺失内容。</p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={!answer} onClick={() => onInsertToNote(answer)}>
          <Plus className="h-4 w-4" />
          插入到笔记
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <Button
            key={action.value}
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runPrompt(buildLiteraturePrompt(item, action.value))}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="自由提问，例如：这篇文献的方法能如何用于我的论文？"
          className="min-h-16"
        />
        <Button
          type="button"
          className="self-end"
          disabled={loading || !question.trim()}
          onClick={() => {
            void runPrompt(buildLiteratureQuestionPrompt(item, question));
            setQuestion("");
          }}
        >
          提问
        </Button>
      </div>

      {answer ? (
        <div className="prose prose-sm mt-4 max-w-none rounded-xl border border-gray-200 bg-gray-50 p-4">
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
      ) : null}
    </section>
  );
}
