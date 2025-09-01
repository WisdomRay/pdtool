"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { AdminUploader } from "./admin-uploader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

export function AdminDashboard() {
  const [documents, setDocuments] = useState([])
  const [editingDoc, setEditingDoc] = useState(null)
  const [editContent, setEditContent] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

const fetchDocuments = async () => {
  setLoading(true);
  try {
    const res = await axios.get("http://localhost:5000/documents", {
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    setDocuments(res.data);
  } catch (error) {
    console.error("Full error:", error);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Status code:", error.response.status);
    }
    toast({
      variant: "destructive",
      title: "Error",
      description: "Failed to load documents. Please check server connection.",
    });
  } finally {
    setLoading(false);
  }
};

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/documents/${id}`, { 
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      let errorMessage = "Failed to delete document";
      if (error.response) {
        errorMessage = error.response.data?.error || errorMessage;
      } else if (error.message === "Network Error") {
        errorMessage = "Network error - check server connection and CORS settings";
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };

  const handleEdit = async (id) => {
    setEditingDoc(id)
    const doc = documents.find((d) => d.id === id)
    setEditContent(doc?.file_content || "")
  }

  const saveEdit = async () => {
    try {
      await axios.put(
        `http://localhost:5000/documents/${editingDoc}`,
        { file_content: editContent },
        { withCredentials: true },
      )
      setEditingDoc(null)
      setEditContent("")
      toast({
        title: "Success",
        description: "Document updated successfully",
      })
      fetchDocuments()
    } catch (error) {
      console.error("Error updating document:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Failed to update document",
      })
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 text-white">
      <h1 className="text-2xl font-bold text-center mb-6">Admin Dashboard</h1>

      <AdminUploader onUploadSuccess={fetchDocuments} />

      <Card>
        <CardHeader>
          <CardTitle>Document Library</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && documents.length === 0 ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No documents found</p>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div 
                  key={doc.id} 
                  className="p-4 border rounded-lg flex justify-between items-center transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <p className="text-sm text-gray-500">Type: {doc.file_type}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEdit(doc.id)}
                      disabled={loading}
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDelete(doc.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingDoc && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Document #{editingDoc}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              value={editContent} 
              onChange={(e) => setEditContent(e.target.value)} 
              className="min-h-[200px]" 
            />
            <div className="flex space-x-2">
              <Button onClick={saveEdit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : "Save Changes"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setEditingDoc(null)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}