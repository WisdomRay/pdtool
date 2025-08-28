"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Upload } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function FileUploader({ onFileSelected }) {
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const processFile = async (file) => {
    setLoading(true)
    setError(null)

    try {
      // Validate file type
      const validTypes = [
        "text/plain",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]
      if (!validTypes.includes(file.type)) {
        throw new Error("Unsupported file type. Please upload a .txt, .pdf, or .docx file.")
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error("File size exceeds the 5MB limit.")
      }

      let content = ""

      // Extract text based on file type
      if (file.type === "text/plain") {
        content = await file.text()
      } else if (file.type === "application/pdf") {
        // For demo purposes, we'll just show a placeholder
        // In a real app, you'd use a PDF parsing library
        content = `[PDF Content Preview] - ${file.name}\n\nThis is a preview of the PDF content. In a production environment, the actual content would be extracted.`
      } else if (file.type.includes("wordprocessingml.document")) {
        // For demo purposes, we'll just show a placeholder
        // In a real app, you'd use a DOCX parsing library
        content = `[DOCX Content Preview] - ${file.name}\n\nThis is a preview of the DOCX content. In a production environment, the actual content would be extracted.`
      }

      onFileSelected(file, content)
    } catch (err) {
      console.error("Error processing file:", err)
      setError(err.message || "Failed to process file")
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = async (e) => {
    e.preventDefault()

    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0])
    }
  }

  const onButtonClick = () => {
    if (inputRef.current) {
      inputRef.current.click()
    }
  }

  return (
    <div className="space-y-4 relative">
      <div
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-gray-300"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".txt,.pdf,.docx"
          onChange={handleChange}
          disabled={loading}
        />

        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload className="w-10 h-10 mb-3 text-gray-400" />
          <p className="mb-2 text-sm text-gray-500">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">Supported formats: TXT, PDF, DOCX (Max 5MB)</p>

          {loading && <p className="mt-2 text-sm text-primary animate-pulse">Processing file...</p>}
        </div>
      </div>

      <Button onClick={onButtonClick} disabled={loading} className="w-full bg-[#007AFF] hover:bg-[#0066FF]">
        <FileText className="mr-2 h-4 w-4 " />
        Select Document
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
