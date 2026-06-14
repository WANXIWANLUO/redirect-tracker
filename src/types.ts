export interface HtmlRedirect {
  type: 'meta-refresh' | 'javascript';
  delay: number;
  url: string;
  description: string;
}

export interface RedirectStep {
  url: string;
  statusCode: number;
  statusText: string;
  responseTime: number;
  headers: Record<string, string>;
  isFileDownload: boolean;
  protocolChanged: boolean;
  body?: string;
  bodyTruncated?: boolean;
  contentType?: string;
  htmlRedirects?: HtmlRedirect[];
}

export interface TrackResult {
  id: string;
  originalUrl: string;
  steps: RedirectStep[];
  finalUrl: string;
  totalTime: number;
  stoppedReason: string;
  timestamp: string;
  proxyUsed: string | null;
  /** 追踪时使用的代理配置 ID */
  proxyId?: string | null;
  /** 追踪时使用的 UA 配置 ID */
  uaId?: string | null;
  /** 追踪时使用的国家地区 */
  countryUsed?: string;
  /** 备注名 */
  alias?: string;
  /** 追踪时使用的强传参数 */
  forceParamsUsed?: string;
  /** 追踪时使用的强传协议头 */
  forceHeadersUsed?: string;
  /** 追踪时是否查看IP */
  checkIpUsed?: boolean;
  /** 检测到的IP */
  detectedIp?: string;
}

export interface ProxyConfig {
  id: string;
  name: string;
  type: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface UAConfig {
  id: string;
  name: string;
  ua: string;
}

export type ThemeMode = 'light' | 'dark';

// ===== Tauri IPC 类型 =====

export interface TrackOptions {
  url: string;
  proxy: ProxyConfig | null;
  userAgent: string | null;
  forceParams: string | null;
  forceHeaders: string | null;
}

export interface TrackResponse {
  success: boolean;
  result?: TrackResult;
  error?: string;
}

export interface CheckIpResult {
  status: string;
  country: string;
  countryCode: string;
  query: string;
}

export interface CheckIpResponse {
  success: boolean;
  result?: CheckIpResult;
  error?: string;
}

// ===== Tauri 事件类型 =====

export interface TrackStepEvent {
  id: string;
  stepIndex: number;
  step: RedirectStep;
}

export interface TrackDoneEvent {
  id: string;
  result: TrackResult;
}

/** Response from a single `track_step` invoke */
export interface TrackStepResponse {
  step: RedirectStep;
  nextUrl: string | null;
  done: boolean;
  stoppedReason: string | null;
  cookieHeaders: string | null;
}
