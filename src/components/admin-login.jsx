"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Debug environment variable at the top level
console.log("API URL:", import.meta.env.VITE_API_URL);
console.log("Login URL:", `${import.meta.env.VITE_API_URL}/admin_login`);

export function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Please enter both username and password")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/admin_login`,
        { username, password },
        { withCredentials: true }
      );

      if (res.data.message) {
        onLogin()
        navigate("/admin-dashboard")
      } else {
        setError("Login failed")
        setUsername("")
        setPassword("")
      }
    } catch (error) {
      console.error("Login error:", error.response?.data || error.message)
      setError("Invalid credentials")
      setPassword("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center mt-[200px] text-white">
      <Card className="w-full max-w-xl ">
        <CardHeader>
          <CardTitle className="text-center">Admin Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}