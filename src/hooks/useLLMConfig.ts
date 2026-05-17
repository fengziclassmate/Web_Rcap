"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESET_MODELS } from "@/lib/llm/types";
import type { LLMUserConfig } from "@/lib/llm/types";

type SafeLLMConfig = Omit<LLMUserConfig, "apiKey">;

export type LLMConfigState = {
  configured: boolean;
  loading: boolean;
  error: string | null;
  config: SafeLLMConfig | null;
};

export function useLLMConfig() {
  const [state, setState] = useState<LLMConfigState>({
    configured: false,
    loading: true,
    error: null,
    config: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/llm/config");
      const data = await res.json();
      setState({
        configured: Boolean(data.configured),
        loading: false,
        error: null,
        config: data.config ?? null,
      });
    } catch (error) {
      setState({
        configured: false,
        loading: false,
        error: error instanceof Error ? error.message : "读取配置失败",
        config: null,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveConfig = useCallback(async (config: LLMUserConfig) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setState({
        configured: true,
        loading: false,
        error: null,
        config: data.config ?? {
          provider: config.provider,
          model: config.model,
          ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
        },
      });
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "保存失败",
      }));
      return false;
    }
  }, []);

  const clearConfig = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await fetch("/api/llm/config", { method: "DELETE" });
      setState({ configured: false, loading: false, error: null, config: null });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "清除配置失败",
      }));
    }
  }, []);

  return { ...state, saveConfig, clearConfig, refresh, presetModels: PRESET_MODELS };
}
