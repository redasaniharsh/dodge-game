"use client"

import { useRef, useEffect, useState } from "react"

interface Player {
  x: number
  y: number
  width: number
  height: number
  color: string
}

interface Obstacle {
  x: number
  y: number
  width: number
  height: number
  color: string
  speed: number
}

interface GameState {
  score: number
  highScore: number
  gameOver: boolean
  gameStarted: boolean
  level: number
}

export default function DodgeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameStateRef = useRef<GameState>({
    score: 0,
    highScore: typeof window !== "undefined" ? Number.parseInt(localStorage.getItem("dodgeHighScore") || "0") : 0,
    gameOver: false,
    gameStarted: false,
    level: 1,
  })
  const [gameState, setGameState] = useState<GameState>(gameStateRef.current)
  const playerRef = useRef<Player>({
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    color: "#00D4FF",
  })
  const obstaclesRef = useRef<Obstacle[]>([])
  const mouseRef = useRef({ x: 0, y: 0 })
  const animationIdRef = useRef<number | null>(null)

  // Audio context and sound functions
  const audioContextRef = useRef<AudioContext | null>(null)

  const playSound = (frequency: number, duration: number, type: "sine" | "square" | "triangle" = "sine") => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioContextRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = type
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch (error) {
      console.log("[v0] Sound error:", error)
    }
  }

  const playCoinSound = () => {
    playSound(800, 0.1, "sine")
    setTimeout(() => playSound(1000, 0.1, "sine"), 60)
  }

  const playCollisionSound = () => {
    playSound(200, 0.3, "square")
  }

  const playGameOverSound = () => {
    playSound(400, 0.1, "sine")
    setTimeout(() => playSound(300, 0.2, "sine"), 150)
  }

  const playLevelUpSound = () => {
    playSound(523, 0.1, "sine")
    setTimeout(() => playSound(659, 0.1, "sine"), 120)
    setTimeout(() => playSound(784, 0.15, "sine"), 240)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Initialize player in center
    playerRef.current = {
      x: canvas.width / 2 - 20,
      y: canvas.height - 80,
      width: 40,
      height: 40,
      color: "#00D4FF",
    }

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    // Click to start/restart
    const handleClick = () => {
      if (!gameStateRef.current.gameStarted || gameStateRef.current.gameOver) {
        gameStateRef.current = {
          score: 0,
          highScore: gameStateRef.current.highScore,
          gameOver: false,
          gameStarted: true,
          level: 1,
        }
        obstaclesRef.current = []
        setGameState({ ...gameStateRef.current })
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("click", handleClick)

    let spawnCounter = 0
    let frameCount = 0

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)

      const player = playerRef.current
      const state = gameStateRef.current

      // Clear canvas
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, "#0f172a")
      gradient.addColorStop(0.5, "#1e293b")
      gradient.addColorStop(1, "#0f172a")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (state.gameStarted) {
        // Update player position
        player.x = mouseRef.current.x - player.width / 2
        player.x = Math.max(0, Math.min(player.x, canvas.width - player.width))
        player.y = mouseRef.current.y - player.height / 2
        player.y = Math.max(0, Math.min(player.y, canvas.height - player.height))

        // Draw player with glow
        ctx.shadowColor = "#00D4FF"
        ctx.shadowBlur = 20
        ctx.fillStyle = player.color
        ctx.fillRect(player.x, player.y, player.width, player.height)
        ctx.shadowBlur = 0

        if (!state.gameOver) {
          // Spawn obstacles
          spawnCounter++
          const spawnRate = Math.max(20, 80 - state.level * 5)
          if (spawnCounter > spawnRate) {
            spawnCounter = 0
            const colors = ["#FF006E", "#FB5607", "#FFBE0B", "#8338EC", "#3A86FF"]
            obstaclesRef.current.push({
              x: Math.random() * (canvas.width - 50),
              y: -50,
              width: 50,
              height: 50,
              color: colors[Math.floor(Math.random() * colors.length)],
              speed: 2 + state.level * 0.5,
            })
          }

          // Update and draw obstacles
          for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
            const obs = obstaclesRef.current[i]
            obs.y += obs.speed

            // Draw obstacle with glow
            ctx.shadowColor = obs.color
            ctx.shadowBlur = 15
            ctx.fillStyle = obs.color
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height)
            ctx.shadowBlur = 0

            // Check collision
            if (
              player.x < obs.x + obs.width &&
              player.x + player.width > obs.x &&
              player.y < obs.y + obs.height &&
              player.y + player.height > obs.y
            ) {
              state.gameOver = true
              playCollisionSound()
              playGameOverSound()
            }

            // Remove off-screen obstacles and increase score
            if (obs.y > canvas.height) {
              obstaclesRef.current.splice(i, 1)
              state.score += 10

              // Level up every 100 points
              if (state.score % 100 === 0 && state.score > 0) {
                state.level = Math.floor(state.score / 100) + 1
                playLevelUpSound()
              } else {
                playCoinSound()
              }

              if (state.score > state.highScore) {
                state.highScore = state.score
                localStorage.setItem("dodgeHighScore", state.score.toString())
              }
            }
          }
        } else {
          for (let i = 0; i < obstaclesRef.current.length; i++) {
            const obs = obstaclesRef.current[i]

            // Draw obstacle with glow (no movement)
            ctx.shadowColor = obs.color
            ctx.shadowBlur = 15
            ctx.fillStyle = obs.color
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height)
            ctx.shadowBlur = 0
          }
        }

        setGameState({ ...state })
      }

      // Draw HUD
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
      ctx.font = "bold 32px Arial"
      ctx.fillText(`Score: ${state.score}`, 20, 50)
      ctx.font = "24px Arial"
      ctx.fillText(`High: ${state.highScore}`, 20, 90)
      ctx.fillText(`Level: ${state.level}`, canvas.width - 200, 50)

      // Game Over screen
      if (state.gameStarted && state.gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.fillStyle = "rgba(255, 0, 110, 0.9)"
        ctx.font = "bold 64px Arial"
        ctx.textAlign = "center"
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 80)

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
        ctx.font = "32px Arial"
        ctx.fillText(`Final Score: ${state.score}`, canvas.width / 2, canvas.height / 2 + 20)
        ctx.fillText(`Best Score: ${state.highScore}`, canvas.width / 2, canvas.height / 2 + 70)

        ctx.fillStyle = "rgba(0, 212, 255, 0.9)"
        ctx.font = "24px Arial"
        ctx.fillText("Click to Restart", canvas.width / 2, canvas.height / 2 + 140)
        ctx.textAlign = "left"
      }

      // Start screen
      if (!state.gameStarted) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.fillStyle = "rgba(0, 212, 255, 0.95)"
        ctx.font = "bold 72px Arial"
        ctx.textAlign = "center"
        ctx.fillText("DODGE GAME", canvas.width / 2, canvas.height / 2 - 100)

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
        ctx.font = "28px Arial"
        ctx.fillText("Move your mouse to dodge falling obstacles!", canvas.width / 2, canvas.height / 2 - 20)
        ctx.fillText("Earn points for each obstacle you avoid", canvas.width / 2, canvas.height / 2 + 30)

        ctx.fillStyle = "rgba(0, 212, 255, 0.9)"
        ctx.font = "bold 32px Arial"
        ctx.fillText("Click to Start", canvas.width / 2, canvas.height / 2 + 120)
        ctx.textAlign = "left"
      }

      frameCount++
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("click", handleClick)
      window.removeEventListener("resize", handleResize)
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current)
    }
  }, [])

  

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-950">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  )
}
