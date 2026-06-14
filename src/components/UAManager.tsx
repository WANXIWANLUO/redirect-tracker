import { useState, useRef, useEffect } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { UAConfig } from '../types'

interface UAManagerProps {
  uaList: UAConfig[]
  onSave: (ua: UAConfig) => void
  onDelete: (id: string) => void
  onImport: (uas: UAConfig[]) => void
  onClose: () => void
}

const PRESET_UAS: Omit<UAConfig, 'id'>[] = [
  // iOS Safari
  {
    name: 'iOS 13 Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iOS 14 Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iOS 15 Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iOS 16 Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iOS 17 Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iOS 18 Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iOS 26 Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  },
  // Android Chrome
  {
    name: 'Android 10 Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 10; Pixel 3a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Android 11 Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 11; Pixel 4a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Android 12 Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Android 13 Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Android 14 Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Android 15 Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Android 16 Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Android 17 Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 17; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
]

const emptyUa: Omit<UAConfig, 'id'> = {
  name: '',
  ua: '',
}

export default function UAManager({ uaList, onSave, onDelete, onImport, onClose }: UAManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<UAConfig, 'id'>>(emptyUa)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // 编辑时自动滚动到底部并聚焦第一个输入框
  useEffect(() => {
    if (editingId) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
          nameInputRef.current?.focus()
        })
      })
    }
  }, [editingId])

  const handleNew = () => {
    setEditingId('new')
    setForm(emptyUa)
  }

  const handleEdit = (ua: UAConfig) => {
    setEditingId(ua.id)
    setForm({ name: ua.name, ua: ua.ua })
  }

  const handlePreset = (preset: Omit<UAConfig, 'id'>) => {
    setEditingId('new')
    setForm(preset)
  }

  const handleSave = () => {
    if (!form.name.trim() || !form.ua.trim()) return
    const id = editingId === 'new' ? crypto.randomUUID() : editingId!
    onSave({ id, ...form })
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  const handleExport = async () => {
    const filePath = await save({
      defaultPath: `ua_list_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (filePath) {
      const json = JSON.stringify(uaList, null, 2)
      await writeTextFile(filePath, json)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (Array.isArray(data)) {
          onImport(data)
        } else {
          alert('导入格式错误：需要 JSON 数组')
        }
      } catch {
        alert('导入失败：JSON 解析错误')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-surface border border-border-standard rounded-xl w-full max-w-xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="text-base font-medium text-text-primary">UA 管理</h2>
          <button onClick={onClose} className="text-text-quaternary hover:text-text-secondary transition-colors">✕</button>
        </div>

        <div ref={scrollRef} className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-4">
          {/* Import/Export buttons */}
          {uaList.length > 0 && !editingId && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-3 py-1.5 rounded bg-white/[0.03] border border-border-subtle"
              >
                📥 导出
              </button>
              <button
                onClick={handleImportClick}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-3 py-1.5 rounded bg-white/[0.03] border border-border-subtle"
              >
                📤 导入
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          )}

          {/* Existing UA list */}
          {uaList.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-text-quaternary">已保存的 UA</p>
              {uaList.map(u => (
                <div key={u.id} className="flex items-center gap-3 bg-white/[0.02] border border-border-subtle rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{u.name}</p>
                    <p className="text-xs text-text-quaternary font-mono mt-0.5 break-all">
                      {u.ua}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(u)}
                      className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1 rounded bg-white/[0.03]"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => onDelete(u.id)}
                      className="text-xs text-error/70 hover:text-error transition-colors px-2 py-1 rounded bg-white/[0.03]"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preset UA quick-add */}
          {!editingId && (
            <div>
              <p className="text-xs text-text-quaternary mb-2">快速添加预设 UA</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_UAS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handlePreset(p)}
                    className="text-xs bg-white/[0.02] border border-border-subtle rounded-md px-2.5 py-1.5 text-text-tertiary hover:text-text-secondary hover:border-brand/30 transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add/Edit form */}
          {editingId ? (
            <div ref={formRef} className="bg-white/[0.02] border border-border-subtle rounded-lg p-4 space-y-3">
              <h3 className="text-sm text-text-secondary font-medium">
                {editingId === 'new' ? '添加 UA' : '编辑 UA'}
              </h3>

              <div>
                <label className="text-xs text-text-quaternary block mb-1">名称</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/50"
                  placeholder="如: Chrome 120"
                />
              </div>
              <div>
                <label className="text-xs text-text-quaternary block mb-1">User-Agent 字符串</label>
                <textarea
                  value={form.ua}
                  onChange={e => setForm(f => ({ ...f, ua: e.target.value }))}
                  rows={3}
                  className="w-full bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/50 font-mono text-xs resize-none"
                  placeholder="Mozilla/5.0 ..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary bg-white/[0.02] border border-border-standard rounded-md transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim() || !form.ua.trim()}
                  className="px-4 py-2 text-sm text-white bg-brand hover:bg-brand-hover disabled:opacity-40 rounded-md transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleNew}
                className="w-full border border-dashed border-border-standard rounded-lg py-3 text-sm text-text-tertiary hover:text-text-secondary hover:border-brand/30 transition-colors"
              >
                + 自定义 UA
              </button>
              {uaList.length === 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleImportClick}
                    className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-3 py-1.5 rounded bg-white/[0.03] border border-border-subtle"
                  >
                    📤 从文件导入
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
