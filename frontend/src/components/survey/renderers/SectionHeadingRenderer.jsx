export default function SectionHeadingRenderer({ question }) {
  return (
    <div className="rounded-3xl bg-slate-100 px-6 py-5">
      <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{question.text}</h3>
      {question.description ? (
        <p className="mt-2 text-sm text-slate-600">{question.description}</p>
      ) : null}
    </div>
  )
}

