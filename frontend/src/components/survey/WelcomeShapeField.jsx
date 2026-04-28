import { useEffect, useMemo, useRef } from 'react'

const LOOP_DURATION_MS = 120000
const BIN_WIDTH = 20
const BOTTOM_PADDING = 16

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clampValue(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function hexToRgba(hex, alpha = 1) {
  const trimmed = `${hex || ''}`.trim()
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  const validHex = /^#[0-9a-f]{6}$/i.test(normalized)
    ? normalized
    : /^#[0-9a-f]{3}$/i.test(normalized)
      ? `#${normalized
          .slice(1)
          .split('')
          .map((part) => `${part}${part}`)
          .join('')}`
      : '#f79945'

  const red = Number.parseInt(validHex.slice(1, 3), 16)
  const green = Number.parseInt(validHex.slice(3, 5), 16)
  const blue = Number.parseInt(validHex.slice(5, 7), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function buildWelcomeShapePalette(primaryColor, accentColor) {
  return [
    {
      fill: hexToRgba(primaryColor, 0.08),
      stroke: hexToRgba(primaryColor, 0.18),
      glow: hexToRgba(primaryColor, 0.04),
    },
    {
      fill: hexToRgba(accentColor || primaryColor, 0.06),
      stroke: hexToRgba(accentColor || primaryColor, 0.14),
      glow: hexToRgba(accentColor || primaryColor, 0.03),
    },
    {
      fill: 'rgba(255, 255, 255, 0.05)',
      stroke: hexToRgba(primaryColor, 0.1),
      glow: 'rgba(255, 255, 255, 0.02)',
    },
  ]
}

function drawWelcomeShape(ctx, shape) {
  ctx.save()
  ctx.translate(shape.x, shape.y)
  ctx.rotate(shape.rotation)
  ctx.beginPath()

  if (shape.kind === 'triangle') {
    ctx.moveTo(0, -shape.size)
    ctx.lineTo(shape.size * 0.88, shape.size * 0.72)
    ctx.lineTo(-shape.size * 0.88, shape.size * 0.72)
    ctx.closePath()
  } else if (shape.kind === 'diamond') {
    ctx.moveTo(0, -shape.size)
    ctx.lineTo(shape.size * 0.78, 0)
    ctx.lineTo(0, shape.size)
    ctx.lineTo(-shape.size * 0.78, 0)
    ctx.closePath()
  } else if (shape.kind === 'hexagon') {
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI / 3) * index - Math.PI / 6
      const x = Math.cos(angle) * shape.size * 0.84
      const y = Math.sin(angle) * shape.size * 0.84
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
  } else {
    ctx.rect(-shape.size * 0.8, -shape.size * 0.8, shape.size * 1.6, shape.size * 1.6)
  }

  ctx.shadowBlur = 5
  ctx.shadowColor = shape.glow
  ctx.fillStyle = shape.fill
  ctx.strokeStyle = shape.stroke
  ctx.lineWidth = 1
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export default function WelcomeShapeField({ primaryColor, accentColor }) {
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(0)
  const mountTimeRef = useRef(0)
  const activeShapesRef = useRef([])
  const settledShapesRef = useRef([])
  const stackHeightsRef = useRef([])
  const pointerRef = useRef({
    x: 0,
    y: 0,
    previousX: 0,
    previousY: 0,
    vx: 0,
    vy: 0,
    active: false,
  })
  const spawnAccumulatorRef = useRef(0)
  const lastWakeRef = useRef(0)
  const shapeIdRef = useRef(0)
  const palette = useMemo(
    () => buildWelcomeShapePalette(primaryColor, accentColor),
    [accentColor, primaryColor]
  )

  useEffect(() => {
    if (prefersReducedMotion()) {
      return undefined
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return undefined
    }

    const getCanvasSize = () => ({
      width: canvas.clientWidth || 1,
      height: canvas.clientHeight || 1,
    })

    const getCoveredBins = (shape, width) => {
      const totalBins = Math.max(1, Math.ceil(width / BIN_WIDTH))
      const start = clampValue(
        Math.floor((shape.x - shape.size) / BIN_WIDTH),
        0,
        totalBins - 1
      )
      const end = clampValue(
        Math.floor((shape.x + shape.size) / BIN_WIDTH),
        0,
        totalBins - 1
      )

      return { start, end, totalBins }
    }

    const rebuildStackHeights = (width, height) => {
      const nextStacks = new Array(Math.ceil(width / BIN_WIDTH)).fill(0)

      settledShapesRef.current.forEach((shape) => {
        const { start, end } = getCoveredBins(shape, width)
        const occupiedHeight = Math.max(
          0,
          height - BOTTOM_PADDING - shape.y + shape.size * 0.48
        )

        for (let index = start; index <= end; index += 1) {
          nextStacks[index] = Math.max(nextStacks[index], occupiedHeight)
        }
      })

      stackHeightsRef.current = nextStacks
    }

    const resizeCanvas = () => {
      const { width, height } = getCanvasSize()
      const ratio = window.devicePixelRatio || 1

      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      activeShapesRef.current = []
      settledShapesRef.current = []
      stackHeightsRef.current = new Array(Math.ceil(width / BIN_WIDTH)).fill(0)
      spawnAccumulatorRef.current = 0
    }

    const createShape = (width) => {
      const variants = ['triangle', 'square', 'diamond', 'hexagon']
      const nextPalette = palette[Math.floor(Math.random() * palette.length)]
      const size = 4 + Math.random() * 6

      return {
        id: shapeIdRef.current++,
        x: width * 0.08 + Math.random() * width * 0.84,
        y: -20 - size,
        vx: (Math.random() - 0.5) * 0.2,
        vy: 0.12 + Math.random() * 0.08,
        size,
        kind: variants[Math.floor(Math.random() * variants.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.012,
        fill: nextPalette.fill,
        stroke: nextPalette.stroke,
        glow: nextPalette.glow,
      }
    }

    const scatterSettledShapes = (pointerX, pointerY, width, height, limit = 8) => {
      const scatterRadius = 84
      const nextSettled = []
      const scatteredShapes = []

      settledShapesRef.current.forEach((shape) => {
        const distance = Math.hypot(shape.x - pointerX, shape.y - pointerY)
        if (distance <= scatterRadius && scatteredShapes.length < limit) {
          const angle = Math.atan2(shape.y - pointerY, shape.x - pointerX)
          scatteredShapes.push({
            ...shape,
            vx: Math.cos(angle) * (0.35 + Math.random() * 0.4),
            vy: -0.9 - Math.random() * 0.7 + Math.sin(angle) * 0.12,
            rotationSpeed: (Math.random() - 0.5) * 0.08,
            y: shape.y - 2,
          })
        } else {
          nextSettled.push(shape)
        }
      })

      if (scatteredShapes.length) {
        settledShapesRef.current = nextSettled
        activeShapesRef.current.push(...scatteredShapes)
        rebuildStackHeights(width, height)
      }
    }

    const handlePointerMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const pointer = pointerRef.current

      pointer.vx = pointerX - pointer.previousX
      pointer.vy = pointerY - pointer.previousY
      pointer.previousX = pointerX
      pointer.previousY = pointerY
      pointer.x = pointerX
      pointer.y = pointerY
      pointer.active = true

      const now = performance.now()
      if (Math.hypot(pointer.vx, pointer.vy) > 18 && now - lastWakeRef.current > 180) {
        const { width, height } = getCanvasSize()
        scatterSettledShapes(pointerX, pointerY, width, height, 2)
        lastWakeRef.current = now
      }
    }

    const handlePointerLeave = () => {
      pointerRef.current.active = false
      pointerRef.current.vx = 0
      pointerRef.current.vy = 0
    }

    const handlePointerDown = (event) => {
      const rect = canvas.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const { width, height } = getCanvasSize()

      scatterSettledShapes(pointerX, pointerY, width, height, 12)

      activeShapesRef.current = activeShapesRef.current.map((shape) => {
        const distance = Math.hypot(shape.x - pointerX, shape.y - pointerY)
        if (distance > 92) {
          return shape
        }

        const angle = Math.atan2(shape.y - pointerY, shape.x - pointerX)
        return {
          ...shape,
          vx: shape.vx + Math.cos(angle) * (0.3 + Math.random() * 0.35),
          vy: shape.vy - 0.7 - Math.random() * 0.55,
          rotationSpeed: shape.rotationSpeed + (Math.random() - 0.5) * 0.06,
        }
      })
    }

    resizeCanvas()
    mountTimeRef.current = performance.now()

    let previousTime = performance.now()

    const renderFrame = (currentTime) => {
      const { width, height } = getCanvasSize()
      const delta = Math.min(34, currentTime - previousTime)
      previousTime = currentTime
      const deltaFactor = delta / 16.6667
      const pointer = pointerRef.current
      const maxShapes = 80
      const maximumPileHeight = height * 0.2
      const canSpawn = currentTime - mountTimeRef.current < LOOP_DURATION_MS

      context.clearRect(0, 0, width, height)

      const maximumStack = stackHeightsRef.current.length
        ? Math.max(...stackHeightsRef.current)
        : 0

      if (
        canSpawn &&
        activeShapesRef.current.length + settledShapesRef.current.length < maxShapes &&
        maximumStack < maximumPileHeight
      ) {
        spawnAccumulatorRef.current += delta
        while (spawnAccumulatorRef.current >= 720) {
          activeShapesRef.current.push(createShape(width))
          spawnAccumulatorRef.current -= 720
        }
      }

      activeShapesRef.current = activeShapesRef.current.flatMap((shape) => {
        const nextShape = { ...shape }
        const pointerDistance = Math.hypot(nextShape.x - pointer.x, nextShape.y - pointer.y)

        if (pointer.active && pointerDistance < 92) {
          const influence = 1 - pointerDistance / 92
          const directionX = nextShape.x - pointer.x || 1
          const directionY = nextShape.y - pointer.y || 1
          const magnitude = Math.hypot(directionX, directionY) || 1

          nextShape.vx +=
            (directionX / magnitude) * 0.045 * influence +
            pointer.vx * 0.004 * influence
          nextShape.vy +=
            (directionY / magnitude) * 0.02 * influence +
            pointer.vy * 0.002 * influence
        }

        nextShape.vx *= 0.997
        nextShape.vy = Math.min(nextShape.vy + 0.015 * deltaFactor, 1.2)
        nextShape.x += nextShape.vx * deltaFactor
        nextShape.y += nextShape.vy * deltaFactor
        nextShape.rotation += nextShape.rotationSpeed * deltaFactor

        if (nextShape.x < nextShape.size) {
          nextShape.x = nextShape.size
          nextShape.vx *= -0.4
        } else if (nextShape.x > width - nextShape.size) {
          nextShape.x = width - nextShape.size
          nextShape.vx *= -0.4
        }

        const { start, end, totalBins } = getCoveredBins(nextShape, width)
        if (stackHeightsRef.current.length !== totalBins) {
          stackHeightsRef.current = new Array(totalBins).fill(0)
        }

        let supportHeight = 0
        for (let index = start; index <= end; index += 1) {
          supportHeight = Math.max(supportHeight, stackHeightsRef.current[index] || 0)
        }

        const floorY = height - BOTTOM_PADDING - supportHeight - nextShape.size * 0.5

        if (nextShape.y >= floorY && nextShape.vy > 0) {
          nextShape.y = floorY
          nextShape.vx *= 0.18
          nextShape.vy = 0
          settledShapesRef.current.push(nextShape)

          const occupiedHeight = supportHeight + nextShape.size * 0.76
          for (let index = start; index <= end; index += 1) {
            stackHeightsRef.current[index] = Math.max(
              stackHeightsRef.current[index] || 0,
              occupiedHeight
            )
          }

          return []
        }

        return [nextShape]
      })

      if (stackHeightsRef.current.length > 0) {
        const stackPeak = Math.max(...stackHeightsRef.current)
        if (stackPeak > 6) {
          const gradient = context.createLinearGradient(0, height - stackPeak - 20, 0, height)
          gradient.addColorStop(0, hexToRgba(primaryColor, 0))
          gradient.addColorStop(1, hexToRgba(primaryColor, 0.03))
          context.fillStyle = gradient
          context.fillRect(0, height - stackPeak - 20, width, stackPeak + 28)
        }
      }

      settledShapesRef.current.forEach((shape) => drawWelcomeShape(context, shape))
      activeShapesRef.current.forEach((shape) => drawWelcomeShape(context, shape))
      pointer.vx *= 0.88
      pointer.vy *= 0.88

      animationFrameRef.current = window.requestAnimationFrame(renderFrame)
    }

    animationFrameRef.current = window.requestAnimationFrame(renderFrame)
    window.addEventListener('resize', resizeCanvas)
    canvas.addEventListener('mousemove', handlePointerMove)
    canvas.addEventListener('mouseleave', handlePointerLeave)
    canvas.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current)
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener('mousemove', handlePointerMove)
      canvas.removeEventListener('mouseleave', handlePointerLeave)
      canvas.removeEventListener('mousedown', handlePointerDown)
    }
  }, [accentColor, palette, primaryColor])

  return <canvas ref={canvasRef} className="public-survey-shape-canvas" aria-hidden="true" />
}
