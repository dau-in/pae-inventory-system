import { Loader2 } from 'lucide-react'

export default function GlobalLoader({ text = "Cargando..." }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-pae-peach-dark animate-spin mx-auto" />
        <p className="mt-4 text-slate-500 text-sm font-medium">{text}</p>
      </div>
    </div>
  )
}
