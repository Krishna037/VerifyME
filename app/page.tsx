"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import UserRegistration from "@/components/steps/user-registration"
import UserLookup from "@/components/steps/user-lookup"
import FaceVerification from "@/components/steps/face-verification"
import SignatureVerification from "@/components/steps/signature-verification"
import Dashboard from "@/components/dashboard"
import { CheckCircle2, Lock, Fingerprint, User, Shield, UserCheck } from "lucide-react"

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] = useState({
    profile: false,
    face: false,
    signature: false,
  })
  const [isVerified, setIsVerified] = useState(false)
  const [mode, setMode] = useState<"register" | "verify" | "select">("select")

  const steps = mode === "register" ? [
    { id: 0, name: "Profile", icon: User, description: "Create your account" },
    { id: 1, name: "Face", icon: Lock, description: "Register your face" },
    { id: 2, name: "Signature", icon: Fingerprint, description: "Register your signature" },
  ] : [
    { id: 0, name: "Lookup", icon: User, description: "Enter your User ID" },
    { id: 1, name: "Face", icon: Lock, description: "Verify your face" },
    { id: 2, name: "Signature", icon: Fingerprint, description: "Verify your signature" },
  ]

  const handleProfileComplete = (id: string) => {
    setUserId(id)
    setVerificationStatus((prev) => ({ ...prev, profile: true }))
    setCurrentStep(1)
  }

  const handleFaceComplete = () => {
    setVerificationStatus((prev) => ({ ...prev, face: true }))
    if (mode === "verify") {
      setCurrentStep(2)
    } else {
      setCurrentStep(2)
    }
  }

  const handleSignatureComplete = () => {
    setVerificationStatus((prev) => ({ ...prev, signature: true }))
    setIsVerified(true)
  }

  const handleUserLookup = async (id: string) => {
    setUserId(id)
    setVerificationStatus({ profile: true, face: false, signature: false })
    setCurrentStep(1)
  }

  const resetToModeSelection = () => {
    setMode("select")
    setCurrentStep(0)
    setUserId(null)
    setVerificationStatus({ profile: false, face: false, signature: false })
    setIsVerified(false)
  }

  if (isVerified && userId) {
    return (
      <Dashboard
        userId={userId}
        mode={mode}
        onReset={resetToModeSelection}
      />
    )
  }

  if (mode === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">VerifyMe</h1>
            <p className="text-xl text-slate-400">Advanced Biometric Verification System</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card 
              className="bg-slate-900 border-slate-700 hover:border-blue-500 transition-all cursor-pointer group"
              onClick={() => setMode("register")}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">New Registration</h3>
                <p className="text-slate-400 mb-6">Register your profile, face, and signature for future verification</p>
                <div className="space-y-2 text-sm text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Create Profile</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Register Face</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Register Signature</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="bg-slate-900 border-slate-700 hover:border-green-500 transition-all cursor-pointer group"
              onClick={() => setMode("verify")}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <UserCheck className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">User Verification</h3>
                <p className="text-slate-400 mb-6">Already registered? Verify your identity using biometric data</p>
                <div className="space-y-2 text-sm text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enter User ID</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Face Verification</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Signature Verification</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Admin Link */}
          <div className="text-center mt-8">
            <Button
              onClick={() => window.location.href = '/admin'}
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-slate-300 text-sm"
            >
              Admin Panel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">VerifyMe</h1>
              <p className="text-xs text-slate-400">
                {mode === "register" ? "Biometric Registration" : "Biometric Verification"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={resetToModeSelection}
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 mr-4"
            >
              ← Back
            </Button>
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              {verificationStatus.profile ? "✓" : "○"} {steps[0].name}
            </Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              {verificationStatus.face ? "✓" : "○"} {steps[1].name}
            </Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              {verificationStatus.signature ? "✓" : "○"} {steps[2].name}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, idx) => {
              const isCompleted =
                idx < currentStep || verificationStatus[step.name.toLowerCase() as keyof typeof verificationStatus]
              const isCurrent = idx === currentStep
              const Icon = step.icon

              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div className="flex items-center w-full">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all ${
                        isCompleted
                          ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white"
                          : isCurrent
                            ? "bg-slate-800 text-blue-400 ring-2 ring-blue-500"
                            : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                          isCompleted ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-slate-800"
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <p className="font-semibold text-sm text-white">{step.name}</p>
                    <p className="text-xs text-slate-400">{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <Progress value={(currentStep / (steps.length - 1)) * 100} className="h-1 bg-slate-800" />
        </div>

        {/* Step Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {currentStep === 0 && mode === "register" && <UserRegistration onComplete={handleProfileComplete} />}
            {currentStep === 0 && mode === "verify" && <UserLookup onComplete={handleUserLookup} />}
            {currentStep === 1 && userId && <FaceVerification userId={userId} mode={mode} onComplete={handleFaceComplete} />}
            {currentStep === 2 && userId && (
              <SignatureVerification userId={userId} mode={mode} onComplete={handleSignatureComplete} />
            )}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm">Security Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">Face Recognition</p>
                    <p className="text-xs text-slate-400">AI-powered facial verification</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">Signature Analysis</p>
                    <p className="text-xs text-slate-400">Deep learning signature matching</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">Multi-Factor Auth</p>
                    <p className="text-xs text-slate-400">Combined biometric verification</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm">Current Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Profile</span>
                  <Badge variant={verificationStatus.profile ? "default" : "secondary"}>
                    {verificationStatus.profile ? "Complete" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Face</span>
                  <Badge variant={verificationStatus.face ? "default" : "secondary"}>
                    {verificationStatus.face ? "Complete" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Signature</span>
                  <Badge variant={verificationStatus.signature ? "default" : "secondary"}>
                    {verificationStatus.signature ? "Complete" : "Pending"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
