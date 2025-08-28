"use client"

import { useState } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload } from "lucide-react"

export function AdminUploader({ onUploadSuccess }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setMessage("")
  }

  const handleUpload = async () => {
    if (!file) {
      alert("Please choose a file to upload.")
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await axios.post("http://localhost:5000/upload_document", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      })

      setMessage(res.data.message || "Upload successful")
      setFile(null)

      if (onUploadSuccess) {
        onUploadSuccess() // Refresh document list after upload
      }
    } catch (err) {
      console.error(err)
      setMessage("Upload failed. Try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white">Upload New Document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-white">
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="admin-file-upload"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-2 text-gray-500" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF, DOCX, TXT (MAX. 5MB)</p>
            </div>
            <input
              id="admin-file-upload"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {file && (
          <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
            Selected: <span className="font-medium">{file.name}</span>
          </div>
        )}

        <Button onClick={handleUpload} disabled={uploading || !file} className="w-full">
          {uploading ? "Uploading..." : "Upload Document"}
        </Button>

        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
