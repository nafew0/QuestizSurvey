import { useCallback, useEffect, useRef, useState } from 'react'

import { useToast } from '@/hooks/useToast'
import {
  closeSurvey,
  createPage,
  createQuestion,
  deletePage,
  deleteQuestion,
  fetchSurvey,
  publishSurvey,
  reorderPages,
  reorderQuestions,
  updatePage,
  updateQuestion,
  updateSurvey,
} from '@/services/surveys'
import {
  buildPageReorderPayload,
  buildQuestionReorderPayload,
  createClientUuid,
  createPageDraft,
  createQuestionDraft,
  deepClone,
  findQuestionLocation,
  getPagePayload,
  getQuestionPayload,
  moveArrayItem,
  normalizeSurvey,
  reindexPages,
  reindexQuestions,
} from '@/utils/surveyBuilder'

function useLatestRef(value) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

export function useSurveyBuilder(surveyId) {
  const { toast } = useToast()
  const [survey, setSurvey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingState, setSavingState] = useState({
    survey: false,
    pages: {},
    questions: {},
  })
  const [selectedQuestionId, setSelectedQuestionId] = useState(null)
  const [selectedPageId, setSelectedPageId] = useState(null)

  const surveyRef = useLatestRef(survey)
  const surveySaveTimeout = useRef(null)
  const pageSaveTimeouts = useRef(new Map())
  const questionSaveTimeouts = useRef(new Map())

  const loadSurvey = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const nextSurvey = normalizeSurvey(await fetchSurvey(surveyId))
      setSurvey(nextSurvey)
      setSelectedPageId((current) => current ?? nextSurvey.pages?.[0]?.id ?? null)
      setSelectedQuestionId((current) => {
        if (!current) {
          return null
        }

        const exists = nextSurvey.pages.some((page) =>
          page.questions.some((question) => question.id === current)
        )
        return exists ? current : null
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load the survey builder.')
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    loadSurvey()
  }, [loadSurvey])

  useEffect(() => {
    const pageTimeoutMap = pageSaveTimeouts.current
    const questionTimeoutMap = questionSaveTimeouts.current

    return () => {
      if (surveySaveTimeout.current) {
        clearTimeout(surveySaveTimeout.current)
      }

      pageTimeoutMap.forEach((timeoutId) => clearTimeout(timeoutId))
      questionTimeoutMap.forEach((timeoutId) => clearTimeout(timeoutId))
    }
  }, [])

  const updateLocalSurvey = useCallback((updater) => {
    setSurvey((current) => {
      if (!current) {
        return current
      }

      const nextSurvey = typeof updater === 'function' ? updater(current) : updater
      return nextSurvey
    })
  }, [])

  const scheduleSurveySave = useCallback(() => {
    if (surveySaveTimeout.current) {
      clearTimeout(surveySaveTimeout.current)
    }

    setSavingState((current) => ({
      ...current,
      survey: true,
    }))

    surveySaveTimeout.current = window.setTimeout(async () => {
      const currentSurvey = surveyRef.current
      if (!currentSurvey) {
        return
      }

      try {
        const updatedSurvey = await updateSurvey(currentSurvey.id, {
          title: currentSurvey.title,
          description: currentSurvey.description,
          theme: currentSurvey.theme ?? {},
          settings: currentSurvey.settings ?? {},
          welcome_page: currentSurvey.welcome_page ?? {},
          thank_you_page: currentSurvey.thank_you_page ?? {},
        })

        setSurvey((existing) => normalizeSurvey({ ...existing, ...updatedSurvey }))
      } catch (err) {
        toast({
          title: 'Survey save failed',
          description: err.response?.data?.detail || 'Check the API and try again.',
          variant: 'error',
        })
      } finally {
        setSavingState((current) => ({
          ...current,
          survey: false,
        }))
      }
    }, 700)
  }, [surveyRef, toast])

  const schedulePageSave = useCallback(
    (pageId) => {
      const existingTimeout = pageSaveTimeouts.current.get(pageId)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      setSavingState((current) => ({
        ...current,
        pages: {
          ...current.pages,
          [pageId]: true,
        },
      }))

      const timeoutId = window.setTimeout(async () => {
        const currentSurvey = surveyRef.current
        const page = currentSurvey?.pages.find((item) => item.id === pageId)

        if (!currentSurvey || !page) {
          return
        }

        try {
          await updatePage(currentSurvey.id, page.id, getPagePayload(page))
        } catch (err) {
          toast({
            title: 'Page save failed',
            description: err.response?.data?.detail || 'Please retry this change.',
            variant: 'error',
          })
        } finally {
          setSavingState((current) => ({
            ...current,
            pages: {
              ...current.pages,
              [pageId]: false,
            },
          }))
        }
      }, 700)

      pageSaveTimeouts.current.set(pageId, timeoutId)
    },
    [surveyRef, toast]
  )

  const scheduleQuestionSave = useCallback(
    (questionId) => {
      const existingTimeout = questionSaveTimeouts.current.get(questionId)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      setSavingState((current) => ({
        ...current,
        questions: {
          ...current.questions,
          [questionId]: true,
        },
      }))

      const timeoutId = window.setTimeout(async () => {
        const currentSurvey = surveyRef.current
        const location = currentSurvey ? findQuestionLocation(currentSurvey.pages, questionId) : null

        if (!currentSurvey || !location) {
          return
        }

        try {
          await updateQuestion(
            currentSurvey.id,
            location.page.id,
            location.question.id,
            getQuestionPayload(location.question)
          )
        } catch (err) {
          toast({
            title: 'Question save failed',
            description: err.response?.data?.detail || 'Please retry this change.',
            variant: 'error',
          })
        } finally {
          setSavingState((current) => ({
            ...current,
            questions: {
              ...current.questions,
              [questionId]: false,
            },
          }))
        }
      }, 700)

      questionSaveTimeouts.current.set(questionId, timeoutId)
    },
    [surveyRef, toast]
  )

  const updateSurveyField = useCallback(
    (field, value) => {
      updateLocalSurvey((current) => ({
        ...current,
        [field]: value,
      }))
      scheduleSurveySave()
    },
    [scheduleSurveySave, updateLocalSurvey]
  )

  const updatePageField = useCallback(
    (pageId, field, value) => {
      updateLocalSurvey((current) => ({
        ...current,
        pages: current.pages.map((page) =>
          page.id === pageId
            ? {
                ...page,
                [field]: value,
              }
            : page
        ),
      }))
      schedulePageSave(pageId)
    },
    [schedulePageSave, updateLocalSurvey]
  )

  const updateQuestionField = useCallback(
    (questionId, field, value) => {
      updateLocalSurvey((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          questions: page.questions.map((question) =>
            question.id === questionId
              ? {
                  ...question,
                  [field]: value,
                }
              : question
          ),
        })),
      }))
      scheduleQuestionSave(questionId)
    },
    [scheduleQuestionSave, updateLocalSurvey]
  )

  const updateChoiceField = useCallback(
    (questionId, choiceIndex, field, value) => {
      updateLocalSurvey((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          questions: page.questions.map((question) => {
            if (question.id !== questionId) {
              return question
            }

            const nextChoices = [...(question.choices ?? [])]
            nextChoices[choiceIndex] = {
              ...nextChoices[choiceIndex],
              [field]: value,
            }

            return {
              ...question,
              choices: reindexQuestions([{ ...question, choices: nextChoices }])[0].choices,
            }
          }),
        })),
      }))
      scheduleQuestionSave(questionId)
    },
    [scheduleQuestionSave, updateLocalSurvey]
  )

  const addChoice = useCallback(
    (questionId) => {
      updateLocalSurvey((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          questions: page.questions.map((question) => {
            if (question.id !== questionId) {
              return question
            }

            const nextChoices = [
              ...(question.choices ?? []),
              {
                id: createClientUuid(),
                text: `Option ${(question.choices?.length ?? 0) + 1}`,
                order: (question.choices?.length ?? 0) + 1,
                image_url: '',
                is_other: false,
              },
            ]

            return {
              ...question,
              choices: nextChoices,
            }
          }),
        })),
      }))
      scheduleQuestionSave(questionId)
    },
    [scheduleQuestionSave, updateLocalSurvey]
  )

  const removeChoice = useCallback(
    (questionId, choiceIndex) => {
      updateLocalSurvey((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          questions: page.questions.map((question) => {
            if (question.id !== questionId) {
              return question
            }

            return {
              ...question,
              choices: (question.choices ?? [])
                .filter((_, index) => index !== choiceIndex)
                .map((choice, index) => ({
                  ...choice,
                  order: index + 1,
                })),
            }
          }),
        })),
      }))
      scheduleQuestionSave(questionId)
    },
    [scheduleQuestionSave, updateLocalSurvey]
  )

  const moveChoice = useCallback(
    (questionId, fromIndex, toIndex) => {
      updateLocalSurvey((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          questions: page.questions.map((question) => {
            if (question.id !== questionId) {
              return question
            }

            return {
              ...question,
              choices: moveArrayItem(question.choices ?? [], fromIndex, toIndex).map(
                (choice, index) => ({
                  ...choice,
                  order: index + 1,
                })
              ),
            }
          }),
        })),
      }))
      scheduleQuestionSave(questionId)
    },
    [scheduleQuestionSave, updateLocalSurvey]
  )

  const createNewPage = useCallback(
    async (afterPageId = null) => {
      const currentSurvey = surveyRef.current
      if (!currentSurvey) {
        return
      }

      const createdPage = await createPage(
        currentSurvey.id,
        createPageDraft((currentSurvey.pages?.length ?? 0) + 1)
      )

      const createdPageId = createdPage.id
      let nextPages = [...currentSurvey.pages, normalizeSurvey({ pages: [createdPage] }).pages[0]]

      if (afterPageId) {
        const targetIndex = currentSurvey.pages.findIndex((page) => page.id === afterPageId)
        nextPages = nextPages.filter((page) => page.id !== createdPageId)
        nextPages.splice(targetIndex + 1, 0, normalizeSurvey({ pages: [createdPage] }).pages[0])
      }

      nextPages = reindexPages(nextPages)
      await reorderPages(currentSurvey.id, buildPageReorderPayload(nextPages))
      await loadSurvey()
      setSelectedPageId(createdPageId)
      toast({
        title: 'Page added',
        description: 'A new page is ready for questions.',
        variant: 'success',
      })
    },
    [loadSurvey, surveyRef, toast]
  )

  const removePage = useCallback(
    async (pageId) => {
      const currentSurvey = surveyRef.current
      if (!currentSurvey) {
        return
      }

      await deletePage(currentSurvey.id, pageId)

      const nextPages = reindexPages(currentSurvey.pages.filter((page) => page.id !== pageId))
      if (nextPages.length > 0) {
        await reorderPages(currentSurvey.id, buildPageReorderPayload(nextPages))
      }

      await loadSurvey()
      setSelectedPageId((current) => (current === pageId ? nextPages[0]?.id ?? null : current))
      setSelectedQuestionId(null)
      toast({
        title: 'Page removed',
        description: 'The page and its questions were deleted.',
        variant: 'warning',
      })
    },
    [loadSurvey, surveyRef, toast]
  )

  const movePage = useCallback(
    async (pageId, toIndex) => {
      const currentSurvey = surveyRef.current
      if (!currentSurvey) {
        return
      }

      const fromIndex = currentSurvey.pages.findIndex((page) => page.id === pageId)
      if (fromIndex < 0 || fromIndex === toIndex) {
        return
      }

      const nextPages = reindexPages(moveArrayItem(currentSurvey.pages, fromIndex, toIndex))
      await reorderPages(currentSurvey.id, buildPageReorderPayload(nextPages))
      await loadSurvey()
    },
    [loadSurvey, surveyRef]
  )

  const syncQuestionOrder = useCallback(
    async (nextPages, routePageId) => {
      const currentSurvey = surveyRef.current
      if (!currentSurvey) {
        return
      }

      await reorderQuestions(
        currentSurvey.id,
        routePageId,
        buildQuestionReorderPayload(nextPages)
      )
      await loadSurvey()
    },
    [loadSurvey, surveyRef]
  )

  const createNewQuestion = useCallback(
    async (pageId, questionType, targetIndex = null) => {
      const currentSurvey = surveyRef.current
      if (!currentSurvey) {
        return
      }

      const page = currentSurvey.pages.find((item) => item.id === pageId)
      if (!page) {
        return
      }

      const createdQuestion = await createQuestion(currentSurvey.id, pageId, {
        ...createQuestionDraft(questionType),
        order: page.questions.length + 1,
      })

      if (targetIndex == null || targetIndex >= page.questions.length) {
        await loadSurvey()
        setSelectedQuestionId(createdQuestion.id)
        setSelectedPageId(pageId)
        return
      }

      const nextPages = currentSurvey.pages.map((currentPage) => {
        if (currentPage.id !== pageId) {
          return currentPage
        }

        const nextQuestions = [...currentPage.questions]
        nextQuestions.splice(targetIndex, 0, {
          ...createdQuestion,
          settings: createdQuestion.settings ?? {},
          skip_logic: createdQuestion.skip_logic ?? [],
          choices: createdQuestion.choices ?? [],
        })

        return {
          ...currentPage,
          questions: reindexQuestions(nextQuestions),
        }
      })

      await syncQuestionOrder(nextPages, pageId)
      setSelectedQuestionId(createdQuestion.id)
      setSelectedPageId(pageId)
    },
    [loadSurvey, surveyRef, syncQuestionOrder]
  )

  const removeQuestion = useCallback(
    async (questionId) => {
      const currentSurvey = surveyRef.current
      const location = currentSurvey ? findQuestionLocation(currentSurvey.pages, questionId) : null

      if (!currentSurvey || !location) {
        return
      }

      await deleteQuestion(currentSurvey.id, location.page.id, location.question.id)

      const nextPages = currentSurvey.pages.map((page) => {
        if (page.id !== location.page.id) {
          return page
        }

        return {
          ...page,
          questions: reindexQuestions(
            page.questions.filter((question) => question.id !== questionId)
          ),
        }
      })

      await syncQuestionOrder(nextPages, location.page.id)
      setSelectedQuestionId(null)
    },
    [surveyRef, syncQuestionOrder]
  )

  const duplicateQuestionById = useCallback(
    async (questionId) => {
      const currentSurvey = surveyRef.current
      const location = currentSurvey ? findQuestionLocation(currentSurvey.pages, questionId) : null

      if (!currentSurvey || !location) {
        return
      }

      const createdQuestion = await createQuestion(currentSurvey.id, location.page.id, {
        ...getQuestionPayload({
          ...deepClone(location.question),
          text: `${location.question.text} (Copy)`,
        }),
        order: location.page.questions.length + 1,
      })

      const nextPages = currentSurvey.pages.map((page) => {
        if (page.id !== location.page.id) {
          return page
        }

        const nextQuestions = [...page.questions]
        nextQuestions.splice(location.questionIndex + 1, 0, createdQuestion)

        return {
          ...page,
          questions: reindexQuestions(nextQuestions),
        }
      })

      await syncQuestionOrder(nextPages, location.page.id)
      setSelectedQuestionId(createdQuestion.id)
      toast({
        title: 'Question duplicated',
        description: 'The new copy is inserted right after the original.',
        variant: 'success',
      })
    },
    [surveyRef, syncQuestionOrder, toast]
  )

  const moveQuestion = useCallback(
    async (questionId, targetPageId, targetIndex) => {
      const currentSurvey = surveyRef.current
      const location = currentSurvey ? findQuestionLocation(currentSurvey.pages, questionId) : null

      if (!currentSurvey || !location) {
        return
      }

      let draggedQuestion = null
      const nextPages = currentSurvey.pages.map((page) => {
        if (page.id === location.page.id) {
          const remainingQuestions = page.questions.filter((question) => {
            if (question.id === questionId) {
              draggedQuestion = question
              return false
            }
            return true
          })

          return {
            ...page,
            questions: reindexQuestions(remainingQuestions),
          }
        }

        return page
      })

      if (!draggedQuestion) {
        return
      }

      const adjustedTargetIndex =
        location.page.id === targetPageId && location.questionIndex < targetIndex
          ? targetIndex - 1
          : targetIndex

      const updatedPages = nextPages.map((page) => {
        if (page.id !== targetPageId) {
          return page
        }

        const nextQuestions = [...page.questions]
        nextQuestions.splice(adjustedTargetIndex, 0, draggedQuestion)
        return {
          ...page,
          questions: reindexQuestions(nextQuestions),
        }
      })

      await syncQuestionOrder(updatedPages, targetPageId)
      setSelectedQuestionId(questionId)
      setSelectedPageId(targetPageId)
    },
    [surveyRef, syncQuestionOrder]
  )

  const updateSelectedQuestionSettings = useCallback(
    (field, value) => {
      if (!selectedQuestionId) {
        return
      }
      updateQuestionField(selectedQuestionId, field, value)
    },
    [selectedQuestionId, updateQuestionField]
  )

  const publishCurrentSurvey = useCallback(async () => {
    const currentSurvey = surveyRef.current
    if (!currentSurvey) {
      return
    }

    const nextSurvey = await publishSurvey(currentSurvey.id)
    setSurvey(normalizeSurvey(nextSurvey))
    toast({
      title: 'Survey published',
      description: 'Your survey is now live for public responses.',
      variant: 'success',
    })
  }, [surveyRef, toast])

  const closeCurrentSurvey = useCallback(async () => {
    const currentSurvey = surveyRef.current
    if (!currentSurvey) {
      return
    }

    const nextSurvey = await closeSurvey(currentSurvey.id)
    setSurvey(normalizeSurvey(nextSurvey))
    toast({
      title: 'Survey closed',
      description: 'Respondents can no longer submit responses.',
      variant: 'warning',
    })
  }, [surveyRef, toast])

  const selectedQuestion = survey
    ? findQuestionLocation(survey.pages, selectedQuestionId)?.question ?? null
    : null
  const selectedPage =
    survey?.pages.find((page) => page.id === selectedPageId) ??
    (selectedQuestion ? findQuestionLocation(survey.pages, selectedQuestion.id)?.page ?? null : null)

  return {
    survey,
    loading,
    error,
    savingState,
    selectedQuestionId,
    selectedQuestion,
    selectedPageId,
    selectedPage,
    setSelectedQuestionId,
    setSelectedPageId,
    reloadSurvey: loadSurvey,
    updateSurveyField,
    updatePageField,
    updateQuestionField,
    updateChoiceField,
    addChoice,
    removeChoice,
    moveChoice,
    createNewPage,
    removePage,
    movePage,
    createNewQuestion,
    removeQuestion,
    duplicateQuestionById,
    moveQuestion,
    updateSelectedQuestionSettings,
    publishCurrentSurvey,
    closeCurrentSurvey,
  }
}
