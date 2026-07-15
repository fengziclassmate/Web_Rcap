import type { LiteratureItem } from "@/lib/literature";

export type LiteratureQuickAction =
  | "summary"
  | "contribution"
  | "method"
  | "limitations"
  | "paper_usage";

const ACTION_LABEL: Record<LiteratureQuickAction, string> = {
  summary: "一句话总结",
  contribution: "主要贡献",
  method: "方法借鉴",
  limitations: "局限性",
  paper_usage: "可用于论文的位置",
};

function buildLiteratureContext(item: LiteratureItem) {
  return `标题：${item.title}
作者：${item.authors || "未填写"}
年份：${item.year ?? "未填写"}
期刊/会议：${item.venue || "未填写"}
摘要：${item.abstract || "未填写"}
关键词：${item.keywords.join("、") || "未填写"}
一句话总结：${item.summary || "未填写"}
主要贡献：${item.contributions || "未填写"}
局限性：${item.limitations || "未填写"}
阅读笔记：${item.note ? JSON.stringify(item.note) : "未填写"}
摘录：${item.excerpts.map((excerpt) => `- ${excerpt.content}`).join("\n") || "无"}`;
}

export function buildLiteraturePrompt(item: LiteratureItem, action: LiteratureQuickAction) {
  return `你是科研文献精读助手。请基于文献信息完成「${ACTION_LABEL[action]}」分析。

输出要求：
1. 使用中文 Markdown。
2. 只基于已给信息，不要编造论文内容。
3. 如果信息不足，请明确指出还需要补充哪些内容。
4. 给出可直接写入阅读笔记的结果。

文献信息：
${buildLiteratureContext(item)}`;
}

export function buildLiteratureQuestionPrompt(item: LiteratureItem, question: string) {
  return `你是科研文献精读助手。请回答用户关于这篇文献的问题。

用户问题：${question}

回答要求：中文、具体、可用于整理阅读笔记；信息不足时明确说明。

文献信息：
${buildLiteratureContext(item)}`;
}
