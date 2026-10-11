export default function SopLoading() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse p-4 md:p-6">
            {/* Header skeleton */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-2">
                    <div className="h-8 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="h-10 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>

            {/* Quick stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-4"
                    >
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800" />
                        <div className="space-y-2 flex-1">
                            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter pills skeleton */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-full flex-shrink-0" />
                ))}
            </div>

            {/* Grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                        key={i}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                            <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
                        </div>
                        <div className="h-6 w-4/5 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="space-y-2">
                            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                            <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-800/60 rounded" />
                        </div>
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
