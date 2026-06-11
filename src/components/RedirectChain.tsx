import { useState } from 'react'
import { TrackResult, RedirectStep, HtmlRedirect } from '../types'

interface RedirectChainProps {
  result: TrackResult | null
  isTracking: boolean
}

/** 需要高亮的关键参数名列表 */
const HIGHLIGHT_PARAMS = new Set([
  'idfa', 'gaid', 'idfv', 'ip', 'af_ip', 'af_id',
  'offer_id', 'click_id', 'campaign_id', 'af_clickid',
  'af_siteid', 'af_channel', 'af_c_id', 'af_adset',
  'google_aid', 'android_id', 'advertising_id',
  'device_id', 'app_id', 'install_id',
])

/** 判断参数名是否需要高亮 */
function isHighlightParam(key: string): boolean {
  return HIGHLIGHT_PARAMS.has(key.toLowerCase())
}

/** 渲染 URL，高亮关键参数 */
function HighlightUrl({ url }: { url: string }) {
  try {
    // 如果已有协议(scheme://)则不添加 http:// 前缀
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(url)
    const u = new URL(hasScheme ? url : `http://${url}`)
    const base = `${u.protocol}//${u.host}${u.pathname}`
    const params = Array.from(u.searchParams.entries())
    const hash = u.hash

    if (params.length === 0 && !hash) {
      return <>{url}</>
    }

    return (
      <span className="break-all">
        {base}
        {params.length > 0 && (
          <>
            {'?'}
            {params.map(([key, value], i) => (
              <span key={i}>
                {i > 0 && '&'}
                {isHighlightParam(key) ? (
                  <span className="font-bold text-error">
                    {key}={value}
                  </span>
                ) : (
                  <>{key}={value}</>
                )}
              </span>
            ))}
          </>
        )}
        {hash && <span className="text-text-quaternary">{hash}</span>}
      </span>
    )
  } catch {
    return <span className="break-all">{url}</span>
  }
}

/** 渲染 Header 值，高亮包含关键参数的部分 */
function HighlightHeaderValue({ value }: { value: string }) {
  // Check if value contains any highlight param patterns like key=value
  const parts: JSX.Element[] = []
  const regex = /\b([a-zA-Z_][a-zA-Z0-9_]*)=([^&\s,;]+)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{value.substring(lastIndex, match.index)}</span>)
    }
    if (isHighlightParam(match[1])) {
      parts.push(
        <span key={`h-${match.index}`} className="font-bold text-error">
          {match[0]}
        </span>
      )
    } else {
      parts.push(<span key={`n-${match.index}`}>{match[0]}</span>)
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < value.length) {
    parts.push(<span key={`e-${lastIndex}`}>{value.substring(lastIndex)}</span>)
  }

  return parts.length > 0 ? <>{parts}</> : <>{value}</>
}

