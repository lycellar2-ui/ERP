/** Page list with ellipses, e.g. [1, '...', 4, 5, 6, '...', 20]. */
export function getPageNumbers(page: number, totalPages: number, siblings = 1): (number | '...')[] {
    if (totalPages <= 5 + siblings * 2) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const start = Math.max(2, page - siblings)
    const end = Math.min(totalPages - 1, page + siblings)
    const pages: (number | '...')[] = [1]
    if (start > 2) pages.push('...')
    for (let p = start; p <= end; p++) pages.push(p)
    if (end < totalPages - 1) pages.push('...')
    pages.push(totalPages)
    return pages
}
