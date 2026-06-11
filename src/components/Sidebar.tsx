import { useState, useRef, useEffect } from 'react'
import { TrackResult } from '../types'

interface SidebarProps {
  history: TrackResult[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
  onRename: (id: string, alias: string) => void
}

export default function Sidebar({ history, selectedId, onSelect, onDelete, onClearAll, onRename }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const startEdit = (e: React.MouseEvent, item: TrackResult) => {
    e.stopPropagation()
    setEditingId(item.id)
    setEditValue(item.alias || '')
  }

  const commitEdit = () => {
    if (editingId) {
      onRename(editingId, editValue)
      setEditingId(null)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  return (
    <div className="w-64 flex-shrink-0 bg-bg-panel border-r border-border-subtle flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-wide text-text-secondary">历史记录</h2>
        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-text-quaternary hover:text-text-secondary transition-colors"
          >
            清空
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-quaternary text-sm">
            暂无记录
          </div>
        ) : (
          history.map(item => (
            <div
              key={item.id}
              className={`group px-4 py-3 border-b border-border-subtle cursor-pointer transition-colors ${
                selectedId === item.id
                  ? 'bg-white/[0.04]'
                  : 'hover:bg-white/[0.02]'
              }`}
              onClick={() => { if (editingId !== item.id) onSelect(item.id) }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* Alias (editable) */}
                  {editingId === item.id ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="w-full bg-bg-surface border border-brand-accent/50 rounded px-1.5 py-0.5 text-sm text-text-primary font-medium focus:outline-none"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {item.alias ? (
                        <p className="text-sm text-text-primary font-medium truncate">
                          {item.alias}
                        </p>
                      ) : (
                        <p className="text-sm text-text-quaternary italic truncate">
                          未命名
                        </p>
                      )}
                      <button
                        onClick={e => startEdit(e, item)}
                        className="opacity-0 group-hover:opacity-100 text-text-quaternary hover:text-text-secondary transition-all flex-shrink-0"
                        title="编辑备注"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {/* URL */}
                  <p className="text-text-quaternary font-mono text-xs truncate mt-0.5">
                    {item.originalUrl}
                  </p>
                  {/* Meta */}
                  <p className="text-xs text-text-quaternary mt-1">
                    {item.timestamp.split('T')[0]} {new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{item.steps.length} 跳
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(item.id) }}
                  className="opacity-0 group-hover:opacity-100 text-text-quaternary hover:text-error transition-all text-xs p-0.5"
                  title="删除"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
