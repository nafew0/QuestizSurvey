import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LoaderCircle,
  MessageSquareText,
  PanelRightClose,
  Plus,
  SendHorizontal,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  getChatSessions,
  sendChatMessage,
} from '@/services/aiChat'

import SafeMarkdown from './SafeMarkdown'

function hasActiveFilters(filters = {}) {
  return Boolean(
    filters?.date_from ||
      filters?.date_to ||
      filters?.collector_id ||
      filters?.status ||
      filters?.text_search ||
      filters?.duration_min_seconds != null ||
      filters?.duration_max_seconds != null ||
      (Array.isArray(filters?.answer_filters) && filters.answer_filters.length)
  )
}

function buildOptimisticScope(filters = {}) {
  const filtersActive = hasActiveFilters(filters)
  return {
    filters,
    filters_active: filtersActive,
    scope_label: filtersActive ? 'Filtered dataset' : 'All responses',
  }
}

function buildSessionOptions(sessions = []) {
  return sessions.map((session) => ({
    value: session.id,
    label: session.title,
  }))
}

function buildFallbackSession(sessionId, title = 'New chat') {
  const now = new Date().toISOString()
  return {
    id: sessionId,
    title,
    created_at: now,
    updated_at: now,
    messages: [],
  }
}

export default function AIChatPanel({
  surveyId,
  surveyTitle,
  filters = {},
  open,
  onOpenChange,
  draftSeed = '',
  draftSeedVersion = 0,
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const textareaRef = useRef(null)
  const messagesEndRef = useRef(null)
  const sessionsErrorHandledAtRef = useRef(0)
  const sessionDetailErrorHandledAtRef = useRef(0)
  const [activeSessionId, setActiveSessionId] = useState('')
  const [draft, setDraft] = useState('')
  const [pendingUserTurn, setPendingUserTurn] = useState(null)
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false)

  const activeSessionStorageKey = `questiz:ai-chat-session:${surveyId}`
  const filtersActive = useMemo(() => hasActiveFilters(filters), [filters])

  useEffect(() => {
    if (!surveyId) {
      return
    }

    const storedSessionId = window.localStorage.getItem(activeSessionStorageKey) || ''
    setActiveSessionId(storedSessionId)
    setDraft('')
    setPendingUserTurn(null)
    setAutoCreateAttempted(false)
  }, [activeSessionStorageKey, surveyId])

  useEffect(() => {
    if (!surveyId) {
      return
    }

    if (activeSessionId) {
      window.localStorage.setItem(activeSessionStorageKey, activeSessionId)
      return
    }

    window.localStorage.removeItem(activeSessionStorageKey)
  }, [activeSessionId, activeSessionStorageKey, surveyId])

  useEffect(() => {
    if (!draftSeedVersion) {
      return
    }

    setDraft(draftSeed)
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(draftSeed.length, draftSeed.length)
    })
  }, [draftSeed, draftSeedVersion])

  useEffect(() => {
    if (!open) {
      setPendingUserTurn(null)
      setAutoCreateAttempted(false)
    }
  }, [open])

  const sessionsQuery = useQuery({
    queryKey: ['survey-ai-chat-sessions', surveyId],
    queryFn: () => getChatSessions(surveyId),
    enabled: open && Boolean(surveyId),
    staleTime: 30 * 1000,
  })

  const sessions = sessionsQuery.data ?? []
  const hasActiveSessionInList = sessions.some((session) => session.id === activeSessionId)
  const cachedActiveSession = activeSessionId
    ? queryClient.getQueryData(['survey-ai-chat-session', surveyId, activeSessionId])
    : null

  const sessionDetailQuery = useQuery({
    queryKey: ['survey-ai-chat-session', surveyId, activeSessionId],
    queryFn: () => getChatSession(surveyId, activeSessionId),
    enabled:
      open &&
      Boolean(surveyId) &&
      Boolean(activeSessionId) &&
      (hasActiveSessionInList || Boolean(cachedActiveSession)),
    staleTime: 30 * 1000,
  })

  const createSessionMutation = useMutation({
    mutationFn: () => createChatSession(surveyId),
    onSuccess: (session) => {
      setActiveSessionId(session.id)
      queryClient.setQueryData(['survey-ai-chat-session', surveyId, session.id], {
        ...buildFallbackSession(session.id, session.title),
        ...session,
        messages: [],
      })
      queryClient.invalidateQueries({ queryKey: ['survey-ai-chat-sessions', surveyId] })
    },
    onError: (error) => {
      toast({
        title: 'AI chat unavailable',
        description:
          error.response?.data?.detail ||
          error.message ||
          'Questiz could not start a new AI chat right now.',
        variant: 'error',
      })
    },
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId) => deleteChatSession(surveyId, sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.removeQueries({ queryKey: ['survey-ai-chat-session', surveyId, sessionId] })
      queryClient.invalidateQueries({ queryKey: ['survey-ai-chat-sessions', surveyId] })
      setActiveSessionId('')
      setPendingUserTurn(null)
      toast({
        title: 'Chat removed',
        description: 'The AI conversation was deleted for this survey.',
        variant: 'success',
      })
    },
    onError: (error) => {
      toast({
        title: 'Delete failed',
        description:
          error.response?.data?.detail ||
          error.message ||
          'Questiz could not delete this AI chat right now.',
        variant: 'error',
      })
    },
  })

  const sendMessageMutation = useMutation({
    mutationFn: async ({ sessionId, message, optimisticUserMessage }) => {
      const assistantMessage = await sendChatMessage(surveyId, sessionId, message, filters)
      return { assistantMessage, sessionId, optimisticUserMessage }
    },
    onSuccess: ({ assistantMessage, sessionId, optimisticUserMessage }) => {
      queryClient.setQueryData(
        ['survey-ai-chat-session', surveyId, sessionId],
        (current) => {
          const fallback = buildFallbackSession(sessionId)
          const next = current ? { ...current } : fallback
          const existingMessages = [...(next.messages || [])]

          if (
            optimisticUserMessage &&
            !existingMessages.some(
              (message) =>
                message.role === 'user' &&
                message.content === optimisticUserMessage.content &&
                message.created_at === optimisticUserMessage.created_at
            )
          ) {
            existingMessages.push(optimisticUserMessage)
          }

          existingMessages.push(assistantMessage)
          next.messages = existingMessages
          next.updated_at = assistantMessage.created_at
          return next
        }
      )

      setPendingUserTurn(null)
      queryClient.invalidateQueries({ queryKey: ['survey-ai-chat-sessions', surveyId] })
      queryClient.invalidateQueries({
        queryKey: ['survey-ai-chat-session', surveyId, sessionId],
      })
    },
    onError: (error) => {
      setPendingUserTurn(null)
      toast({
        title: 'AI reply unavailable',
        description:
          error.response?.data?.detail ||
          error.message ||
          'Questiz could not send this question to AI right now.',
        variant: 'error',
      })
    },
  })

  useEffect(() => {
    if (
      !open ||
      !surveyId ||
      sessionsQuery.isLoading ||
      createSessionMutation.isPending ||
      !sessionsQuery.data
    ) {
      return
    }

    const sessions = sessionsQuery.data
    if (sessions.some((session) => session.id === activeSessionId)) {
      return
    }

    if (sessions.length) {
      setActiveSessionId(sessions[0].id)
      return
    }

    if (!autoCreateAttempted) {
      setAutoCreateAttempted(true)
      createSessionMutation.mutate()
    }
  }, [
    activeSessionId,
    autoCreateAttempted,
    createSessionMutation,
    open,
    sessions,
    sessionsQuery.isLoading,
    surveyId,
  ])

  useEffect(() => {
    if (
      !sessionsQuery.error ||
      sessionsQuery.errorUpdatedAt === sessionsErrorHandledAtRef.current
    ) {
      return
    }

    sessionsErrorHandledAtRef.current = sessionsQuery.errorUpdatedAt
    toast({
      title: 'AI chat unavailable',
      description:
        sessionsQuery.error?.response?.data?.detail ||
        sessionsQuery.error?.message ||
        'Questiz could not load the AI chat sessions right now.',
      variant: 'error',
    })
  }, [sessionsQuery.error, sessionsQuery.errorUpdatedAt, toast])

  useEffect(() => {
    if (
      !sessionDetailQuery.error ||
      sessionDetailQuery.errorUpdatedAt === sessionDetailErrorHandledAtRef.current
    ) {
      return
    }

    sessionDetailErrorHandledAtRef.current = sessionDetailQuery.errorUpdatedAt
    if (sessionDetailQuery.error?.response?.status === 404) {
      queryClient.removeQueries({
        queryKey: ['survey-ai-chat-session', surveyId, activeSessionId],
      })
      setActiveSessionId('')
      return
    }

    toast({
      title: 'Conversation unavailable',
      description:
        sessionDetailQuery.error?.response?.data?.detail ||
        sessionDetailQuery.error?.message ||
        'Questiz could not load the selected AI conversation.',
      variant: 'error',
    })
  }, [
    activeSessionId,
    queryClient,
    sessionDetailQuery.error,
    sessionDetailQuery.errorUpdatedAt,
    surveyId,
    toast,
  ])

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) || sessionDetailQuery.data || null

  const displayedMessages = useMemo(() => {
    const baseMessages = sessionDetailQuery.data?.messages ?? []
    if (pendingUserTurn && sendMessageMutation.isPending) {
      return [
        ...baseMessages,
        pendingUserTurn,
        {
          id: 'pending-assistant',
          role: 'assistant',
          content: '',
          context_meta: pendingUserTurn.context_meta,
          created_at: pendingUserTurn.created_at,
          isPendingAssistant: true,
        },
      ]
    }
    return baseMessages
  }, [pendingUserTurn, sendMessageMutation.isPending, sessionDetailQuery.data?.messages])

  useEffect(() => {
    if (!open) {
      return
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: sendMessageMutation.isPending ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [displayedMessages.length, open, sendMessageMutation.isPending])

  const handleNewChat = async () => {
    setPendingUserTurn(null)
    setDraft('')
    setAutoCreateAttempted(true)
    try {
      await createSessionMutation.mutateAsync()
    } catch {
      return
    }
  }

  const handleDeleteCurrentChat = () => {
    if (!activeSessionId) {
      return
    }

    if (!window.confirm('Delete this AI conversation?')) {
      return
    }

    deleteSessionMutation.mutate(activeSessionId)
  }

  const handleSendMessage = async () => {
    const trimmed = draft.trim()
    if (!trimmed || sendMessageMutation.isPending || createSessionMutation.isPending) {
      return
    }

    let sessionId = activeSessionId
    if (!sessionId) {
      let session
      try {
        session = await createSessionMutation.mutateAsync()
      } catch {
        return
      }
      sessionId = session.id
    }

    const optimisticUserMessage = {
      id: `pending-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      context_meta: buildOptimisticScope(filters),
      created_at: new Date().toISOString(),
    }

    setDraft('')
    setPendingUserTurn(optimisticUserMessage)
    sendMessageMutation.mutate({
      sessionId,
      message: trimmed,
      optimisticUserMessage,
    })
  }

  const sessionOptions = useMemo(() => buildSessionOptions(sessions), [sessions])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-opacity duration-300',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-[rgb(var(--theme-foreground-rgb)/0.16)] backdrop-blur-[1px] transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={() => onOpenChange(false)}
      />

      <aside
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-[420px] translate-x-full transform flex-col border-l border-[rgb(var(--theme-border-rgb)/0.82)] bg-white shadow-[0_26px_70px_rgb(var(--theme-shadow-rgb)/0.22)] transition-transform duration-300',
          'md:max-w-[420px]',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--theme-border-rgb)/0.72)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgb(var(--theme-primary-rgb)/0.32)] bg-[rgb(var(--theme-primary-soft-rgb)/0.2)] text-[rgb(var(--theme-primary-ink-rgb))]">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  AI Insights
                </p>
                <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  Analytics chat
                </h2>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {surveyTitle || 'Survey'} · New replies use your current Analyze filters.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-2xl"
            onClick={() => onOpenChange(false)}
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 border-b border-[rgb(var(--theme-border-rgb)/0.72)] px-5 py-4">
          <div className="flex items-center gap-2">
            <CustomSelect
              value={activeSessionId}
              onChange={setActiveSessionId}
              options={sessionOptions}
              placeholder={sessionsQuery.isLoading ? 'Loading chats...' : 'Select a chat'}
              disabled={sessionsQuery.isLoading || createSessionMutation.isPending}
              triggerClassName="h-10 flex-1 rounded-[1rem]"
              contentClassName="rounded-[1.2rem]"
              align="end"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-[1rem]"
              onClick={handleNewChat}
              disabled={createSessionMutation.isPending}
            >
              {createSessionMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-[1rem]"
              onClick={handleDeleteCurrentChat}
              disabled={!activeSessionId || deleteSessionMutation.isPending}
            >
              {deleteSessionMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{filtersActive ? 'Filtered context' : 'All responses'}</Badge>
            <Badge variant="secondary">Owner-only AI workspace</Badge>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {sessionDetailQuery.isLoading && !displayedMessages.length ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-[85%] rounded-[1.5rem]" />
                <Skeleton className="ml-auto h-20 w-[72%] rounded-[1.5rem]" />
                <Skeleton className="h-24 w-[92%] rounded-[1.5rem]" />
              </div>
            ) : displayedMessages.length ? (
              <div className="space-y-4">
                {displayedMessages.map((message) => {
                  const isUser = message.role === 'user'
                  const showScope = isUser && message.context_meta?.scope_label

                  return (
                    <div
                      key={message.id}
                      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[92%] rounded-[1.65rem] border px-4 py-3 shadow-sm',
                          isUser
                            ? 'border-[rgb(var(--theme-primary-rgb)/0.3)] bg-[rgb(var(--theme-primary-soft-rgb)/0.18)] text-[rgb(var(--theme-primary-ink-rgb))]'
                            : 'border-[rgb(var(--theme-border-rgb)/0.82)] bg-white text-foreground'
                        )}
                      >
                        {message.isPendingAssistant ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Thinking through your survey data...
                          </div>
                        ) : isUser ? (
                          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                        ) : (
                          <SafeMarkdown content={message.content} />
                        )}

                        {showScope ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                              {message.context_meta.scope_label}
                            </Badge>
                            {message.context_meta?.total_responses ? (
                              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                {message.context_meta.total_responses} responses
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-[rgb(var(--theme-border-rgb)/0.76)] bg-[rgb(var(--theme-neutral-rgb)/0.5)] px-6 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgb(var(--theme-primary-rgb)/0.28)] bg-white text-[rgb(var(--theme-primary-ink-rgb))]">
                  <WandSparkles className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
                  Ask follow-up questions about this survey
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Questiz will answer from the current filtered analytics and selected masked verbatims,
                  not from guesses outside the dataset.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-[rgb(var(--theme-border-rgb)/0.72)] px-5 py-4">
            <div className="rounded-[1.6rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[rgb(var(--theme-neutral-rgb)/0.24)] p-3">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Ask about patterns, contradictions, risks, segments, or standout respondent language..."
                className="min-h-[116px] border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={sendMessageMutation.isPending}
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Press <span className="font-semibold text-foreground">Enter</span> to send.
                  Use <span className="font-semibold text-foreground">Shift + Enter</span> for a new line.
                </p>
                <Button
                  type="button"
                  className="rounded-[1rem]"
                  onClick={handleSendMessage}
                  disabled={!draft.trim() || sendMessageMutation.isPending || createSessionMutation.isPending}
                >
                  {sendMessageMutation.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizontal className="mr-2 h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
