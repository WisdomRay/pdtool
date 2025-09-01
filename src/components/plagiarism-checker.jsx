"use client"

import { useState } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUploader } from "./file-uploader"
import { HighlightedText } from "./highlighted-text"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Check if the environment variable is defined
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

console.log("API_URL:", API_URL); // Debug log

export function PlagiarismChecker() {
  const [file, setFile] = useState(null)
  const [fileContent, setFileContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("upload")

  const handleFileSelected = (selectedFile, content) => {
    setFile(selectedFile)
    setFileContent(content)
    setActiveTab("review")
    setError(null)
    setResult(null)
  }

  const handleCheck = async () => {
    if (!file) {
      setError("Please upload a file first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use the properly constructed API URL
      const apiUrl = `${API_URL}/check_plagiarism`;
      console.log("Making request to:", apiUrl); // Debug log

      const response = await axios.post(apiUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
        timeout: 10000
      });

      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResult(response.data);
        setActiveTab("results");
      }
    } catch (err) {
      let errorMessage = "Failed to check plagiarism";
      
      if (err.response) {
        // Backend returned an error
        errorMessage = err.response.data.error || errorMessage;
        if (err.response.data.details) {
          errorMessage += `: ${err.response.data.details}`;
        }
      } else if (err.code === "ECONNABORTED") {
        errorMessage = "Request timed out. Please try again.";
      } else if (err.message === "Network Error") {
        errorMessage = "Cannot connect to server. Please check your connection.";
      } else if (err.request) {
        errorMessage = "No response from server. Please check if the server is running.";
      }

      setError(errorMessage);
      console.error("Plagiarism check error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (score) => {
    if (score < 0.3) return "bg-green-500"
    if (score < 0.5) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <Card className="max-w-6xl mx-auto mt-[150px] border-white border-2 text-white">
      <CardHeader>
        <CardTitle className="text-center">Document Plagiarism Checker</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="review" disabled={!file}>
              Review
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!result}>
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <FileUploader onFileSelected={handleFileSelected} />
          </TabsContent>

          <TabsContent value="review">
            {file && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Document Preview</h3>
                  <span className="text-sm text-gray-500">{file.name}</span>
                </div>

                <div className="p-4 border rounded-md  max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm">
                    {fileContent.slice(0, 2000)}
                    {fileContent.length > 2000 ? "..." : ""}
                  </pre>
                </div>

                <Button onClick={handleCheck} disabled={loading} className="w-full bg-[#007AFF] hover:bg-[#0066FF] border-[#007AFF]">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Document...
                    </>
                  ) : (
                    "Check for Plagiarism"
                  )}
                </Button>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results">
            {result && (
              <div className="space-y-6">
                {/* Similarity Score Display (unchanged) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Similarity Score</h3>
                    <span className={`px-2 py-1 rounded-full text-white text-sm font-medium ${
                      result.plagiarized ? "bg-red-500" : "bg-green-500"
                    }`}>
                      {result.plagiarized ? "Plagiarized" : "Original"}
                    </span>
                  </div>
                  <Progress
                    value={result.similarity_score * 100}
                    className={getSeverityColor(result.similarity_score)}
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>0%</span>
                    <span>{Math.round(result.similarity_score * 100)}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Enhanced Plagiarism Display */}
                {result.plagiarized ? (
                  <div className="space-y-6">
                    {/* Document Content with Highlighting */}
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Document Content Analysis</h3>
                      <div className="p-4 border rounded-lg ">
                        <HighlightedText 
                          text={fileContent} 
                          segments={result.matching_segments?.map(m => ({
                            ...m,
                            start_idx: m.start_idx || 0,
                            end_idx: m.end_idx || m.text.length
                          })) || []} 
                        />
                      </div>
                      <p className="text-[16px] text-white font-bold">
                        Highlighted sections indicate content matching other documents
                      </p>
                    </div>

                    {/* Detailed Matches Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Detailed Matches</h3>
                      {result.matching_segments?.map((match, index) => (
                        <Card key={index} className="border shadow-sm">
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium">
                                  Match #{index + 1} - {match.source_doc_name || "Unknown Source"}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  Similarity: {Math.round(match.similarity * 100)}% • 
                                  Length: {match.text.length} characters
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                match.similarity > 0.7 ? "bg-red-100 text-red-800" :
                                match.similarity > 0.4 ? "bg-orange-100 text-orange-800" :
                                "bg-yellow-100 text-yellow-800"
                              }`}>
                                {match.similarity > 0.7 ? "High Match" :
                                match.similarity > 0.4 ? "Medium Match" : "Low Match"}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="grid gap-4 md:grid-cols-2">
                            {/* Original Document Text */}
                            <div>
                              <h5 className="text-sm font-medium mb-2">Your Document</h5>
                              <div className="p-3 rounded text-sm">
                                {match.text}
                              </div>
                            </div>
                            {/* Source Document Text */}
                            <div>
                              <h5 className="text-sm font-medium mb-2">
                                Matching Content from {match.source_doc_name || "Source Document"}
                              </h5>
                              <div className="p-3 rounded text-sm">
                                {match.source_text || match.text}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Original "no plagiarism" display
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>
                      {result.status === "only one document"
                        ? "First document in system"
                        : "No plagiarism detected"}
                    </AlertTitle>
                    <AlertDescription>
                      {result.status === "only one document"
                        ? "This is the first document in the system. Future uploads will be compared against it."
                        : "Your document appears to be original content."}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={() => {
                    setFile(null)
                    setFileContent("")
                    setResult(null)
                    setActiveTab("upload")
                  }}
                  variant="outline"
                  className="w-full bg-[#007AFF] hover:bg-[#0066FF] border-[#007AFF]"
                >
                  Check Another Document
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}