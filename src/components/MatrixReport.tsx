import { useEffect, useMemo, useState } from 'react'

interface MatrixReportProps {
  data: any[]
  drilldownTarget?: MatrixDrilldownTarget | null
  onClearDrilldown?: () => void
}

type MatrixDrilldownTarget =
  | 'open-claims'
  | 'open-without-pay'
  | 'closed-without-pay'
  | 'without-pay-all'
  | 'open-with-pay-paid'
  | 'open-with-pay-reserve'

interface MatrixRow {
  adjuster: string
  openTotalCount: number
  openWithoutPayCount: number
  closedWithoutPayCount: number
  openWithPayCount: number
  closedWithPayCount: number
  openWithPayPaidItd: number
  closedWithPayPaidItd: number
  openWithPayReserveOutstanding: number
  openReserveOutstanding: number
  closedReserveOutstanding: number
  openAgeSum: number
  openAgeCount: number
}

const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase()

const isOpenStatus = (value: unknown): boolean => {
  const normalized = normalizeText(value)
  return /\bopen\b/.test(normalized) || /\breopen\b/.test(normalized) || /\breopened\b/.test(normalized)
}

const isClosedStatus = (value: unknown): boolean => {
  const normalized = normalizeText(value)
  return /\bclosed\b/.test(normalized)
}

const getStatusBucket = (value: unknown): 'open' | 'closed' | 'other' => {
  if (isClosedStatus(value)) {
    return 'closed'
  }
  if (isOpenStatus(value)) {
    return 'open'
  }
  return 'other'
}

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2]) - 1
    const day = Number(isoMatch[3])
    return new Date(year, month, day)
  }

  const parsedTime = Date.parse(trimmed)
  if (Number.isNaN(parsedTime)) {
    return null
  }

  return new Date(parsedTime)
}

