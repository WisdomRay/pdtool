"use client"

import { BrowserRouter as Router, Route, Routes, Navigate, Link } from "react-router-dom"
import { useState } from "react"
import { PlagiarismChecker } from "./components/plagiarism-checker"
import { AdminLogin } from "./components/admin-login"
import { AdminDashboard } from "./components/admin-dashboard"
import { Button } from "@/components/ui/button"
import { Shield, FileText, LogOut } from "lucide-react"
import axios from "axios"

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)

  const handleLogin = () => {
    setLoggedIn(true)
  }

  const handleLogout = async () => {
    try {
      await axios.post("http://localhost:5000/admin_logout", {}, { withCredentials: true })
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setLoggedIn(false)
    }
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-r from-[#0A192F] to-[#000814]">
        <header className=" bg-gradient-to-r from-[#0A192F] to-[#000814] shadow-sm text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <FileText className="h-6 w-6 text-primary" />
                <h1 className="ml-2 text-xl font-bold">Plagiarism Detection System</h1>
              </div>
              <nav className="flex space-x-4">
                <Link to="/">
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Checker
                  </Button>
                </Link>
                {loggedIn ? (
                  <>
                    <Link to="/admin-dashboard">
                      <Button variant="ghost" size="sm">
                        <Shield className="h-4 w-4 mr-2" />
                        Dashboard
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Link to="/admin">
                    <Button variant="ghost" size="sm">
                      <Shield className="h-4 w-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}
              </nav>
            </div>
          </div>
        </header>

        <main className="py-10">
          <Routes>
            <Route path="/" element={<PlagiarismChecker />} />
            <Route path="/admin" element={<AdminLogin onLogin={handleLogin} />} />
            <Route path="/admin-dashboard" element={loggedIn ? <AdminDashboard /> : <Navigate to="/admin" />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
