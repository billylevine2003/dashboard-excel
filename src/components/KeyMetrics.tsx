import { KeyboardEvent, useMemo, useState } from 'react'

interface KeyMetricsProps {
  data: any[]
  onDrillDown?: (target: MatrixDrilldownTarget) => void
}

type MatrixDrilldownTarget =
  | 'open-claims'
  | 'open-without-pay'
  | 'closed-without-pay'
  | 'without-pay-all'
  | 'open-with-pay-paid'
  | 'open-with-pay-reserve'

const normalize = (value: string): string => value.trim().toLowerCase()

const findColumn = (columns: string[], candidates: string[]): string | null => {
  const normalizedCandidates = candidates.map((candidate) => normalize(candidate))

  for (const column of columns) {
    const normalizedColumn = normalize(column)
    if (normalizedCandidates.some((candidate) => normalizedColumn === candidate)) {
      return column
    }
  }

  for (const column of columns) {
    const normalizedColumn = normalize(column)
    if (normalizedCandidates.some((candidate) => normalizedColumn.includes(candidate))) {
      return column
    }
  }

  return null
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

const getStatusBucket = (value: unknown): 'open' | 'closed' | 'other' => {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (/\bclosed\b/.test(normalized)) {
    return 'closed'
  }

  if (
    /\bopen\b/.test(normalized) ||
    /\breopen\b/.test(normalized) ||
    /\breopened\b/.test(normalized) ||
    /\bre-open\b/.test(normalized) ||
    /\bre-opened\b/.test(normalized)
  ) {
    return 'open'
  }

  return 'other'
}

const formatInteger = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

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

export default function KeyMetrics({ data, onDrillDown }: KeyMetricsProps) {
  const [collapsed, setCollapsed] = useState(false)

  const getDrilldownProps = (target: MatrixDrilldownTarget) => {
    if (!onDrillDown) {
      return {}
    }

    return {
      role: 'button' as const,
      tabIndex: 0,
      onClick: () => onDrillDown(target),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onDrillDown(target)
        }
      },
    }
  }

  if (!data || data.length === 0) {
    return null
  }

  const columns = useMemo(() => (data.length > 0 ? Object.keys(data[0]) : []), [data])

  const defaultClaimNumberColumn = findColumn(columns, ['Claim Number']) ?? ''
  const defaultDirectLossPaidColumn = findColumn(columns, [
    'Direct Loss Paid ITD',
    'Direct Loss Paid',
  ]) ?? ''
  const defaultReserveOutstandingColumn = findColumn(columns, [
    'Direct Loss Reserve Outstanding',
    'Reserve Outstanding',
  ]) ?? ''
  const defaultStatusColumn = findColumn(columns, ['Claim Status', 'Status']) ?? ''
  const defaultClaimReportedDateColumn = findColumn(columns, ['Claim Reported Date', 'Reported Date', 'Report Date']) ?? ''
  const defaultClaimAgeDaysColumn = findColumn(columns, ['Claim Age (Days)', 'Claim Age Days']) ?? ''

  const claimNumberColumn = defaultClaimNumberColumn
  const directLossPaidColumn = defaultDirectLossPaidColumn
  const reserveOutstandingColumn = defaultReserveOutstandingColumn
  const statusColumn = defaultStatusColumn
  const claimReportedDateColumn = defaultClaimReportedDateColumn
  const claimAgeDaysColumn = defaultClaimAgeDaysColumn

  const statusSummary = (() => {
    const emptySummary = {
      count: 0,
      withoutPayCount: 0,
      paidItd: 0,
      reserveOutstanding: 0,
      averageAge: null as number | null,
    }

    const summary: Record<'open' | 'closed' | 'total', typeof emptySummary> = {
      open: { ...emptySummary },
      closed: { ...emptySummary },
      total: { ...emptySummary },
    }

    const openIds = new Set<string>()
    const closedIds = new Set<string>()
    const openWithoutPayIds = new Set<string>()
    const closedWithoutPayIds = new Set<string>()
    const openAgeIds = new Set<string>()
    let openRowCount = 0
    let closedRowCount = 0
    let openWithoutPayRowCount = 0
    let closedWithoutPayRowCount = 0
    let openAgeSum = 0
    let openAgeCount = 0

    data.forEach((row) => {
      const bucket = statusColumn ? getStatusBucket(row[statusColumn]) : 'other'
      const claimId = claimNumberColumn ? String(row[claimNumberColumn] ?? '').trim() : ''
      const hasClaimId = Boolean(claimId)
      const paidAmount = directLossPaidColumn ? parseNumber(row[directLossPaidColumn]) : 0
      const reserveAmount = reserveOutstandingColumn ? parseNumber(row[reserveOutstandingColumn]) : 0
      const isWithoutPay = paidAmount <= 0
      const fallbackAgeDays = claimAgeDaysColumn ? parseNumber(row[claimAgeDaysColumn]) : 0
      const ageDaysFromReportDate = claimReportedDateColumn
        ? getAgeInDaysFromReportDate(row[claimReportedDateColumn])
        : null
      const openAgeDays = ageDaysFromReportDate ?? (fallbackAgeDays > 0 ? fallbackAgeDays : null)

      if (bucket === 'open') {
        summary.open.paidItd += paidAmount
        summary.open.reserveOutstanding += reserveAmount
        if (hasClaimId) {
          openIds.add(claimId)
          if (openAgeDays !== null && !openAgeIds.has(claimId)) {
            openAgeIds.add(claimId)
            openAgeSum += openAgeDays
            openAgeCount += 1
          }
          if (isWithoutPay) {
            openWithoutPayIds.add(claimId)
          }
        } else {
          openRowCount += 1
          if (openAgeDays !== null) {
            openAgeSum += openAgeDays
            openAgeCount += 1
          }
          if (isWithoutPay) {
            openWithoutPayRowCount += 1
          }
        }
      }

      if (bucket === 'closed') {
        summary.closed.paidItd += paidAmount
        summary.closed.reserveOutstanding += reserveAmount
        if (hasClaimId) {
          closedIds.add(claimId)
          if (isWithoutPay) {
            closedWithoutPayIds.add(claimId)
          }
        } else {
          closedRowCount += 1
          if (isWithoutPay) {
            closedWithoutPayRowCount += 1
          }
        }
      }
    })

    summary.open.count = claimNumberColumn ? openIds.size : openRowCount
    summary.open.withoutPayCount = claimNumberColumn ? openWithoutPayIds.size : openWithoutPayRowCount
    summary.open.averageAge = openAgeCount > 0 ? openAgeSum / openAgeCount : null
    summary.closed.count = claimNumberColumn ? closedIds.size : closedRowCount
    summary.closed.withoutPayCount = claimNumberColumn ? closedWithoutPayIds.size : closedWithoutPayRowCount

    summary.total.count = summary.open.count + summary.closed.count
    summary.total.withoutPayCount = summary.open.withoutPayCount + summary.closed.withoutPayCount
    summary.total.paidItd = summary.open.paidItd + summary.closed.paidItd
    summary.total.reserveOutstanding =
      summary.open.reserveOutstanding + summary.closed.reserveOutstanding

    return summary
  })()

  return (
    <section className="kpi-section">
      <div className="kpi-header">
        <h2>Key Metrics</h2>
        <button
          type="button"
          className="kpi-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          <p className="kpi-description">
            High-level claim performance snapshot across open, closed, and total outcomes.
          </p>

          <h3 className="kpi-row-title">Open</h3>
          <div className="kpi-grid kpi-grid-money">
            <article className="kpi-card kpi-card-claim-count kpi-card-clickable" {...getDrilldownProps('open-claims')}>
              <p className="kpi-label">Count</p>
              <p className="kpi-value">{formatInteger(statusSummary.open.count)}</p>
            </article>

            <article className="kpi-card kpi-card-total-paid kpi-card-clickable" {...getDrilldownProps('open-with-pay-paid')}>
              <p className="kpi-label">Paid ITD</p>
              <p className="kpi-value">{formatCurrency(statusSummary.open.paidItd)}</p>
            </article>

            <article className="kpi-card kpi-card-total-reserve kpi-card-clickable" {...getDrilldownProps('open-with-pay-reserve')}>
              <p className="kpi-label">Direct Loss Reserve Outstanding</p>
              <p className="kpi-value">{formatCurrency(statusSummary.open.reserveOutstanding)}</p>
            </article>

            <article className="kpi-card kpi-card-open-without-pay kpi-card-clickable" {...getDrilldownProps('open-without-pay')}>
              <p className="kpi-label">Claims Without Pay</p>
              <p className="kpi-value">{formatInteger(statusSummary.open.withoutPayCount)}</p>
            </article>

            <article className="kpi-card kpi-card-open-with-pay-count">
              <p className="kpi-label">Average Age</p>
              <p className="kpi-value">
                {statusSummary.open.averageAge === null
                  ? 'N/A'
                  : `${formatInteger(Math.round(statusSummary.open.averageAge))} days`}
              </p>
            </article>
          </div>

          <h3 className="kpi-row-title">Closed</h3>
          <div className="kpi-grid kpi-grid-money">
            <article className="kpi-card kpi-card-claim-count">
              <p className="kpi-label">Count</p>
              <p className="kpi-value">{formatInteger(statusSummary.closed.count)}</p>
            </article>

            <article className="kpi-card kpi-card-total-paid">
              <p className="kpi-label">Paid ITD</p>
              <p className="kpi-value">{formatCurrency(statusSummary.closed.paidItd)}</p>
            </article>

            <article className="kpi-card kpi-card-total-reserve">
              <p className="kpi-label">Direct Loss Reserve Outstanding</p>
              <p className="kpi-value">{formatCurrency(statusSummary.closed.reserveOutstanding)}</p>
            </article>

            <article className="kpi-card kpi-card-closed-without-pay kpi-card-clickable" {...getDrilldownProps('closed-without-pay')}>
              <p className="kpi-label">Claims Without Pay</p>
              <p className="kpi-value">{formatInteger(statusSummary.closed.withoutPayCount)}</p>
            </article>

            <article className="kpi-card kpi-card-closed-without-pay">
              <p className="kpi-label">Average Age</p>
              <p className="kpi-value">N/A</p>
            </article>
          </div>

          <h3 className="kpi-row-title">Total</h3>
          <div className="kpi-grid kpi-grid-counts">
            <article className="kpi-card kpi-card-claim-count">
              <p className="kpi-label">Count</p>
              <p className="kpi-value">{formatInteger(statusSummary.total.count)}</p>
            </article>

            <article className="kpi-card kpi-card-total-paid">
              <p className="kpi-label">Paid ITD</p>
              <p className="kpi-value">{formatCurrency(statusSummary.total.paidItd)}</p>
            </article>

            <article className="kpi-card kpi-card-total-reserve">
              <p className="kpi-label">Direct Loss Reserve Outstanding</p>
              <p className="kpi-value">{formatCurrency(statusSummary.total.reserveOutstanding)}</p>
            </article>

            <article className="kpi-card kpi-card-open-without-pay kpi-card-clickable" {...getDrilldownProps('without-pay-all')}>
              <p className="kpi-label">Claims Without Pay</p>
              <p className="kpi-value">{formatInteger(statusSummary.total.withoutPayCount)}</p>
            </article>

            <article className="kpi-card kpi-card-closed-without-pay">
              <p className="kpi-label">Average Age</p>
              <p className="kpi-value">N/A</p>
            </article>
          </div>
        </>
      )}
    </section>
  )
}
