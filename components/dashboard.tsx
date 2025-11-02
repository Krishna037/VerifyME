"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, LogOut, Shield, Zap, Copy } from "lucide-react"
import { useState } from "react"

interface DashboardProps {
  userId: string
  mode: "register" | "verify" | "select"
  onReset: () => void
}

export default function Dashboard({ userId, mode, onReset }: DashboardProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">VerifyMe</h1>
              <p className="text-xs text-slate-400">Verification Complete</p>
            </div>
          </div>
          <Button
            onClick={onReset}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent transition-all"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Success Card */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10" />
              <CardContent className="relative pt-12 pb-12">
                <div className="text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center animate-pulse shadow-lg">
                      <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {mode === "register" ? "Registration Complete!" : "Verification Successful!"}
                    </h2>
                    <p className="text-slate-400 text-lg">
                      Welcome, <span className="font-semibold text-white">{userId}</span>
                    </p>
                  </div>
                  <p className="text-slate-400 max-w-md mx-auto">
                    {mode === "register" 
                      ? "Your biometric profile has been successfully registered. You can now use your face and signature for secure authentication."
                      : "Your identity has been successfully verified using your registered biometric data."
                    }
                  </p>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mt-6">
                    <p className="text-xs text-slate-400 mb-2">Your User ID</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-sm font-mono text-cyan-400">{userId}</code>
                      <Button
                        onClick={copyToClipboard}
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    {copied && <p className="text-xs text-green-400 mt-2 animate-in fade-in">Copied to clipboard!</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 shadow-lg hover:border-slate-700 transition-all">
              <CardHeader>
                <CardTitle className="text-sm">Verification Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Profile</span>
                  <Badge className="bg-green-600 hover:bg-green-700 animate-in fade-in">✓ Complete</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Face</span>
                  <Badge className="bg-green-600 hover:bg-green-700 animate-in fade-in">✓ Complete</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Signature</span>
                  <Badge className="bg-green-600 hover:bg-green-700 animate-in fade-in">✓ Complete</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 shadow-lg hover:border-slate-700 transition-all">
              <CardHeader>
                <CardTitle className="text-sm">Security Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-semibold text-white">Maximum</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Multi-factor biometric authentication enabled</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all shadow-lg group">
            <CardHeader>
              <CardTitle className="text-base group-hover:text-cyan-400 transition-colors">Face Recognition</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-400">
              AI-powered facial verification with advanced liveness detection
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all shadow-lg group">
            <CardHeader>
              <CardTitle className="text-base group-hover:text-cyan-400 transition-colors">
                Signature Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-400">
              Deep learning-based signature matching with high accuracy
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all shadow-lg group">
            <CardHeader>
              <CardTitle className="text-base group-hover:text-cyan-400 transition-colors">Secure Storage</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-400">
              Encrypted biometric data with enterprise-grade security
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
