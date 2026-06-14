import { useState } from 'react'
import { ProxyConfig, UAConfig, ThemeMode } from '../types'

interface TrackInputProps {
  url: string
  onChangeUrl: (url: string) => void
  proxies: ProxyConfig[]
  selectedProxyId: string | null
  onSelectProxy: (id: string | null) => void
  onOpenProxyManager: () => void
  uaList: UAConfig[]
  selectedUaId: string | null
  onSelectUa: (id: string | null) => void
  onOpenUaManager: () => void
  country: string
  onChangeCountry: (v: string) => void
  forceParams: string
  onChangeForceParams: (v: string) => void
  forceHeaders: string
  onChangeForceHeaders: (v: string) => void
  checkIp: boolean
  onToggleCheckIp: () => void
  detectedIp: string
  onTrack: (url: string) => void
  isTracking: boolean
  theme: ThemeMode
  onChangeTheme: (theme: ThemeMode) => void
}

export default function TrackInput({
  url, onChangeUrl,
  proxies, selectedProxyId, onSelectProxy, onOpenProxyManager,
  uaList, selectedUaId, onSelectUa, onOpenUaManager,
  country, onChangeCountry,
  forceParams, onChangeForceParams,
  forceHeaders, onChangeForceHeaders,
  checkIp, onToggleCheckIp, detectedIp,
  onTrack, isTracking,
  theme, onChangeTheme,
}: TrackInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim() && !isTracking) {
      onTrack(url.trim())
    }
  }

  const selectedProxy = proxies.find(p => p.id === selectedProxyId)
  const selectedUa = uaList.find(u => u.id === selectedUaId)
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="border-b border-border-subtle bg-bg-panel/50 px-6 py-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Row 1: URL input + Start button */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={e => onChangeUrl(e.target.value)}
              placeholder="输入要追踪的 URL..."
              className="w-full bg-white/[0.02] border border-border-standard rounded-md px-4 py-2.5 text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 font-mono transition-colors"
              disabled={isTracking}
            />
          </div>

          <button
            type="submit"
            disabled={!url.trim() || isTracking}
            className="bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-md px-5 py-2.5 text-sm transition-colors flex items-center gap-2 flex-shrink-0"
          >
            {isTracking ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                追踪中...
              </>
            ) : (
              '▶ 开始追踪'
            )}
          </button>
        </div>

        {/* Row 2: Proxy + UA + Country + Force Params/Headers + CheckIp + Theme */}
              <div className="flex items-center gap-3 flex-wrap">
              <button
            type="button"
            onClick={onOpenProxyManager}
            className="bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-white/[0.04] hover:text-text-primary transition-colors flex-shrink-0"
            title="代理管理"
          >
            ⚙ 代理:
          </button>
                  {/* Proxy selector */}
                  
          <div className="relative">
            <select
              value={selectedProxyId || ''}
              onChange={e => onSelectProxy(e.target.value || null)}
              className="appearance-none bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 pr-8 text-sm text-text-secondary focus:outline-none focus:border-brand-accent/50 cursor-pointer transition-colors"
            >
              <option value="">直连</option>
              {proxies.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type.toUpperCase()})
                </option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-quaternary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          

          {/* Divider */}
          <div className="w-px h-6 bg-border-standard flex-shrink-0" />
          <button
            type="button"
            onClick={onOpenUaManager}
            className="bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-white/[0.04] hover:text-text-primary transition-colors flex-shrink-0"
            title="UA 管理"
          >
            ⚙ UA:
          </button>
          {/* UA selector */}
          <div className="relative">
            <select
              value={selectedUaId || ''}
              onChange={e => onSelectUa(e.target.value || null)}
              className="appearance-none bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 pr-8 text-sm text-text-secondary focus:outline-none focus:border-brand-accent/50 cursor-pointer transition-colors"
            >
              <option value="">默认 UA</option>
              {uaList.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-quaternary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          

          {/* Divider */}
          <div className="w-px h-6 bg-border-standard flex-shrink-0" />

          {/* Country/Region */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <label className="text-xs text-text-quaternary whitespace-nowrap">地区</label>
            <input
              type="text"
              value={country}
              onChange={e => onChangeCountry(e.target.value.toUpperCase())}
              placeholder="如: US"
              className="w-20 bg-white/[0.02] border border-border-standard rounded-md px-2 py-2 text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand-accent/50 font-mono transition-colors"
            />
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border-standard flex-shrink-0" />

          {/* Check IP toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={checkIp}
              onChange={onToggleCheckIp}
              className="w-3.5 h-3.5 rounded accent-brand"
            />
            <span className="text-xs text-text-quaternary whitespace-nowrap">查看IP</span>
          </label>

          {/* Divider */}
          <div className="w-px h-6 bg-border-standard flex-shrink-0" />

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className={`border rounded px-2 py-1 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-text-primary transition-colors flex-shrink-0 ${showAdvanced ? 'border-brand-accent/30 text-brand-accent' : 'border-border-standard'}`}
            title="强传参数 / 强传头"
          >
            更多{showAdvanced ? '▲' : '▼'}
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Theme selector */}
          <div className="relative flex-shrink-0">
            <select
              value={theme}
              onChange={e => onChangeTheme(e.target.value as ThemeMode)}
              className="appearance-none bg-white/[0.02] border border-border-standard rounded px-2 py-1 pr-6 text-xs text-text-secondary focus:outline-none focus:border-brand-accent/50 cursor-pointer transition-colors"
              title="选择主题"
            >
              <option value="light">浅色</option>
              <option value="dim">暗色</option>
              <option value="dark">深黑</option>
              <option value="midnight">午夜蓝</option>
              <option value="ocean">海洋蓝</option>
            </select>
            <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-quaternary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Row 3: Force Params + Force Headers (collapsible) */}
        {showAdvanced && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Force Params */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs text-text-quaternary whitespace-nowrap flex-shrink-0">强传参数</label>
            <input
              type="text"
              value={forceParams}
              onChange={e => onChangeForceParams(e.target.value)}
              placeholder="如: af_id=123&click_id=abc"
              className="flex-1 bg-white/[0.02] border border-border-standard rounded-md px-2 py-2 text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand-accent/50 font-mono transition-colors"
            />
          </div>

          {/* Force Headers */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs text-text-quaternary whitespace-nowrap flex-shrink-0">强传头</label>
            <textarea
              value={forceHeaders}
              onChange={e => onChangeForceHeaders(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation() }}
              placeholder={"一行一个，如:\nContent-Type: application/json\nX-Custom: value"}
              className="flex-1 bg-white/[0.02] border border-border-standard rounded-md px-2 py-2 text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand-accent/50 font-mono transition-colors resize-y min-h-[36px] max-h-[120px]"
              title="一行一个，格式: Header-Name: value"
              rows={2}
            />
          </div>
        </div>
        )}
      </form>

      {/* Active indicators */}
      {(selectedProxy || selectedUa || country || forceParams || forceHeaders || checkIp) && (
        <div className="mt-2 flex items-center gap-3 text-xs text-text-quaternary flex-wrap">
          {selectedProxy && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
              代理: <span className="text-text-tertiary">{selectedProxy.name}</span>
              <span className="text-text-quaternary">({selectedProxy.host}:{selectedProxy.port})</span>
            </span>
          )}
          {selectedUa && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-accent" />
              UA: <span className="text-text-tertiary">{selectedUa.name}</span>
            </span>
          )}
          {country && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning" />
              地区: <span className="text-text-tertiary">{country}</span>
            </span>
          )}
          {forceParams && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-error" />
              强传: <span className="text-text-tertiary font-mono">{forceParams}</span>
            </span>
          )}
          {forceHeaders && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-info" />
              强传头: <span className="text-text-tertiary font-mono">{forceHeaders.substring(0, 50)}{forceHeaders.length > 50 ? '...' : ''}</span>
            </span>
          )}
          {checkIp && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
              查看IP
            </span>
          )}
          {detectedIp && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-success/10 text-success rounded">
              IP: {detectedIp}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
