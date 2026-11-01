export default function Loading() {
    return (
        <div className="mx-auto max-w-xl space-y-3 p-4">
            <div className="h-8 w-40 animate-pulse rounded bg-lys-subtle" />
            <div className="h-20 animate-pulse rounded-lg bg-lys-subtle" />
            <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-lys-subtle" />)}
            </div>
        </div>
    )
}
