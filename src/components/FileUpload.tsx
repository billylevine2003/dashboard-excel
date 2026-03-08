interface FileUploadProps {
  onFileUpload: (file: File) => void
}

export default function FileUpload({ onFileUpload }: FileUploadProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileUpload(file)
    }
  }

  return (
    <div className="upload-section">
      <label htmlFor="file-upload" className="upload-label">
        📁 Upload Excel File
      </label>
      <input
        id="file-upload"
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleChange}
        className="file-input"
      />
    </div>
  )
}
