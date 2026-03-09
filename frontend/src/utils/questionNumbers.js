export const STRUCTURAL_QUESTION_TYPES = new Set([
  'section_heading',
  'instructional_text',
])

export function isStructuralQuestion(question) {
  return STRUCTURAL_QUESTION_TYPES.has(question?.question_type)
}

export function buildQuestionNumberLookup(pages = []) {
  let nextNumber = 1
  const lookup = {}

  pages.forEach((page) => {
    const questions = page.questions ?? []

    questions.forEach((question) => {
      if (isStructuralQuestion(question)) {
        return
      }

      lookup[question.id] = nextNumber
      nextNumber += 1
    })
  })

  return lookup
}
