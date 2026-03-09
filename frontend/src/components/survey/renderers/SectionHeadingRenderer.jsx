export default function SectionHeadingRenderer({ question }) {
  return (
    <div className="survey-theme-structural px-6 py-5">
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{question.text}</h3>
      {question.description ? (
        <p className="survey-theme-muted mt-2 text-sm">{question.description}</p>
      ) : null}
    </div>
  )
}
