export default function GlobalLoader({ text = "Consultando la base de datos..." }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="dot-loader">
          <div className="dot dot-1 bg-orange-200"></div>
          <div className="dot dot-2 bg-orange-200"></div>
          <div className="dot dot-3 bg-orange-200"></div>
        </div>
        <p className="mt-4 text-slate-500 text-sm font-medium">{text}</p>
      </div>
    </div>
  )
}
