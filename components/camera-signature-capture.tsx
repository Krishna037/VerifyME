"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, Camera, Square, RotateCcw } from "lucide-react"

interface CameraSignatureCaptureProps {
  onCapture: (imageData: string) => void
  onCancel: () => void
}

export default function CameraSignatureCapture({ onCapture, onCancel }: CameraSignatureCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cameraActive, setCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    startCamera()
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user", 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setCameraActive(true)
        setError("")
      }
    } catch (err) {
      setError("Could not access camera. Please check permissions.")
    }
  }

  const captureSignature = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setCapturing(true)
    
    // Countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    setCountdown(0)

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")

    if (ctx) {
      // Set canvas size to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Convert to data URL
      const imageData = canvas.toDataURL("image/png")
      
      // Stop camera
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      
      onCapture(imageData)
    }

    setCapturing(false)
  }

  return (
    <Card className="bg-slate-900 border-slate-700 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Camera Signature Capture
        </CardTitle>
        <CardDescription>
          Position a white paper with your signature in front of the camera
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <Alert className="border-red-600 bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video border-2 border-slate-700 shadow-lg">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <canvas 
              ref={canvasRef} 
              className="hidden"
            />
            
            {countdown > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-6xl font-bold text-white animate-pulse">
                  {countdown}
                </div>
              </div>
            )}

            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                <div className="text-center">
                  <Camera className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">Starting camera...</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-medium text-white mb-2">Instructions:</h4>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Hold a white paper with your signature clearly visible</li>
              <li>• Ensure good lighting and no shadows</li>
              <li>• Keep the signature in the center of the frame</li>
              <li>• A 3-second countdown will start before capture</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={captureSignature}
              disabled={!cameraActive || capturing}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              {capturing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {countdown > 0 ? `Capturing in ${countdown}...` : "Capturing..."}
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Signature
                </>
              )}
            </Button>
            
            <Button
              onClick={onCancel}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}