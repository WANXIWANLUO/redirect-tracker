import { useState, useCallback, useEffect } from 'react'
import { TrackResult, ProxyConfig, UAConfig, ThemeMode } from './types'
import { load, save, replacePlaceholders, resetStackRandom } from './utils'
import Sidebar from './components/Sidebar'
import TrackInput from './components/TrackInput'
import RedirectChain from './components/RedirectChain'
import ProxyManager from './components/ProxyManager'
import UAManager from './components/UAManager'

export default function App() {
  // Theme — default light
  const [theme, setTheme] = useState<ThemeMode>(() => load('theme', 'light'))

  // Persisted state
  const [history, setHistory] = useState<TrackResult[]>(() => load('history', []))
  const [proxies, setProxies] = useState<ProxyConfig[]>(() => load('proxies', []))
  const [uaList, setUaList] = useState<UAConfig[]>(() => load('uaList', []))
  const [selectedProxyId, setSelectedProxyId] = useState<string | null>(() => load('selectedProxyId', null))
  const [selectedUaId, setSelectedUaId] = useState<string | null>(() => load('selectedUaId', null))
  const [country, setCountry] = useState<string>(() => load('country', ''))

  // Force params & headers & checkIp
  const [forceParams, setForceParams] = useState<string>(() => load('forceParams', ''))
  const [forceHeaders, setForceHeaders] = useState<string>(() => load('forceHeaders', ''))
  const [checkIp, setCheckIp] = useState<boolean>(() => load('checkIp', false))
  const [detectedIp, setDetectedIp] = useState<string>('')

  // Ephemeral state
  const [currentResult, setCurrentResult] = useState<TrackResult | null>(null)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [showProxyManager, setShowProxyManager] = useState(false)
  const [showUaManager, setShowUaManager] = useState(false)
  const [inputUrl, setInputUrl] = useState('')

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    save('theme', theme)
  }, [theme])

  // Persist state changes
  useEffect(() => { save('history', history) }, [history])
  useEffect(() => { save('proxies', proxies) }, [proxies])
  useEffect(() => { save('uaList', uaList) }, [uaList])
  useEffect(() => { save('selectedProxyId', selectedProxyId) }, [selectedProxyId])
  useEffect(() => { save('selectedUaId', selectedUaId) }, [selectedUaId])
  useEffect(() => { save('country', country) }, [country])
  useEffect(() => { save('forceParams', forceParams) }, [forceParams])
  useEffect(() => { save('forceHeaders', forceHeaders) }, [forceHeaders])
  useEffect(() => { save('checkIp', checkIp) }, [checkIp])

  /** 从所有跳转步骤的 URL 中提取 offer_id 参数 */
  const extractOfferId = useCallback((result: TrackResult): string | null => {
    const urls = [result.originalUrl, ...result.steps.map(s => s.url)]
    for (const u of urls) {
      try {
        const url = new URL(u.startsWith('http') ? u : `http://${u}`)
        const oid = url.searchParams.get('offer_id')
        if (oid) return oid
      } catch { /* skip invalid */ }
    }
    return null
  }, [])

  /** 生成默认别名: offer_id+地区 + UA名  */
  const generateAlias = useCallback((result: TrackResult): string => {
    const parts: string[] = []
    const offerId = extractOfferId(result)
      if (offerId) {
          parts.push(offerId)
      }
    if (result.countryUsed) parts.push(result.countryUsed)
    if (result.uaId) {
      const uaConfig = uaList.find(u => u.id === result.uaId)
      if (uaConfig) parts.push(uaConfig.name)
    }
    
    if (offerId) {
    //   parts.push(offerId)
      return parts.join(' - ')
    }
    // 没有 offer_id 则默认空
    return ''
  }, [uaList, extractOfferId])

  const handleTrack = useCallback(async (url: string) => {
    setIsTracking(true)
    setCurrentResult(null)
    setSelectedHistoryId(null)
    setDetectedIp('')
    resetStackRandom()

    let detectedIpVal = ''

    try {
      const proxy = proxies.find(p => p.id === selectedProxyId)
      const uaConfig = uaList.find(u => u.id === selectedUaId)

      // Replace placeholders in proxy username/password
      let resolvedProxy = proxy ? { ...proxy } : null
      if (resolvedProxy) {
        resolvedProxy.username = replacePlaceholders(resolvedProxy.username || '', country)
        resolvedProxy.password = replacePlaceholders(resolvedProxy.password || '', country)
      }

      // Check IP first if enabled
      if (checkIp && window.electronAPI) {
        try {
          const ipData = await window.electronAPI.checkIp({ proxy: resolvedProxy })
          if (ipData.success && ipData.result?.status === 'success') {
            const ipInfo = ipData.result
            detectedIpVal = `${ipInfo.query} (${ipInfo.country} / ${ipInfo.countryCode})`
            setDetectedIp(detectedIpVal)
          } else {
            detectedIpVal = 'IP 检查失败'
            setDetectedIp(detectedIpVal)
          }
        } catch {
          detectedIpVal = 'IP 检查失败'
          setDetectedIp(detectedIpVal)
        }
      }

      const data = await window.electronAPI!.track({
        url,
        proxy: resolvedProxy,
        userAgent: uaConfig?.ua || null,
        forceParams: forceParams || null,
        forceHeaders: forceHeaders || null,
      })

      if (data.success) {
        const result = data.result as TrackResult
        result.proxyId = selectedProxyId
        result.uaId = selectedUaId
        result.countryUsed = country
        result.forceParamsUsed = forceParams
        result.forceHeadersUsed = forceHeaders
        result.checkIpUsed = checkIp
        result.detectedIp = detectedIpVal || undefined
        result.alias = generateAlias(result)
        setCurrentResult(result)
        setHistory(prev => {
          const idx = prev.findIndex(h => h.originalUrl === url)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = result
            return next
          }
          return [result, ...prev]
        })
      } else {
        alert(data.error || '追踪失败')
      }
    } catch (err) {
      alert('请求失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsTracking(false)
    }
  }, [proxies, selectedProxyId, uaList, selectedUaId, country, forceParams, forceHeaders, checkIp, generateAlias])

  const handleSelectHistory = useCallback((id: string) => {
    const item = history.find(h => h.id === id)
    if (item) {
      setCurrentResult(item)
      setSelectedHistoryId(id)
      setInputUrl(item.originalUrl)
      // 恢复该记录使用的代理、UA、国家地区
      if (item.proxyId !== undefined) setSelectedProxyId(item.proxyId)
      if (item.uaId !== undefined) setSelectedUaId(item.uaId)
      if (item.countryUsed !== undefined) setCountry(item.countryUsed)
      // 恢复强传参数、协议头、IP检查
      if (item.forceParamsUsed !== undefined) setForceParams(item.forceParamsUsed)
      if (item.forceHeadersUsed !== undefined) setForceHeaders(item.forceHeadersUsed)
      if (item.checkIpUsed !== undefined) setCheckIp(item.checkIpUsed)
      if (item.detectedIp) setDetectedIp(item.detectedIp)
    }
  }, [history])

  const handleDeleteHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id))
    if (selectedHistoryId === id) {
      setCurrentResult(null)
      setSelectedHistoryId(null)
    }
  }, [selectedHistoryId])

  const handleClearHistory = useCallback(() => {
    setHistory([])
    setCurrentResult(null)
    setSelectedHistoryId(null)
  }, [])

  const handleRenameHistory = useCallback((id: string, alias: string) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, alias } : h))
    if (currentResult?.id === id) {
      setCurrentResult(prev => prev ? { ...prev, alias } : prev)
    }
  }, [currentResult])

  const handleSaveProxy = useCallback((proxy: ProxyConfig) => {
    setProxies(prev => {
      const idx = prev.findIndex(p => p.id === proxy.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = proxy
        return next
      }
      return [...prev, proxy]
    })
  }, [])

  const handleDeleteProxy = useCallback((id: string) => {
    setProxies(prev => prev.filter(p => p.id !== id))
    if (selectedProxyId === id) setSelectedProxyId(null)
  }, [selectedProxyId])

  const handleSaveUa = useCallback((ua: UAConfig) => {
    setUaList(prev => {
      const idx = prev.findIndex(u => u.id === ua.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = ua
        return next
      }
      return [...prev, ua]
    })
  }, [])

  const handleDeleteUa = useCallback((id: string) => {
    setUaList(prev => prev.filter(u => u.id !== id))
    if (selectedUaId === id) setSelectedUaId(null)
  }, [selectedUaId])

  // Import/export handlers
  const handleImportProxies = useCallback((imported: ProxyConfig[]) => {
    setProxies(prev => {
      const map = new Map(prev.map(p => [p.id, p]))
      for (const p of imported) map.set(p.id, p)
      return Array.from(map.values())
    })
  }, [])

  const handleImportUas = useCallback((imported: UAConfig[]) => {
    setUaList(prev => {
      const map = new Map(prev.map(u => [u.id, u]))
      for (const u of imported) map.set(u.id, u)
      return Array.from(map.values())
    })
  }, [])

  return (
    <div className="flex h-screen bg-bg-marketing overflow-hidden">
      {/* Left sidebar - history */}
      <Sidebar
        history={history}
        selectedId={selectedHistoryId}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
        onClearAll={handleClearHistory}
        onRename={handleRenameHistory}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top: URL input + proxy + UA + start */}
        <TrackInput
          url={inputUrl}
          onChangeUrl={setInputUrl}
          proxies={proxies}
          selectedProxyId={selectedProxyId}
          onSelectProxy={setSelectedProxyId}
          onOpenProxyManager={() => setShowProxyManager(true)}
          uaList={uaList}
          selectedUaId={selectedUaId}
          onSelectUa={setSelectedUaId}
          onOpenUaManager={() => setShowUaManager(true)}
          country={country}
          onChangeCountry={setCountry}
          forceParams={forceParams}
          onChangeForceParams={setForceParams}
          forceHeaders={forceHeaders}
          onChangeForceHeaders={setForceHeaders}
          checkIp={checkIp}
          onToggleCheckIp={() => setCheckIp(v => !v)}
          detectedIp={detectedIp}
          onTrack={handleTrack}
          isTracking={isTracking}
          theme={theme}
          onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        />

        {/* Redirect chain display */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          <RedirectChain result={currentResult} isTracking={isTracking} />
        </div>
      </div>

      {/* Proxy manager modal */}
      {showProxyManager && (
        <ProxyManager
          proxies={proxies}
          onSave={handleSaveProxy}
          onDelete={handleDeleteProxy}
          onImport={handleImportProxies}
          onClose={() => setShowProxyManager(false)}
          country={country}
        />
      )}

      {/* UA manager modal */}
      {showUaManager && (
        <UAManager
          uaList={uaList}
          onSave={handleSaveUa}
          onDelete={handleDeleteUa}
          onImport={handleImportUas}
          onClose={() => setShowUaManager(false)}
        />
      )}
    </div>
  )
}
