'use client'

export function PrintButton() {
    return (
        <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-lys-teal-strong hover:bg-lys-teal-hover active:scale-[0.98] transition-all cursor-pointer px-4 py-2 text-sm font-semibold text-white"
        >
            In / Lưu PDF
        </button>
    )
}
