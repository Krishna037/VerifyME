"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, Camera, Volume2 } from "lucide-react"

interface FaceVerificationProps {
  userId: string
  mode: "register" | "verify"
  onComplete: () => void
}

export default function FaceVerification({ userId, mode, onComplete }: FaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [faceDetected, setFaceDetected] = useState(false)
  const [faceStatus, setFaceStatus] = useState("No face detected")
  const [faceCount, setFaceCount] = useState(0)
  const [captureCount, setCaptureCount] = useState(0)
  const [liveVerification, setLiveVerification] = useState(false)
  const [wsStatus, setWsStatus] = useState("")
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
      }
    }
  }, [stream])

  // Real-time face detection
  const detectFacesRealtime = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return

    try {
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
        const imageData = canvasRef.current.toDataURL("image/jpeg")

        const response = await fetch("/detect_faces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageData }),
        })

        if (response.ok) {
          const result = await response.json()
          setFaceCount(result.face_count || 0)
          
          if (result.face_count === 0) {
            setFaceDetected(false)
            setFaceStatus("Position your face in the frame")
          } else if (result.face_count === 1) {
            setFaceDetected(true)
            setFaceStatus("Face detected - Ready to capture")
          } else {
            setFaceDetected(false)
            setFaceStatus(`Multiple faces detected (${result.face_count}) - Please ensure only you are visible`)
          }
        } else {
          // If detection fails, fall back to allowing capture
          setFaceCount(0)
          setFaceDetected(false)
          setFaceStatus("Camera ready - Position your face")
        }
      }
    } catch (error) {
      // If detection fails, fall back to allowing capture
      setFaceCount(0)
      setFaceDetected(false)
      setFaceStatus("Camera ready - Position your face")
    }
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setCameraActive(true)
        setError("")
        
        // Start real-time face detection
        detectionIntervalRef.current = setInterval(detectFacesRealtime, 1000) // Check every second
      }
    } catch (err) {
      setError("Could not access camera. Please check permissions.")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
      setCameraActive(false)
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }
    setFaceDetected(false)
    setFaceStatus("No face detected")
    setFaceCount(0)
  }

  const captureFace = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setLoading(true)
    setError("")

    try {
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
        const imageData = canvasRef.current.toDataURL("image/jpeg")

        const endpoint = mode === "register" ? "/register_face" : "/verify_face"
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, image: imageData }),
        })

        if (!response.ok) throw new Error(`Face ${mode === "register" ? "registration" : "verification"} failed`)

        const result = await response.json()
        
        if (mode === "verify") {
          if (!result.success || result.verified === false) {
            const similarity = result.similarity ? ` (Similarity: ${(result.similarity * 100).toFixed(1)}%)` : ""
            throw new Error(result.message + similarity || "Face verification failed")
          }
          
          // Show similarity score for successful verification
          if (result.similarity) {
            console.log(`Face verified with ${(result.similarity * 100).toFixed(1)}% similarity`)
          }
        } else {
          // Registration mode
          if (!result.success) {
            throw new Error(result.message || "Face registration failed")
          }
        }

        setCaptureCount((prev) => prev + 1)
        setSuccess(true)
        stopCamera()
        setTimeout(() => onComplete(), 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-800 shadow-2xl">
      <CardHeader>
        <CardTitle>{mode === "register" ? "Register Your Face" : "Verify Your Face"}</CardTitle>
        <CardDescription>
          {mode === "register" 
            ? "Position your face in good lighting for accurate registration"
            : "Look at the camera to verify your identity"
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
              Face {mode === "register" ? "registered" : "verified"} successfully!
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video border-2 border-slate-700 shadow-lg">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                <div className="text-center">
                  <Camera className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">Camera not active</p>
                </div>
              </div>
            )}
            {cameraActive && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  faceCount === 1 ? "bg-green-500 animate-pulse" : 
                  faceCount > 1 ? "bg-yellow-500 animate-pulse" : "bg-red-500"
                }`} />
                <span className="text-xs text-white">{faceStatus}</span>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} width={1280} height={720} className="hidden" />

          <div className="flex gap-3">
            {!cameraActive ? (
              <Button
                onClick={startCamera}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold transition-all"
              >
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
            ) : (
              <>
                <Button
                  onClick={captureFace}
                  disabled={loading || faceCount > 1}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {mode === "register" ? "Registering..." : "Verifying..."}
                    </>
                  ) : (
                    mode === "register" ? "Capture & Register" : "Capture & Verify"
                  )}
                </Button>
                <Button
                  onClick={stopCamera}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent transition-all"
                >
                  Stop
                </Button>
              </>
            )}
          </div>

          <div className="bg-slate-800 rounded-lg p-4 space-y-2 border border-slate-700">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Tips for best results:
            </p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• Ensure only you are visible in the frame</li>
              <li>• Ensure good lighting on your face</li>
              <li>• Look directly at the camera</li>
              <li>• Keep your face centered in the frame</li>
              <li>• Remove sunglasses or hats</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
