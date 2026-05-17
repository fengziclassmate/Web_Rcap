"use client";

import { Bot } from "lucide-react";
import type { ContextSource } from "@/lib/llm/context-types";
import { cn } from "@/lib/utils";

type ContextBadgeProps = {
  source: ContextSource;
  className?: string;
  label?: string;
};

export function ContextBadge({ source, className, label = "问 AI" }: ContextBadgeProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/85 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur transition hover:border-black hover:text-black",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        window.__injectLLMContext?.(source);
      }}
      aria-label="把当前内容发送给 AI 助手作为上下文"
    >
      <Bot className="h-3 w-3" />
      {label}
    </button>
  );
}
