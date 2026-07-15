"use client";

import { useState } from "react";
import { Brain, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLLMConfig } from "@/hooks/useLLMConfig";
import type { LLMProvider, LLMUserConfig } from "@/lib/llm/types";

type LLMSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const providerOptions: Array<{ value: LLMProvider; label: string }> = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
];

export function LLMSettingsDialog({ open, onOpenChange }: LLMSettingsDialogProps) {
  const { saveConfig, clearConfig, loading, error, presetModels, config } = useLLMConfig();
  const [providerOverride, setProvider] = useState<LLMProvider | null>(null);
  const [modelOverride, setModel] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrlOverride, setBaseUrl] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const provider = providerOverride ?? config?.provider ?? "deepseek";
  const model = modelOverride ?? (config?.provider === provider ? config.model : presetModels[provider][0] ?? "");
  const baseUrl = baseUrlOverride ?? config?.baseUrl ?? "";

  function handleProviderChange(nextProvider: LLMProvider) {
    setProvider(nextProvider);
    setModel(presetModels[nextProvider][0] ?? "");
  }

  async function handleSave() {
    const payload: LLMUserConfig = {
      provider,
      model,
      apiKey: apiKey.trim(),
      ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
    };
    const ok = await saveConfig(payload);
    if (ok) {
      toast.success("LLM 配置已保存");
      setApiKey("");
      onOpenChange(false);
    } else {
      toast.error("LLM 配置保存失败");
    }
  }

  async function handleClear() {
    await clearConfig();
    setProvider(null);
    setModel(null);
    setBaseUrl(null);
    setApiKey("");
    toast.success("已清除 LLM 配置");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI 科研助手设置
          </DialogTitle>
          <DialogDescription>
            API Key 写入 httpOnly cookie，前端脚本无法读取。后续对话、周报、文献分析都通过本地 API Route 调用。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <select
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                value={provider}
                onChange={(event) => handleProviderChange(event.target.value as LLMProvider)}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>模型</Label>
              <select
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                {presetModels[provider].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={config ? "已配置，重新输入可覆盖" : "sk-..."}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                onClick={() => setShowKey((value) => !value)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>自定义 API 端点（可选）</Label>
            <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="留空使用默认端点" />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="ghost" onClick={handleClear} disabled={loading}>
              清除配置
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="button" onClick={handleSave} disabled={loading || !apiKey.trim()}>
                {loading ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
