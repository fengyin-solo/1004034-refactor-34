import type { EntryRow } from './types'

// 统一状态口径：status 是唯一事实源，待处理/异常都从它推导。
// 只有旧数据缺字段时才用这里兜底；记录里已经显式写过的 pending/abnormal 一律原样保留，
// 这样历史报告和导出的结论不会被重读改写。

// 已了结状态：命中后不再算待处理。
// 注意「待复检 / 需复测 / 需复查 / 需返修」不在其中——复检返修期仍要待处理。
const RESOLVED_STATUS =
  /^已(完成|修复|通过|停用|忽略|返回|更换|停机|封堵|处置|归档|清退|校准|建档|备案|出结果|作废)$/
const RESOLVED_EXTRA = new Set(['在线', '正常'])

// 走到这些状态说明问题已被实质消除，原先挂着的异常标记可以摘掉。
const REMEDIED_STATUS = /修复|通过|完成|处置|更换|校准|封堵/

// 旧数据没有 abnormal 时，按状态字眼兜底识别异常。
const ABNORMAL_STATUS = /异常|故障|超标|风险|预警|返修/

export function isResolvedStatus(status: string): boolean {
  return RESOLVED_EXTRA.has(status) || RESOLVED_STATUS.test(status)
}

export function isRemediedStatus(status: string): boolean {
  return REMEDIED_STATUS.test(status)
}

export function derivePending(status: string): boolean {
  return !isResolvedStatus(status)
}

export function deriveAbnormal(status: string): boolean {
  return ABNORMAL_STATUS.test(status)
}

// 内存级规范化：同一条记录读多少次结果都一样，且绝不回写存储。
// 显式的 pending/abnormal 视为历史结论，原样保留；只给空值/旧数据补默认值。
export function normalizeRow(row: Partial<EntryRow>, fallbackStatus: string): EntryRow {
  const status =
    typeof row.status === 'string' && row.status.trim() !== '' ? row.status : fallbackStatus
  return {
    ...(row as EntryRow),
    status,
    pending:
      typeof row.pending === 'boolean' ? row.pending : derivePending(status),
    abnormal:
      typeof row.abnormal === 'boolean' ? row.abnormal : deriveAbnormal(status),
  }
}

export function normalizeRows(rows: unknown, fallbackStatus = ''): EntryRow[] {
  if (!Array.isArray(rows)) {
    return []
  }
  return rows.map((row) => normalizeRow((row ?? {}) as Partial<EntryRow>, fallbackStatus))
}
