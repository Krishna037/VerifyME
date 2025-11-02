"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Search, CheckCircle2 } from "lucide-react"

interface UserLookupProps {
  onComplete: (userId: string) => void
}

export default function UserLookup({ onComplete }: UserLookupProps) {
  const [userId, setUserId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [userFound, setUserFound] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!userId.trim()) {
      setError("Please enter a User ID")
      return
    }

    setLoading(true)

    try {
            const response = await fetch(`/user/${userId}/status`)
      
      if (!response.ok) {
        throw new Error("Failed to check user status")
      }

      const data = await response.json()
      
      if (!data.exists) {
        setError("User not found. Please check your User ID or register first.")
        setUserFound(false)
        return
      }

      if (!data.face_registered) {
        setError("Face not registered for this user. Please complete registration first.")
        setUserFound(false)
        return
      }

      setUserFound(true)
      setTimeout(() => {
        onComplete(userId)
      }, 1000)
      
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setUserFound(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-slate-900 border-slate-700 shadow-2xl">
      <CardHeader className="text-center pb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
          <Search className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Enter Your User ID</CardTitle>
        <CardDescription className="text-slate-400 text-lg">
          Enter your registered User ID to begin verification
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="userId" className="text-sm font-medium text-slate-300">
              User ID
            </Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your User ID"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 h-12 text-lg"
              disabled={loading}
            />
          </div>

          {error && (
            <Alert className="border-red-600 bg-red-950/20">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          {userFound && (
            <Alert className="border-green-600 bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-400">
                User found! Redirecting to verification...
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all"
            disabled={loading || userFound}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Checking...
              </>
            ) : userFound ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                User Found!
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Find User
              </>
            )}
          </Button>
        </form>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-medium text-white mb-2">Need Help?</h4>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• Make sure you've completed registration first</li>
            <li>• User ID is case-sensitive</li>
            <li>• Contact support if you've forgotten your User ID</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}