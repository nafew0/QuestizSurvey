/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { isValidElement } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

import { cn } from '@/lib/utils'

const ToastContext = createContext(null)

const TOAST_ICONS = {
  success: CheckCircle2,
  warning: TriangleAlert,
  error: TriangleAlert,
  info: Info,
  default: Info,
}

const TOAST_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  default: 'border-slate-200 bg-white text-slate-900',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timeoutMap = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))

    const timeoutId = timeoutMap.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutMap.current.delete(id)
    }
  }, [])

  const scheduleDismiss = useCallback((id, duration) => {
    const timeoutId = timeoutMap.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutMap.current.delete(id)
    }

    if (!duration || duration <= 0) {
      return
    }

    const nextTimeoutId = window.setTimeout(() => dismiss(id), duration)
    timeoutMap.current.set(id, nextTimeoutId)
  }, [dismiss])

  const toast = useCallback(
    ({ id: providedId, title, description, variant = 'default', duration = 3200 }) => {
      const id = providedId || crypto.randomUUID()

      setToasts((current) => {
        const nextToast = {
          id,
          title,
          description,
          variant,
        }

        if (current.some((toastItem) => toastItem.id === id)) {
          return current.map((toastItem) => (toastItem.id === id ? nextToast : toastItem))
        }

        return [...current, nextToast]
      })
      scheduleDismiss(id, duration)

      return id
    },
    [scheduleDismiss]
  )

  const update = useCallback(
    (id, patch = {}) => {
      setToasts((current) =>
        current.map((toastItem) =>
          toastItem.id === id
            ? {
                ...toastItem,
                ...patch,
                id,
              }
            : toastItem
        )
      )
      if (Object.prototype.hasOwnProperty.call(patch, 'duration')) {
        scheduleDismiss(id, patch.duration)
      }
    },
    [scheduleDismiss]
  )

  const value = useMemo(
    () => ({
      toast,
      dismiss,
      update,
    }),
    [dismiss, toast, update]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
        <div className="flex w-full max-w-md flex-col gap-3">
          {toasts.map((item) => {
            const Icon = TOAST_ICONS[item.variant] ?? TOAST_ICONS.default
            return (
              <div
                key={item.id}
                className={cn(
                  'pointer-events-auto rounded-2xl border shadow-lg shadow-slate-900/10 backdrop-blur-sm transition-all',
                  TOAST_STYLES[item.variant] ?? TOAST_STYLES.default
                )}
              >
                <div className="flex items-start gap-3 p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    {item.title ? (
                      <p className="text-sm font-semibold tracking-tight">{item.title}</p>
                    ) : null}
                    {item.description ? (
                      isValidElement(item.description) ? (
                        <div className="mt-1 text-sm opacity-80">{item.description}</div>
                      ) : (
                        <p className="mt-1 text-sm opacity-80">{item.description}</p>
                      )
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    className="rounded-full p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}
