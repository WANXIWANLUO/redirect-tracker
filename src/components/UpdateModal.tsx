import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import ReactMarkdown from 'react-markdown'

interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion: string
  downloadUrl: string
  releaseNotes: string
  fileName: string
}

interface DownloadProgress {
  downloaded: number
  total: number
  percent: number
}

type UpdateStage = 'prompt' | 'downloading' | 'downloaded' | 'error'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface UpdateModalProps {
  info: UpdateInfo
  onClose: () => void
}

export default function UpdateModal({ info, onClose }: UpdateModalProps) {
  const [stage, setStage] = useState<UpdateStage>('prompt')
  const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: 0, percent: 0 })
  const [errorMsg, setErrorMsg] = useState('')
  const [filePath, setFilePath] = useState('')

  useEffect(() => {
    const unlisten = listen<DownloadProgress>('update-download-progress', (e) => {
      setProgress(e.payload)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const handleDownload = async () => {
    setStage('downloading')
    try {
      const path = await invoke<string>('download_update', {
        url: info.downloadUrl,
        fileName: info.fileName,
      })
      setFilePath(path)
      setStage('downloaded')
    } catch (err) {
      setErrorMsg(String(err))
      setStage('error')
    }
  }

  const handleInstall = async () => {
    try {
      await invoke('install_update', { filePath })
    } catch (err) {
      setErrorMsg(String(err))
      setStage('error')
    }
  }

  const percentDisplay = progress.percent.toFixed(1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[440px] overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            发现新版本 v{info.latestVersion}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            当前版本 v{info.currentVersion}
          </p>
        </div>

        {/* Release notes */}
        {info.releaseNotes && (
          <div className="px-6 pb-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 max-h-48 overflow-auto text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-h3:text-base prose-h4:text-sm">
              <ReactMarkdown>{info.releaseNotes}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Progress / Error */}
        {stage === 'downloading' && (
          <div className="px-6 pb-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>正在下载...</span>
              <span>{percentDisplay}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{formatBytes(progress.downloaded)}</span>
              <span>{progress.total > 0 ? formatBytes(progress.total) : '计算中...'}</span>
            </div>
          </div>
        )}

        {stage === 'downloaded' && (
          <div className="px-6 pb-4">
            <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg p-3 text-sm">
              下载完成！点击"安装"按钮将关闭当前应用并启动安装程序。
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="px-6 pb-4">
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg p-3 text-sm">
              {errorMsg}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          {stage === 'prompt' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                稍后再说
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
              >
                立即下载
              </button>
            </>
          )}
          {stage === 'downloading' && (
            <button
              disabled
              className="px-4 py-2 text-sm rounded-lg bg-blue-400 text-white cursor-not-allowed"
            >
              下载中 {percentDisplay}%
            </button>
          )}
          {stage === 'downloaded' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                稍后安装
              </button>
              <button
                onClick={handleInstall}
                className="px-4 py-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 transition"
              >
                安装并重启
              </button>
            </>
          )}
          {stage === 'error' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
