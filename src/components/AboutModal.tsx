import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'

interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion: string
  downloadUrl: string
  releaseNotes: string
  fileName: string
}

interface AboutModalProps {
  onUpdateFound: (info: UpdateInfo) => void
  onClose: () => void
}

export default function AboutModal({ onUpdateFound, onClose }: AboutModalProps) {
  const [version, setVersion] = useState('...')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<'up-to-date' | 'error' | null>(null)

  useEffect(() => {
    getVersion().then(v => setVersion(v))
  }, [])

  const handleForceCheck = async () => {
    setChecking(true)
    setCheckResult(null)
    try {
      const info = await invoke<UpdateInfo>('check_update')
      if (info.available) {
        onUpdateFound(info)
        onClose()
      } else {
        setCheckResult('up-to-date')
      }
    } catch {
      setCheckResult('error')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-bg-panel border border-border-standard rounded-xl shadow-2xl w-[360px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-brand/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text-primary">测跳转</h2>
          <p className="text-sm text-text-quaternary mt-1">
            Redirect Tracker
          </p>
        </div>

        {/* Info */}
        <div className="px-6 py-4">
          <div className="bg-white/[0.02] rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-quaternary">应用名称</span>
              <span className="text-text-secondary">测跳转</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-quaternary">版本</span>
              <span className="text-text-secondary font-mono">v{version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-quaternary">技术栈</span>
              <span className="text-text-secondary">Tauri + React</span>
            </div>
          </div>

          {/* Check result feedback */}
          {checkResult === 'up-to-date' && (
            <div className="mt-3 text-center text-xs text-success">
              当前已是最新版本
            </div>
          )}
          {checkResult === 'error' && (
            <div className="mt-3 text-center text-xs text-error">
              检查更新失败，请稍后重试
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex justify-between gap-3">
          <button
            onClick={handleForceCheck}
            disabled={checking}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-border-standard text-text-secondary hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {checking ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-text-quaternary/30 border-t-text-secondary rounded-full animate-spin" />
                检查中...
              </>
            ) : (
              '检查更新'
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-brand hover:bg-brand-hover text-white transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
