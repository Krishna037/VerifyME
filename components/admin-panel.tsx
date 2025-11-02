"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trash2, RefreshCw, Database, AlertTriangle } from "lucide-react"

export default function AdminPanel() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "">("")

  const clearDatabase = async () => {
    if (!confirm("Are you sure you want to clear all user data? This action cannot be undone.")) {
      return
    }

    setLoading(true)
    setMessage("")

    try {
      const response = await fetch('/admin/clear-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()
      
      if (data.status === "success") {
        setMessage("Database cleared successfully! All user data has been removed.")
        setMessageType("success")
      } else {
        setMessage(data.message || "Failed to clear database")
        setMessageType("error")
      }
    } catch (error) {
      setMessage("Network error: Could not connect to server")
      setMessageType("error")
    } finally {
      setLoading(false)
    }
  }

  const refreshPage = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-700 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">Admin Panel</CardTitle>
          <CardDescription className="text-slate-400">
            Manage database and user data
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {message && (
            <Alert className={messageType === "success" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-white">
                {message}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <Button
              onClick={clearDatabase}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Clear All User Data
            </Button>

            <Button
              onClick={refreshPage}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
          </div>

          <div className="text-center">
            <Button
              onClick={() => window.location.href = '/'}
              variant="ghost"
              className="text-slate-400 hover:text-white"
            >
              ← Back to Main App
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}