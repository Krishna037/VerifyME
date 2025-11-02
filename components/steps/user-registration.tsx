"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

interface UserRegistrationProps {
  onComplete: (userId: string) => void
}

export default function UserRegistration({ onComplete }: UserRegistrationProps) {
  const [formData, setFormData] = useState({
    userId: "",
    name: "",
    email: "",
    age: "",
    gender: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "userId":
        if (!value) return "User ID is required"
        if (value.length < 3) return "User ID must be at least 3 characters"
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return "User ID can only contain letters, numbers, and underscores"
        return ""
      case "name":
        if (!value) return "Full name is required"
        if (value.length < 2) return "Name must be at least 2 characters"
        return ""
      case "email":
        if (!value) return "Email is required"
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email"
        return ""
      case "age":
        if (!value) return "Age is required"
        if (Number(value) < 18) return "You must be at least 18 years old"
        if (Number(value) > 120) return "Please enter a valid age"
        return ""
      case "gender":
        if (!value) return "Please select a gender"
        return ""
      default:
        return ""
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (touched[name]) {
      const error = validateField(name, value)
      setFieldErrors((prev) => ({ ...prev, [name]: error }))
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    const error = validateField(name, value)
    setFieldErrors((prev) => ({ ...prev, [name]: error }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key as keyof typeof formData])
      if (error) newErrors[key] = error
    })
    setFieldErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!validateForm()) {
      setError("Please fix the errors above")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/register_user_profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: formData.userId,
          name: formData.name,
          email: formData.email,
          age: parseInt(formData.age),
          gender: formData.gender,
        }),
      })

      if (!response.ok) throw new Error("Registration failed")

      setSuccess(true)
      setTimeout(() => onComplete(formData.userId), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-800 shadow-2xl">
      <CardHeader>
        <CardTitle>Create Your Profile</CardTitle>
        <CardDescription>Enter your information to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-950 border-red-800 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-950 border-green-800 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-200">Profile created successfully!</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId" className="text-slate-300">
                User ID
              </Label>
              <Input
                id="userId"
                name="userId"
                placeholder="e.g., john_doe"
                value={formData.userId}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 transition-all ${
                  fieldErrors.userId ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"
                }`}
              />
              {fieldErrors.userId && touched.userId && (
                <p className="text-xs text-red-400 animate-in fade-in">{fieldErrors.userId}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">
                Full Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 transition-all ${
                  fieldErrors.name ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"
                }`}
              />
              {fieldErrors.name && touched.name && (
                <p className="text-xs text-red-400 animate-in fade-in">{fieldErrors.name}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 transition-all ${
                fieldErrors.email ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"
              }`}
            />
            {fieldErrors.email && touched.email && (
              <p className="text-xs text-red-400 animate-in fade-in">{fieldErrors.email}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age" className="text-slate-300">
                Age
              </Label>
              <Input
                id="age"
                name="age"
                type="number"
                placeholder="25"
                value={formData.age}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 transition-all ${
                  fieldErrors.age ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"
                }`}
              />
              {fieldErrors.age && touched.age && (
                <p className="text-xs text-red-400 animate-in fade-in">{fieldErrors.age}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender" className="text-slate-300">
                Gender
              </Label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className={`w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.gender ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"
                }`}
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {fieldErrors.gender && touched.gender && (
                <p className="text-xs text-red-400 animate-in fade-in">{fieldErrors.gender}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Profile...
              </>
            ) : (
              "Continue to Face Registration"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
