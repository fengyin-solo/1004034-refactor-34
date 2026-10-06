import { SEED_ROWS } from './seed'
import type { EntryRow } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
const STORAGE_KEY = 'underground-pipeline-inspection:entries'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function storage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }
  return window.localStorage
}

// 旧数据兼容：单个模块的存量必须是对象数组；整体损坏就回退种子，零散的坏行剔掉、好行保留。
function validRows(value: unknown, fallback: EntryRow[]): EntryRow[] {
  if (!Array.isArray(value)) {
    return fallback
  }
  return value.filter(
    (row): row is EntryRow => typeof row === 'object' && row !== null && !Array.isArray(row),
  )
}

// 纯读取：只把存储内容合并进内存，绝不回写；重复读取不会改变任何状态。
function loadStorage(): Record<string, EntryRow[]> {
  const fallback = clone(SEED_ROWS)
  const store = storage()
  if (!store) {
    return fallback
  }
  const raw = store.getItem(STORAGE_KEY)
  if (!raw) {
    return fallback
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return fallback
    }
    // 未登记的 key 原样保留（向前兼容），已登记的模块逐个校验形状。
    const merged = { ...parsed } as Record<string, EntryRow[]>
    for (const key of Object.keys(fallback)) {
      merged[key] = validRows(parsed[key], fallback[key])
    }
    return merged
  } catch {
    // 数据损坏时只在内存里回退种子，不覆盖本地存储；下次成功写入自然会修复。
    return fallback
  }
}

let cache: Record<string, EntryRow[]> | null = null

export function allRows(): Record<string, EntryRow[]> {
  if (cache === null) {
    cache = loadStorage()
  }
  return cache
}

export function listRows(key: string): EntryRow[] {
  return allRows()[key] ?? []
}

// 原子写入：先落盘再换内存缓存；落盘失败时缓存保持原样，不会留下半边更新。
export function saveRows(key: string, rows: EntryRow[]): void {
  const next = { ...allRows(), [key]: rows }
  const store = storage()
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      throw new Error('本地存储写入失败，本次修改未保存，请释放空间后重试')
    }
  }
  cache = next
}

export function resetRows(key: string): EntryRow[] {
  const rows = clone(SEED_ROWS[key] ?? [])
  saveRows(key, rows)
  return rows
}

export function storageKey(): string {
  return STORAGE_KEY
}
