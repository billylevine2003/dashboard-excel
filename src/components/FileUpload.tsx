interface FileUploadProps {
  onFileUpload: (file: File) => void
  onLiabilityFileUpload: (file: File) => void
  fileName?: string
  liabilityFileName?: string
}

export default function FileUpload({
  onFileUpload,
  onLiabilityFileUpload,
  fileName,
  liabilityFileName,
}: FileUploadProps) {
  const handleMainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileUpload(file)
    }
  }

  const handleLiabilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onLiabilityFileUpload(file)
    }
  }

  return (
    <div className="upload-section">
      <h2>Upload Panel</h2>

      <div className="upload-sections">
        <section className="upload-subsection">
          <h3>Main Claims File</h3>
          <p className="upload-subsection-description">
            Used for filters, key metrics, and visualizations.
          </p>
          <label htmlFor="file-upload" className="upload-label">
            📁 Upload Excel File
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleMainChange}
            className="file-input"
          />
          <p className="table-note upload-file-note">
            {fileName ? `Loaded: ${fileName}` : 'No file selected'}
          </p>
        </section>

        <section className="upload-subsection">
          <h3>Liability File</h3>
          <p className="upload-subsection-description">
            Used for liability closability and open-without-pay summaries.
          </p>
          <label htmlFor="liability-upload" className="upload-label">
            ⚖️ Upload Liability Sheet
          </label>
          <input
            id="liability-upload"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleLiabilityChange}
            className="file-input"
          />
          <p className="table-note upload-file-note">
            {liabilityFileName ? `Loaded: ${liabilityFileName}` : 'No file selected'}
          </p>
        </section>
      </div>
    </div>
  )
}
