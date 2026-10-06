import { MODULE_BY_KEY } from './modules'
import { SEED_ROWS } from './seed'
import { normalizeRows } from './status'
import type { EntryRow } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
const STORAGE_KEY = 'underground-pipeline-inspection:entries'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function fallbackStatus(key: string): string {
  return MODULE_BY_KEY.get(key)?.statuses[0] ?? ''
}

// 首次使用时播种：写成功才返回 true。和读取分开，保证读路径没有任何副作用。
function seedStorage(): boolean {
  if (!hasStorage()) {
    return false
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clone(SEED_ROWS)))
    return true
  } catch {
    return false
  }
}

// 纯读取：只解析 + 内存规范化，绝不回写。重复读多少次结果都一致。
function readStorage(): Record<string, EntryRow[]> {
  if (!hasStorage()) {
    return seedView()
  }
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return seedView()
  }
  if (raw === null) {
    // 首次打开：播种到磁盘，内存直接使用同一份种子；播种失败也只影响本机，不报错。
    seedStorage()
    return seedView()
  }
  let stored: Record<string, unknown>
  try {
    stored = JSON.parse(raw) as Record<string, unknown>
  } catch {
    // 旧版本/外部写坏的数据不在读路径上覆盖，退回内存种子，等下次显式写入再修复。
    return seedView()
  }
  const merged: Record<string, EntryRow[]> = {}
  for (const key of new Set([...Object.keys(SEED_ROWS), ...Object.keys(stored)])) {
    merged[key] = normalizeRows(stored[key] ?? SEED_ROWS[key] ?? [], fallbackStatus(key))
  }
  return merged
}

function seedView(): Record<string, EntryRow[]> {
  const view: Record<string, EntryRow[]> = {}
  for (const [key, rows] of Object.entries(SEED_ROWS)) {
    view[key] = normalizeRows(clone(rows), fallbackStatus(key))
  }
  return view
}

let cache: Record<string, EntryRow[]> | null = null

export function allRows(): Record<string, EntryRow[]> {
  if (cache === null) {
    cache = readStorage()
  }
  return cache
}

export function listRows(key: string): EntryRow[] {
  return allRows()[key] ?? []
}

// 原子提交：先整体落盘，落盘成功才更新内存。
// 序列化或 setItem 失败时磁盘与内存都维持原状，不留下半边更新。
export function saveRows(key: string, rows: EntryRow[]): void {
  const next = { ...allRows(), [key]: rows }
  if (hasStorage()) {
    const payload = JSON.stringify(next)
    window.localStorage.setItem(STORAGE_KEY, payload)
  }
  cache = next
}

export function resetRows(key: string): EntryRow[] {
  const rows = normalizeRows(clone(SEED_ROWS[key] ?? []), fallbackStatus(key))
  saveRows(key, rows)
  return rows
}

export function storageKey(): string {
  return STORAGE_KEY
}