const getAgeInDaysFromReportDate = (value: unknown): number | null => {
  const parsedDate = parseDateValue(value)
  if (!parsedDate) {
    return null
  }

  const today = new Date()
  const reportUtc = Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate())
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = todayUtc - reportUtc

  if (diffMs < 0) {
    return 0
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

const findDefaultColumn = (columns: string[], options: string[]): string => {
  for (const option of options) {
    const exact = columns.find((col) => normalizeText(col) === option)
    if (exact) {
      return exact
    }
  }

  for (const option of options) {
    const partial = columns.find((col) => normalizeText(col).includes(option))
    if (partial) {
      return partial
    }
  }

  return ''
}

export default function MatrixReport({ data, drilldownTarget, onClearDrilldown }: MatrixReportProps) {
  const columns = useMemo(() => (data.length > 0 ? Object.keys(data[0]) : []), [data])

  const adjusterColumnCandidates = useMemo(
    () => ['adjuster', 'examiner code', 'claim component adjuster code', 'component adjuster'],
    []
  )

  const [adjusterColumn, setAdjusterColumn] = useState<string>(() =>
    findDefaultColumn(columns, adjusterColumnCandidates)
  )
  const statusColumn = useMemo(
    () => findDefaultColumn(columns, ['claim status', 'status']),
    [columns]
  )
  const claimIdColumn = useMemo(
    () => findDefaultColumn(columns, ['claim number', 'claim id', 'claim']),
    [columns]
  )
  const paidAmountColumn = useMemo(
    () => findDefaultColumn(columns, ['direct loss paid itd', 'direct loss paid', 'paid']),
    [columns]
  )
  const reserveOutstandingColumn = useMemo(
    () => findDefaultColumn(columns, ['direct loss reserve outstanding', 'reserve outstanding']),
    [columns]
  )
  const claimReportedDateColumn = useMemo(
    () => findDefaultColumn(columns, ['claim reported date', 'reported date', 'report date']),
    [columns]
  )
  const claimAgeDaysColumn = useMemo(
    () => findDefaultColumn(columns, ['claim age (days)', 'claim age days']),
    [columns]
  )

  useEffect(() => {
    if (!columns.includes(adjusterColumn)) {
      setAdjusterColumn(findDefaultColumn(columns, adjusterColumnCandidates))
    }
  }, [columns, adjusterColumn, adjusterColumnCandidates])

  const matrixRows = useMemo<MatrixRow[]>(() => {
    if (!adjusterColumn || !statusColumn) {
      return []
    }

    const grouped = new Map<string, MatrixRow>()
    const seenByAdjusterOpenWithoutPay = new Map<string, Set<string>>()
    const seenByAdjusterClosedWithoutPay = new Map<string, Set<string>>()
    const seenByAdjusterOpenWithPay = new Map<string, Set<string>>()
    const seenByAdjusterClosedWithPay = new Map<string, Set<string>>()
    const seenByAdjusterOpenReserve = new Map<string, Set<string>>()
    const seenByAdjusterClosedReserve = new Map<string, Set<string>>()
    const seenByAdjusterOpenAge = new Map<string, Set<string>>()

    data.forEach((row) => {
      const adjuster = String(row[adjusterColumn] ?? '-').trim() || '-'
      const status = row[statusColumn]
      const claimId = claimIdColumn
        ? String(row[claimIdColumn] ?? '').trim()
        : ''
      const rowKey = claimId || JSON.stringify(row)

      if (!grouped.has(adjuster)) {
        grouped.set(adjuster, {
          adjuster,
          openTotalCount: 0,
          openWithoutPayCount: 0,
          closedWithoutPayCount: 0,
          openWithPayCount: 0,
          closedWithPayCount: 0,
          openWithPayPaidItd: 0,
          closedWithPayPaidItd: 0,
          openWithPayReserveOutstanding: 0,
          openReserveOutstanding: 0,
          closedReserveOutstanding: 0,
          openAgeSum: 0,
          openAgeCount: 0,
        })
        seenByAdjusterOpenWithoutPay.set(adjuster, new Set<string>())
        seenByAdjusterClosedWithoutPay.set(adjuster, new Set<string>())
        seenByAdjusterOpenWithPay.set(adjuster, new Set<string>())
        seenByAdjusterClosedWithPay.set(adjuster, new Set<string>())
        seenByAdjusterOpenReserve.set(adjuster, new Set<string>())
        seenByAdjusterClosedReserve.set(adjuster, new Set<string>())
        seenByAdjusterOpenAge.set(adjuster, new Set<string>())
      }

      const existing = grouped.get(adjuster)
      const openWithoutPaySeen = seenByAdjusterOpenWithoutPay.get(adjuster)
      const closedWithoutPaySeen = seenByAdjusterClosedWithoutPay.get(adjuster)
      const openWithPaySeen = seenByAdjusterOpenWithPay.get(adjuster)
      const closedWithPaySeen = seenByAdjusterClosedWithPay.get(adjuster)
      const openReserveSeen = seenByAdjusterOpenReserve.get(adjuster)
      const closedReserveSeen = seenByAdjusterClosedReserve.get(adjuster)
      const openAgeSeen = seenByAdjusterOpenAge.get(adjuster)
      if (!existing) {
        return
      }
      if (
        !openWithoutPaySeen ||
        !closedWithoutPaySeen ||
        !openWithPaySeen ||
        !closedWithPaySeen ||
        !openReserveSeen ||
        !closedReserveSeen ||
        !openAgeSeen
      ) {
        return
      }

      const statusBucket = getStatusBucket(status)
      const paidAmount = paidAmountColumn ? parseNumber(row[paidAmountColumn]) : 0
      const reserveAmount = reserveOutstandingColumn ? parseNumber(row[reserveOutstandingColumn]) : 0
      const fallbackAgeDays = claimAgeDaysColumn ? parseNumber(row[claimAgeDaysColumn]) : 0
      const ageDaysFromReportDate = claimReportedDateColumn
        ? getAgeInDaysFromReportDate(row[claimReportedDateColumn])
        : null
      const openAgeDays = ageDaysFromReportDate ?? (fallbackAgeDays > 0 ? fallbackAgeDays : null)

      if (statusBucket === 'open' && paidAmount <= 0 && !openWithoutPaySeen.has(rowKey)) {
        openWithoutPaySeen.add(rowKey)
        existing.openWithoutPayCount += 1
        existing.openTotalCount += 1
      }

      if (statusBucket === 'closed' && paidAmount <= 0 && !closedWithoutPaySeen.has(rowKey)) {
        closedWithoutPaySeen.add(rowKey)
        existing.closedWithoutPayCount += 1
      }

      if (statusBucket === 'closed' && paidAmount > 0 && !closedWithPaySeen.has(rowKey)) {
        closedWithPaySeen.add(rowKey)
        existing.closedWithPayCount += 1
        existing.closedWithPayPaidItd += paidAmount
      }

      if (statusBucket === 'open' && paidAmount > 0 && !openWithPaySeen.has(rowKey)) {
        openWithPaySeen.add(rowKey)
        existing.openWithPayCount += 1
        existing.openTotalCount += 1
        existing.openWithPayPaidItd += paidAmount
        existing.openWithPayReserveOutstanding += reserveOutstandingColumn
          ? parseNumber(row[reserveOutstandingColumn])
          : 0
      }

      if (statusBucket === 'open' && !openReserveSeen.has(rowKey)) {
        openReserveSeen.add(rowKey)
        existing.openReserveOutstanding += reserveAmount
      }

      if (statusBucket === 'open' && openAgeDays !== null && !openAgeSeen.has(rowKey)) {
        openAgeSeen.add(rowKey)
        existing.openAgeSum += openAgeDays
        existing.openAgeCount += 1
      }

      if (statusBucket === 'closed' && !closedReserveSeen.has(rowKey)) {
        closedReserveSeen.add(rowKey)
        existing.closedReserveOutstanding += reserveAmount
      }
    })

    return Array.from(grouped.values()).sort((a, b) => {
      const countDiff = b.openTotalCount - a.openTotalCount
      if (countDiff !== 0) {
        return countDiff
      }
      return a.adjuster.localeCompare(b.adjuster)
    })
  }, [
    data,
    adjusterColumn,
    statusColumn,
    claimIdColumn,
    paidAmountColumn,
    reserveOutstandingColumn,
    claimReportedDateColumn,
    claimAgeDaysColumn,
  ])

  const drilledRows = useMemo(() => {
    if (!drilldownTarget) {
      return matrixRows
    }

    if (drilldownTarget === 'open-claims') {
      return matrixRows.filter((row) => row.openWithoutPayCount + row.openWithPayCount > 0)
    }

    if (drilldownTarget === 'open-without-pay') {
      return matrixRows.filter((row) => row.openWithoutPayCount > 0)
    }

    if (drilldownTarget === 'closed-without-pay') {
      return matrixRows.filter((row) => row.closedWithoutPayCount > 0)
    }

    if (drilldownTarget === 'without-pay-all') {
      return matrixRows.filter((row) => row.openWithoutPayCount + row.closedWithoutPayCount > 0)
    }

    if (drilldownTarget === 'open-with-pay-paid' || drilldownTarget === 'open-with-pay-reserve') {
      return matrixRows.filter((row) => row.openWithPayCount > 0)
    }

    return matrixRows
  }, [matrixRows, drilldownTarget])

  const matrixTotals = useMemo(() =>
    drilledRows.reduce(
      (totals, row) => ({
        openTotalCount: totals.openTotalCount + row.openTotalCount,
        openWithoutPayCount: totals.openWithoutPayCount + row.openWithoutPayCount,
        closedWithoutPayCount: totals.closedWithoutPayCount + row.closedWithoutPayCount,
        openWithPayCount: totals.openWithPayCount + row.openWithPayCount,
        closedWithPayCount: totals.closedWithPayCount + row.closedWithPayCount,
        openWithPayPaidItd: totals.openWithPayPaidItd + row.openWithPayPaidItd,
        closedWithPayPaidItd: totals.closedWithPayPaidItd + row.closedWithPayPaidItd,
        openWithPayReserveOutstanding:
          totals.openWithPayReserveOutstanding + row.openWithPayReserveOutstanding,
        openReserveOutstanding: totals.openReserveOutstanding + row.openReserveOutstanding,
        closedReserveOutstanding: totals.closedReserveOutstanding + row.closedReserveOutstanding,
        openAgeSum: totals.openAgeSum + row.openAgeSum,
        openAgeCount: totals.openAgeCount + row.openAgeCount,
      }),
      {
        openTotalCount: 0,
        openWithoutPayCount: 0,
        closedWithoutPayCount: 0,
        openWithPayCount: 0,
        closedWithPayCount: 0,
        openWithPayPaidItd: 0,
        closedWithPayPaidItd: 0,
        openWithPayReserveOutstanding: 0,
        openReserveOutstanding: 0,
        closedReserveOutstanding: 0,
        openAgeSum: 0,
        openAgeCount: 0,
      }
    ),
  [drilledRows])

  const drilldownLabel = useMemo(() => {
    if (!drilldownTarget) {
      return ''
    }

    const labels: Record<MatrixDrilldownTarget, string> = {
      'open-claims': 'Open claim count',
      'open-without-pay': 'Open claims without pay',
      'closed-without-pay': 'Closed claims without pay',
      'without-pay-all': 'Total claims without pay',
      'open-with-pay-paid': 'Open paid ITD',
      'open-with-pay-reserve': 'Open direct loss reserve outstanding',
    }

    return labels[drilldownTarget]
  }, [drilldownTarget])

  if (!data || data.length === 0) {
    return <div className="table-container">No data to display</div>
  }

  return (
    <div className="table-container matrix-container">
      <h2>Matrix Report</h2>

      {drilldownTarget && (
        <div className="table-note matrix-drilldown-banner">
          <span>
            Drill-down active: <strong>{drilldownLabel}</strong> ({drilledRows.length} adjusters)
          </span>
          <button type="button" className="left-sidebar-toggle" onClick={onClearDrilldown}>
            Reset
          </button>
        </div>
      )}

      <div className="matrix-controls">
        <div className="pivot-control-group">
          <label htmlFor="matrix-adjuster-column">Row Field (Adjuster)</label>
          <select
            id="matrix-adjuster-column"
            value={adjusterColumn}
            onChange={(e) => setAdjusterColumn(e.target.value)}
            className="pivot-select"
          >
            <option value="">Select a column...</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!adjusterColumn || !statusColumn ? (
        <p className="table-note">Select both fields to generate the matrix report.</p>
      ) : (
        <div className="table-wrapper">
          <table className="pivot-table matrix-table">
            <thead>
              <tr>
                <th rowSpan={2}>Adjuster</th>
                <th className="matrix-group-open" colSpan={6}>Open</th>
                <th className="matrix-group-closed" colSpan={3}>Closed</th>
              </tr>
              <tr>
                <th className="matrix-col-open-total-count">Total Count</th>
                <th className="matrix-col-open-count">Count Paid</th>
                <th className="matrix-col-open-count-without-pay">Count Without Pay</th>
                <th className="matrix-col-open-paid">Paid</th>
                <th className="matrix-col-open-reserve">Reserves</th>
                <th className="matrix-col-open-average-age">Average Age</th>
                <th className="matrix-col-closed-count">Count Paid</th>
                <th className="matrix-col-closed-count-without-pay">Count Without Pay</th>
                <th className="matrix-col-closed-paid">Paid</th>
              </tr>
            </thead>
            <tbody>
              {drilledRows.map((row) => (
                <tr key={row.adjuster}>
                  <td>{row.adjuster}</td>
                  <td className={`number matrix-col-open-total-count ${drilldownTarget === 'open-claims' ? 'matrix-focus-cell' : ''}`}>{row.openTotalCount}</td>
                  <td className={`number matrix-col-open-count ${drilldownTarget === 'open-claims' || drilldownTarget === 'open-with-pay-paid' ? 'matrix-focus-cell' : ''}`}>{row.openWithPayCount}</td>
                  <td className={`number matrix-col-open-count-without-pay ${drilldownTarget === 'open-without-pay' || drilldownTarget === 'without-pay-all' ? 'matrix-focus-cell' : ''}`}>{row.openWithoutPayCount}</td>
                  <td className={`number matrix-col-open-paid ${drilldownTarget === 'open-with-pay-paid' ? 'matrix-focus-cell' : ''}`}>{formatCurrency(row.openWithPayPaidItd)}</td>
                  <td className={`number ${drilldownTarget === 'open-with-pay-reserve' ? 'matrix-focus-cell' : ''}`}>{formatCurrency(row.openReserveOutstanding)}</td>
                  <td className="number matrix-col-open-average-age">
                    {row.openAgeCount > 0 ? `${Math.round(row.openAgeSum / row.openAgeCount)} days` : 'N/A'}
                  </td>
                  <td className="number matrix-col-closed-count">{row.closedWithPayCount}</td>
                  <td className={`number matrix-col-closed-count-without-pay ${drilldownTarget === 'closed-without-pay' || drilldownTarget === 'without-pay-all' ? 'matrix-focus-cell' : ''}`}>{row.closedWithoutPayCount}</td>
                  <td className="number matrix-col-closed-paid">{formatCurrency(row.closedWithPayPaidItd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="matrix-total-row">
                <td>Total</td>
                <td className="number matrix-col-open-total-count">{matrixTotals.openTotalCount}</td>
                <td className="number matrix-col-open-count">{matrixTotals.openWithPayCount}</td>
                <td className="number matrix-col-open-count-without-pay">{matrixTotals.openWithoutPayCount}</td>
                <td className="number matrix-col-open-paid">{formatCurrency(matrixTotals.openWithPayPaidItd)}</td>
                <td className="number">{formatCurrency(matrixTotals.openReserveOutstanding)}</td>
                <td className="number matrix-col-open-average-age">
                  {matrixTotals.openAgeCount > 0
                    ? `${Math.round(matrixTotals.openAgeSum / matrixTotals.openAgeCount)} days`
                    : 'N/A'}
                </td>
                <td className="number matrix-col-closed-count">{matrixTotals.closedWithPayCount}</td>
                <td className="number matrix-col-closed-count-without-pay">{matrixTotals.closedWithoutPayCount}</td>
                <td className="number matrix-col-closed-paid">{formatCurrency(matrixTotals.closedWithPayPaidItd)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