function StatusBadge({ statusCode }: { statusCode: number }) {
  let color = 'text-text-quaternary bg-white/[0.03]'
  if (statusCode >= 200 && statusCode < 300) color = 'text-success bg-success/10'
  else if (statusCode >= 300 && statusCode < 400) color = 'text-brand-accent bg-brand/10'
  else if (statusCode >= 400 && statusCode < 500) color = 'text-warning bg-warning/10'
  else if (statusCode >= 500) color = 'text-error bg-error/10'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${color}`}>
      {statusCode}
    </span>
  )
}

function HtmlRedirectBadge({ redirect }: { redirect: HtmlRedirect }) {
  const isMeta = redirect.type === 'meta-refresh'
  return (
    <div className="flex items-center gap-2 bg-warning/[0.06] border border-warning/20 rounded-md px-3 py-2">
      <span className={`text-xs font-medium ${isMeta ? 'text-warning' : 'text-info'}`}>
        {isMeta ? '⟳' : '⚡'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-secondary">{redirect.description}</p>
        <p className="text-xs text-text-quaternary font-mono break-all" title={redirect.url}>
          → <HighlightUrl url={redirect.url} />
        </p>
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(redirect.url)}
        className="text-xs text-text-quaternary hover:text-text-secondary transition-colors flex-shrink-0"
        title="复制 URL"
      >
        📋
      </button>
    </div>
  )
}

function BodyPreview({ body, contentType, truncated }: { body: string; contentType: string; truncated?: boolean }) {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('code')
  const isHtml = contentType.includes('text/html')
  const lines = body.split('\n').length
  const displayBody = body.length > 50000 ? body.substring(0, 50000) + '\n... (内容过长，已截断)' : body

  return (
    <div className="mt-3 pt-3 border-t border-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-text-quaternary">响应内容</p>
          <span className="text-xs text-text-quaternary">
            ({(body.length / 1024).toFixed(1)}KB · {lines} 行)
          </span>
          {truncated && (
            <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded">已截断</span>
          )}
        </div>
        {isHtml && (
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-md p-0.5">
            <button
              onClick={() => setViewMode('code')}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode === 'code' ? 'bg-white/[0.06] text-text-primary' : 'text-text-quaternary hover:text-text-secondary'
              }`}
            >
              源码
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode === 'preview' ? 'bg-white/[0.06] text-text-primary' : 'text-text-quaternary hover:text-text-secondary'
              }`}
            >
              预览
            </button>
          </div>
        )}
      </div>

      {viewMode === 'preview' && isHtml ? (
        <div className="bg-white rounded-md overflow-hidden border border-border-subtle">
          <iframe
            srcDoc={displayBody}
            className="w-full h-96 border-0"
            sandbox="allow-same-origin"
            title="HTML 预览"
          />
        </div>
      ) : (
        <div className="bg-bg-deep rounded-md p-3 font-mono text-xs max-h-96 overflow-auto whitespace-pre-wrap break-all text-text-secondary">
          {displayBody}
        </div>
      )}
    </div>
  )
}

function StepCard({ step, index, isLast, defaultExpanded }: { step: RedirectStep; index: number; isLast: boolean; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showBody, setShowBody] = useState(defaultExpanded)
  const isTerminal = step.statusCode < 300 || step.statusCode >= 400
  const hasBody = !!step.body
  const hasHtmlRedirects = step.htmlRedirects && step.htmlRedirects.length > 0

  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-[48px] bottom-[-24px] w-px bg-border-subtle" />
      )}

      <div
        className="bg-white/[0.02] border border-border-standard rounded-lg p-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Step header */}
        <div className="flex items-center gap-3">
          {/* Step number */}
          <div className={`flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-medium ${
            isTerminal && step.statusCode >= 200 && step.statusCode < 300
              ? 'bg-success/10 text-success'
              : isTerminal
                ? 'bg-error/10 text-error'
                : 'bg-brand/10 text-brand-accent'
          }`}>
            {index + 1}
          </div>

          {/* Status + URL */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge statusCode={step.statusCode} />
              <span className="text-xs text-text-quaternary">{step.statusText}</span>
              {step.protocolChanged && (
                <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded">协议变更</span>
              )}
              {step.isFileDownload && (
                <span className="text-xs text-info bg-info/10 px-1.5 py-0.5 rounded">文件下载</span>
              )}
              {hasHtmlRedirects && (
                <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                  ⚡ 检测到 {step.htmlRedirects!.length} 个 HTML/JS 跳转
                </span>
              )}
              {hasBody && (
                <span className="text-xs text-text-quaternary bg-white/[0.03] px-1.5 py-0.5 rounded">
                  {(step.body!.length / 1024).toFixed(1)}KB
                </span>
              )}
            </div>
            {/* URL with param highlighting */}
            <p className="text-sm text-text-primary font-mono">
              <HighlightUrl url={step.url} />
            </p>
          </div>

          {/* Response time */}
          <div className="flex-shrink-0 text-right">
            <p className="text-sm text-text-secondary font-mono">{step.responseTime}ms</p>
          </div>

          {/* Expand indicator */}
          <svg
            className={`w-4 h-4 text-text-quaternary transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border-subtle space-y-3" onClick={e => e.stopPropagation()}>
            {/* HTML/JS Redirects */}
            {hasHtmlRedirects && (
              <div>
                <p className="text-xs text-warning mb-2 flex items-center gap-1">
                  ⚡ 检测到 HTML/JS 跳转（非 HTTP 重定向，需浏览器执行）
                </p>
                <div className="space-y-2">
                  {step.htmlRedirects!.map((redirect, ri) => (
                    <HtmlRedirectBadge key={ri} redirect={redirect} />
                  ))}
                </div>
              </div>
            )}

            {/* Headers with value highlighting */}
            <div>
              <p className="text-xs text-text-quaternary mb-2">响应头</p>
              <div className="bg-bg-deep rounded-md p-3 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                {Object.entries(step.headers).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-brand-accent flex-shrink-0">{key}:</span>
                    <span className="text-text-secondary break-all">
                      <HighlightHeaderValue value={value} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Body preview toggle */}
            {hasBody && (
              <div>
                <button
                  onClick={() => setShowBody(!showBody)}
                  className="text-xs text-brand-accent hover:text-brand-hover transition-colors flex items-center gap-1"
                >
                  <svg className={`w-3 h-3 transition-transform ${showBody ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {showBody ? '隐藏响应内容' : '查看响应内容'}
                </button>

                {showBody && (
                  <BodyPreview
                    body={step.body!}
                    contentType={step.contentType || ''}
                    truncated={step.bodyTruncated}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RedirectChain({ result, isTracking }: RedirectChainProps) {
  if (isTracking) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-brand/30 border-t-brand-accent rounded-full animate-spin mb-4" />
          <p className="text-text-secondary text-sm">正在追踪重定向链路...</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4 opacity-20">🔗</div>
          <p className="text-text-secondary text-sm">输入 URL 开始追踪重定向链路</p>
          <p className="text-text-quaternary text-xs mt-2">
            支持 HTTP 3xx 重定向追踪，自动检测 HTML meta-refresh 和 JavaScript 跳转
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-2">
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-4 px-1 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span className="text-text-quaternary">原始 URL:</span>
          <span className="font-mono text-text-secondary">
            <HighlightUrl url={result.originalUrl} />
          </span>
        </div>
        <div className="text-xs text-text-quaternary">
          {result.steps.length} 跳 · 总耗时 {result.totalTime}ms
        </div>
        {result.stoppedReason && (
          <div className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded">
            {result.stoppedReason}
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {result.steps.map((step, i) => (
          <StepCard
            key={i}
            step={step}
            index={i}
            isLast={i === result.steps.length - 1}
            defaultExpanded={i === result.steps.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
