import DataTable from './DataTable'

interface LiabilityStandalonePanelProps {
  data: any[]
  fileName?: string
  onUpload: (file: File) => void
}

type LiabilitySegment = 'collision' | 'pd' | 'other'

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase()

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

export default function LiabilityStandalonePanel({ data, fileName, onUpload }: LiabilityStandalonePanelProps) {
  const columns = data.length > 0 ? Object.keys(data[0]) : []
  const statusColumn = findColumn(columns, [
    'Liability Status',
    'Claim Status',
    'Status',
    'Claim Open/Closed',
    'Open Closed Status',
  ])
  const paidColumn = findItdDirectPaidColumn(columns)
  const perilColumns = columns.filter((column) => normalize(column).includes('peril'))
  const visibleColumns = data.length > 0 ? Object.keys(data[0]) : []

  let collisionOpenNoPay = 0
  let pdOpenNoPay = 0

  data.forEach((row) => {
    const typedRow = row as Record<string, unknown>
    const isOpen = isOpenStatus(statusColumn ? typedRow[statusColumn] : '')
    const paid = paidColumn ? parseNumberStrict(typedRow[paidColumn]) : null
    const segment = getSegmentFromRow(typedRow, perilColumns)

    if (isOpen && paid === 0 && segment === 'collision') {
      collisionOpenNoPay += 1
    }

    if (isOpen && paid === 0 && segment === 'pd') {
      pdOpenNoPay += 1
    }
  })

  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onUpload(file)
    }
  }

  return (
    <section className="table-container" style={{ marginTop: 20 }}>
      <h2>Standalone Liability Sheet</h2>
      <label htmlFor="liability-standalone-upload" className="upload-label">
        ⚖️ Upload Liability Sheet
      </label>
      <input
        id="liability-standalone-upload"
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleUploadChange}
        className="file-input"
      />

      <p className="table-note" style={{ marginTop: 10 }}>
        {fileName ? `Loaded: ${fileName}` : 'No liability file selected'}
      </p>

      <p className="table-note">
        Mapped Columns: Status={statusColumn || 'Not Found'} | ITD Direct Pay={paidColumn || 'Not Found'} | Peril={perilColumns.join(', ') || 'Not Found'}
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

      {data.length > 0 && (
        <DataTable
          data={data}
          visibleColumns={visibleColumns}
        />
      )}
    </section>
  )
}
