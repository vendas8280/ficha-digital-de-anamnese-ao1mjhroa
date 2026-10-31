import React, { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, Check, PenTool } from 'lucide-react'

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void
  onClear: () => void
  disabled?: boolean
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onSave, onClear, disabled }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Configure canvas resolution
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }, [])

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas && hasDrawn) {
      onSave(canvas.toDataURL('image/png'))
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onClear()
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative border-2 border-dashed border-rose-300 rounded-xl bg-white overflow-hidden shadow-inner h-44 touch-none select-none">
        {!hasDrawn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none p-4 text-center">
            <PenTool className="w-8 h-8 text-rose-400 mb-1 opacity-60 animate-pulse" />
            <p className="text-sm font-medium text-rose-800">
              Assine aqui com o dedo ou caneta touch
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toque e deslize para criar sua assinatura
            </p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-muted-foreground flex items-center gap-1">
          {hasDrawn ? (
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Assinatura capturada
            </span>
          ) : (
            'Campo obrigatório para validade jurídica'
          )}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={!hasDrawn || disabled}
          className="h-8 text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Limpar assinatura
        </Button>
      </div>
    </div>
  )
}
