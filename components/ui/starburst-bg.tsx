"use client"

import { useEffect, useRef } from "react"

/**
 * StarfieldBackground — OG Jett Optics warp-speed starfield.
 * 200 stars with 3D→2D projection, blue trails, glow effect.
 * Ported from Jett-Optics-main/src/components/StarfieldBackground.jsx
 */

interface Star {
  x: number
  y: number
  z: number
  prevX?: number
  prevY?: number
}

export function StarburstBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const animationRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Initialize 200 stars in 3D space
    const numStars = 200
    starsRef.current = Array.from({ length: numStars }, () => ({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      z: Math.random() * 1000,
    }))

    const animate = () => {
      // Dark fade for trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      starsRef.current.forEach((star) => {
        // Move stars toward viewer
        star.z -= 2

        // Reset star if behind viewer
        if (star.z <= 0) {
          star.x = Math.random() * 2000 - 1000
          star.y = Math.random() * 2000 - 1000
          star.z = 1000
          star.prevX = undefined
          star.prevY = undefined
        }

        // Project 3D → 2D
        const x = (star.x / star.z) * 500 + centerX
        const y = (star.y / star.z) * 500 + centerY

        // Size + opacity based on distance
        const size = (1 - star.z / 1000) * 2
        const opacity = 1 - star.z / 1000

        // Dark theme colors — blue trails, white stars
        const trailColor = `rgba(100, 200, 255, ${opacity * 0.5})`
        const starColor = `rgba(255, 255, 255, ${opacity})`
        const glowColor = `rgba(100, 200, 255, ${opacity * 0.3})`

        // Draw trail
        if (star.prevX !== undefined && star.prevY !== undefined) {
          ctx.beginPath()
          ctx.moveTo(star.prevX, star.prevY)
          ctx.lineTo(x, y)
          ctx.strokeStyle = trailColor
          ctx.lineWidth = size * 0.5
          ctx.stroke()
        }

        // Draw star
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = starColor
        ctx.fill()

        // Glow for bright stars
        if (size > 1.5) {
          ctx.beginPath()
          ctx.arc(x, y, size * 2, 0, Math.PI * 2)
          ctx.fillStyle = glowColor
          ctx.fill()
        }

        // Store prev position for trail
        star.prevX = x
        star.prevY = y
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className ?? ""}`}
      style={{ opacity: 0.6 }}
    />
  )
}
