import DataTable from './DataTable'
import closabilityConfig from '../config/closability-config.json'

interface LiabilityStandalonePanelProps {
  data: any[]
}

type LiabilitySegment = 'collision' | 'pd' | 'other'

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase()
const normalizeForMatch = (value: unknown): string =>
  normalize(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

const RECOMMENDATION_COLUMN_CANDIDATES = closabilityConfig.recommendationColumnCandidates
const CLOSABILITY_KEYWORDS = closabilityConfig.keywordGroups

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

const findItdDirectPaidColumn = (columns: string[]): string | null => {
  const normalizedColumns = columns.map((column) => ({
    original: column,
    normalized: normalize(column),
  }))

  const exactPriority = [
    'itd direct pay',
    'itd direct paid',
    'direct paid itd',
    'direct pay itd',
    'direct loss paid itd',
  ]

  for (const exact of exactPriority) {
    const matched = normalizedColumns.find((column) => column.normalized === exact)
    if (matched) {
      return matched.original
    }
  }

  const itdDirectPaid = normalizedColumns.find(({ normalized }) =>
    normalized.includes('itd') &&
    normalized.includes('direct') &&
    (normalized.includes('paid') || normalized.includes('pay'))
  )

  return itdDirectPaid ? itdDirectPaid.original : null
}

const parseNumberStrict = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const negativeParenMatch = trimmed.match(/^\((.*)\)$/)
    const isNegativeParen = Boolean(negativeParenMatch)
    const normalizedNumber = (isNegativeParen ? negativeParenMatch?.[1] ?? '' : trimmed).replace(/[$,\s]/g, '')
    const parsedRaw = Number(normalizedNumber)
    const parsed = isNegativeParen ? -parsedRaw : parsedRaw
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const isOpenStatus = (value: unknown): boolean => {
  const normalizedValue = normalize(value)
  return /\bopen\b/.test(normalizedValue) || /\breopen\b/.test(normalizedValue) || /\breopened\b/.test(normalizedValue)
}

const classifySegment = (value: unknown): LiabilitySegment => {
  const normalizedValue = normalize(value)

  if (!normalizedValue) {
    return 'other'
  }

  if (
    /\bcollision\b/.test(normalizedValue) ||
    /\bcoll\b/.test(normalizedValue) ||
    normalizedValue === 'comp'
  ) {
    return 'collision'
  }

  if (
    /\bpd\b/.test(normalizedValue) ||
    normalizedValue === 'prop' ||
    /property\s*damage/.test(normalizedValue) ||
    /physical\s*damage/.test(normalizedValue)
  ) {
    return 'pd'
  }

  return 'other'
}

const getSegmentFromRow = (row: Record<string, unknown>, perilColumns: string[]): LiabilitySegment => {
  for (const perilColumn of perilColumns) {
    const segment = classifySegment(row[perilColumn])
    if (segment !== 'other') {
      return segment
    }
  }

  return 'other'
}

const formatInteger = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

export default function LiabilityStandalonePanel({ data }: LiabilityStandalonePanelProps) {
  const columns = data.length > 0 ? Object.keys(data[0]) : []
  const statusColumn = findColumn(columns, [
    'Liability Status',
    'Claim Status',
    'Status',
    'Claim Open/Closed',
    'Open Closed Status',
  ])
  const paidColumn = findItdDirectPaidColumn(columns)
  const recommendationColumn = findColumn(columns, RECOMMENDATION_COLUMN_CANDIDATES)
  const perilColumns = columns.filter((column) => normalize(column).includes('peril'))
  const visibleColumns = data.length > 0 ? Object.keys(data[0]) : []

  let collisionOpenNoPay = 0
  let pdOpenNoPay = 0
  const closabilityKeywordCounts = CLOSABILITY_KEYWORDS.map((keyword) => ({
    label: keyword.label,
    count: 0,
  }))
  let closabilityOtherCount = 0

  data.forEach((row) => {
    const typedRow = row as Record<string, unknown>
    const isOpen = isOpenStatus(statusColumn ? typedRow[statusColumn] : '')
    const paid = paidColumn ? parseNumberStrict(typedRow[paidColumn]) : null
    const segment = getSegmentFromRow(typedRow, perilColumns)
    const recommendationText = recommendationColumn ? normalizeForMatch(typedRow[recommendationColumn]) : ''

    if (isOpen && paid === 0 && segment === 'collision') {
      collisionOpenNoPay += 1
    }

    if (isOpen && paid === 0 && segment === 'pd') {
      pdOpenNoPay += 1
    }

    if (recommendationText) {
      const keywordMatchIndex = CLOSABILITY_KEYWORDS.findIndex((keyword) =>
        keyword.patterns.some((pattern) => recommendationText.includes(pattern))
      )

      if (keywordMatchIndex >= 0) {
        closabilityKeywordCounts[keywordMatchIndex].count += 1
      } else {
        closabilityOtherCount += 1
      }
    }
  })

  const sortedClosabilitySummary = [...closabilityKeywordCounts].sort((a, b) => b.count - a.count)

  return (
    <section className="table-container" style={{ marginTop: 20 }}>
      <h2>Standalone Liability Sheet</h2>

      <p className="table-note">
        Mapped Columns: Status={statusColumn || 'Not Found'} | ITD Direct Pay={paidColumn || 'Not Found'} | Peril={perilColumns.join(', ') || 'Not Found'} | Closability Recommendation={recommendationColumn || 'Not Found'}
      </p>

      <div className="kpi-grid kpi-grid-money" style={{ marginTop: 10 }}>
        <article className="kpi-card kpi-card-claim-count">
          <p className="kpi-label">COLL Open Without Pay</p>
          <p className="kpi-value">{formatInteger(collisionOpenNoPay)}</p>
        </article>
        <article className="kpi-card kpi-card-claim-count">
          <p className="kpi-label">PD Open Without Pay</p>
          <p className="kpi-value">{formatInteger(pdOpenNoPay)}</p>
        </article>
      </div>

      {recommendationColumn && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Closability Recommendation Summary</h3>
          <div className="kpi-grid kpi-grid-money" style={{ marginTop: 10 }}>
            {sortedClosabilitySummary.map((keyword, index) => (
              <article key={keyword.label} className="kpi-card kpi-card-claim-count">
                {index === 0 && keyword.count > 0 && (
                  <p className="table-note" style={{ marginTop: 0, marginBottom: 6, fontWeight: 700 }}>
                    Top recommendation
                  </p>
                )}
                <p className="kpi-label">{keyword.label}</p>
                <p className="kpi-value">{formatInteger(keyword.count)}</p>
              </article>
            ))}
            <article className="kpi-card kpi-card-claim-count">
              <p className="kpi-label">Other Recommendation Text</p>
              <p className="kpi-value">{formatInteger(closabilityOtherCount)}</p>
            </article>
          </div>
        </>
      )}

      {data.length > 0 && (
        <DataTable
          data={data}
          visibleColumns={visibleColumns}
        />
      )}
    </section>
  )
}
