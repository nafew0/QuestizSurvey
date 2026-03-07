export default function InstructionalTextRenderer({ question }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5">
      <p className="text-sm leading-6 text-slate-700">{question.text}</p>
      {question.description ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">{question.description}</p>
      ) : null}
    </div>
  )
}
