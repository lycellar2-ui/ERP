'use client'

export function PrintButton() {
    return (
        <button onClick={() => window.print()} className="rounded-lg bg-lys-teal-strong px-4 py-2.5 font-semibold text-white">
            In / Lưu PDF
        </button>
    )
}
