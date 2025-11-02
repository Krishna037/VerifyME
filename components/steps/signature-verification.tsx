"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, AlertCircle, CheckCircle2, Trash2, Upload, RotateCcw, Camera } from "lucide-react"
import CameraSignatureCapture from "@/components/camera-signature-capture"

interface SignatureVerificationProps {
  userId: string
  mode: "register" | "verify"
  onComplete: () => void
}

export default function SignatureVerification({ userId, mode, onComplete }: SignatureVerificationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [samples, setSamples] = useState<Array<{ type: string; data: string }>>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [canvasEmpty, setCanvasEmpty] = useState(true)
  const [showCameraCapture, setShowCameraCapture] = useState(false)

  const initializeCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
    }
    setCanvasEmpty(true)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
      setIsDrawing(true)
      setCanvasEmpty(false)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
      ctx.stroke()
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    initializeCanvas()
  }

  const addSample = () => {
    const canvas = canvasRef.current
    if (!canvas || canvasEmpty) {
      setError("Please draw a signature before adding")
      return
    }

    const imageData = canvas.toDataURL("image/png")
    setSamples([...samples, { type: "pad", data: imageData }])
    clearCanvas()
    setError("")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const imageData = reader.result as string
      setSamples([...samples, { type: "upload", data: imageData }])
      setError("")
    }
    reader.readAsDataURL(file)
  }

  const handleCameraCapture = (imageData: string) => {
    setSamples([...samples, { type: "camera", data: imageData }])
    setShowCameraCapture(false)
    setError("")
  }

  const submitSignatures = async () => {
    if (samples.length === 0) {
      setError(`Please add at least one signature ${mode === "register" ? "sample" : "to verify"}`)
      return
    }

    if (mode === "verify" && samples.length > 1) {
      setError("Please provide only one signature for verification")
      return
    }

    setLoading(true)
    setError("")

    try {
      const endpoint = mode === "register" ? "/process_signature_registration" : "/verify_signature"
      const payload = mode === "register" 
        ? { user_id: userId, samples: samples.map((s) => ({ type: s.type, image: s.data, created: new Date().toISOString() })) }
        : { user_id: userId, image: samples[0]?.data }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `Signature ${mode === "register" ? "registration" : "verification"} failed`)
      }

      if (mode === "verify") {
        if (!result.match) {
          throw new Error("Signature verification failed - signatures do not match")
        }
        
        // Show security warnings if model is untrained
        if (!result.model_trained) {
          setError("⚠️ Warning: Using untrained model - verification may be unreliable. Score: " + (result.score * 100).toFixed(1) + "%")
          // Still proceed but with warning
          setTimeout(() => {
            setSuccess(true)
            setTimeout(() => onComplete(), 2000)
          }, 2000)
          return
        }
      }

      setSuccess(true)
      setTimeout(() => onComplete(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-800 shadow-2xl">
      <CardHeader>
        <CardTitle>{mode === "register" ? "Register Your Signature" : "Verify Your Signature"}</CardTitle>
        <CardDescription>
          {mode === "register" 
            ? "Add multiple signature samples for better accuracy"
            : "Draw or upload your signature to verify your identity"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive" className="bg-red-950 border-red-800 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-950 border-green-800 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-200">
              Signature {mode === "register" ? "registered" : "verified"} successfully!
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="draw" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="draw" className="data-[state=active]:bg-slate-700 transition-all">
              Draw Signature
            </TabsTrigger>
            <TabsTrigger value="camera" className="data-[state=active]:bg-slate-700 transition-all">
              Camera Capture
            </TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:bg-slate-700 transition-all">
              Upload Image
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-4">
            <canvas
              ref={canvasRef}
              width={500}
              height={200}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full border-2 border-slate-700 rounded-lg cursor-crosshair bg-white shadow-lg transition-all hover:border-slate-600"
              onLoad={initializeCanvas}
            />
            <div className="flex gap-3">
              <Button
                onClick={clearCanvas}
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent transition-all"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                onClick={addSample}
                disabled={canvasEmpty}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Sample
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="camera" className="space-y-4">
            {showCameraCapture ? (
              <CameraSignatureCapture
                onCapture={handleCameraCapture}
                onCancel={() => setShowCameraCapture(false)}
              />
            ) : (
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-slate-600 transition-colors">
                <Camera className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-400 mb-4">Use your laptop camera to capture signature</p>
                <Button
                  onClick={() => setShowCameraCapture(true)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-slate-600 transition-colors">
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 mb-4">Click to upload or drag and drop</p>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 transition-all"
              >
                Choose File
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {samples.length > 0 && (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Samples Added: {samples.length}</p>
              <p className="text-xs text-slate-400">
                {mode === "register" 
                  ? (samples.length >= 2 ? "Ready to submit" : "Add at least 2 samples")
                  : "Ready to verify"
                }
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {samples.map((sample, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={sample.data || "/placeholder.svg"}
                    alt={`Sample ${idx + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-slate-700 transition-all group-hover:border-slate-600"
                  />
                  <button
                    onClick={() => setSamples(samples.filter((_, i) => i !== idx))}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={submitSignatures}
          disabled={loading || samples.length === 0 || (mode === "register" && samples.length < 2)}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {mode === "register" ? "Registering Signatures..." : "Verifying Signature..."}
            </>
          ) : (
            mode === "register" ? "Complete Registration" : "Verify Signature"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
