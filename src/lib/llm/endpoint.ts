import { PROVIDER_ENDPOINTS, type LLMUserConfig } from "./types";

/** Custom gateways must be explicitly trusted by the server operator. */
export function resolveLLMEndpoint(config: LLMUserConfig, trustedBases = process.env.LLM_ALLOWED_BASE_URLS ?? "") {
  const endpoint = PROVIDER_ENDPOINTS[config.provider];
  if (!endpoint) throw new Error("不支持的 AI 服务商");
  const base = (config.baseUrl?.trim() || endpoint.baseUrl).replace(/\/+$/, "");
  const allowed = [endpoint.baseUrl, ...trustedBases.split(",").map((value) => value.trim().replace(/\/+$/, ""))];
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !allowed.includes(base)) {
    throw new Error("此 API 地址未获允许。请使用服务商默认地址，或由部署者配置可信 HTTPS 网关。");
  }
  return `${base}${endpoint.chatPath}`;
}
