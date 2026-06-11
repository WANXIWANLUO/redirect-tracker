import { useState, useRef } from 'react'
import { ProxyConfig } from '../types'

interface ProxyManagerProps {
  proxies: ProxyConfig[]
  onSave: (proxy: ProxyConfig) => void
  onDelete: (id: string) => void
  onImport: (proxies: ProxyConfig[]) => void
  onClose: () => void
  country: string
}

const emptyProxy: Omit<ProxyConfig, 'id'> = {
  name: '',
  type: 'http',
  host: '',
  port: 1080,
  username: '',
  password: '',
}

export default function ProxyManager({ proxies, onSave, onDelete, onImport, onClose, country }: ProxyManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<ProxyConfig, 'id'>>(emptyProxy)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleNew = () => {
    setEditingId('new')
    setForm(emptyProxy)
  }

  const handleEdit = (proxy: ProxyConfig) => {
    setEditingId(proxy.id)
    setForm({
      name: proxy.name,
      type: proxy.type,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username || '',
      password: proxy.password || '',
    })
  }

  const handleSave = () => {
    if (!form.name.trim() || !form.host.trim()) return
    const id = editingId === 'new' ? crypto.randomUUID() : editingId!
    onSave({ id, ...form })
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  const handleExport = () => {
    const json = JSON.stringify(proxies, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proxies_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
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
    // Reset input so same file can be re-imported
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-surface border border-border-standard rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="text-base font-medium text-text-primary">代理管理</h2>
          <button onClick={onClose} className="text-text-quaternary hover:text-text-secondary transition-colors">✕</button>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Import/Export buttons */}
          {proxies.length > 0 && !editingId && (
            <div className="flex items-center gap-2 mb-4">
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

          {/* Existing proxies */}
          {proxies.length > 0 && (
            <div className="space-y-2 mb-4">
              {proxies.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-white/[0.02] border border-border-subtle rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{p.name}</p>
                    <p className="text-xs text-text-quaternary font-mono mt-0.5 break-all">
                      {p.type.toUpperCase()}://{p.host}:{p.port}
                    </p>
                    {(p.username || p.password) && (
                      <p className="text-xs text-text-quaternary mt-0.5">
                        认证: {p.username || '-'} / {'*'.repeat((p.password || '').length) || '-'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(p)}
                      className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1 rounded bg-white/[0.03]"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="text-xs text-error/70 hover:text-error transition-colors px-2 py-1 rounded bg-white/[0.03]"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit form */}
          {editingId ? (
            <div className="bg-white/[0.02] border border-border-subtle rounded-lg p-4 space-y-3">
              <h3 className="text-sm text-text-secondary font-medium">
                {editingId === 'new' ? '添加代理' : '编辑代理'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-quaternary block mb-1">名称</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/50"
                    placeholder="我的代理"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-quaternary block mb-1">类型</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as ProxyConfig['type'] }))}
                    className="w-full bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/50"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-quaternary block mb-1">主机</label>
                  <input
                    type="text"
                    value={form.host}
                    onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                    className="w-full bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/50 font-mono"
                    placeholder="127.0.0.1"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-quaternary block mb-1">端口</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/50 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-quaternary block mb-1">用户名 (可选)</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/50 font-mono"
                    placeholder="支持 {country} {random} {stack}"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-quaternary block mb-1">密码 (可选)</label>
                  <input
                    type="text"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-white/[0.02] border border-border-standard rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/50 font-mono"
                    placeholder="支持 {country} {random} {stack}"
                  />
                </div>
              </div>

              {/* Placeholder help */}
              <div className="bg-bg-deep rounded-md p-3 text-xs text-text-tertiary space-y-1">
                <p className="text-text-secondary font-medium mb-1">占位符说明：</p>
                <p><code className="text-brand-accent">{'{country}'}</code> → 替换为当前地区设置{country ? ` (${country})` : ''}</p>
                <p><code className="text-brand-accent">{'{random}'}</code> → 每次追踪时生成随机 8 位字符串</p>
                <p><code className="text-brand-accent">{'{stack}'}</code> → 堆积随机字符，每次追加 4 位</p>
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
                  disabled={!form.name.trim() || !form.host.trim()}
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
                + 添加代理
              </button>
              {proxies.length === 0 && (
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
