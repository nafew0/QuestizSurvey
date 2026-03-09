export default function InstructionalTextRenderer({ question }) {
  return (
    <div className="survey-theme-structural px-6 py-5">
      <p className="text-sm leading-6 text-foreground">{question.text}</p>
      {question.description ? (
        <p className="survey-theme-muted mt-3 text-xs leading-5">{question.description}</p>
      ) : null}
    </div>
  )
}
