'use client'

import React, { useMemo } from 'react'
import { marked } from 'marked'

interface MarkdownViewerProps {
    content: string
    className?: string
}

export function MarkdownViewer({ content, className = '' }: MarkdownViewerProps) {
    const htmlContent = useMemo(() => {
        if (!content) return ''
        try {
            // Configure marked options
            return marked.parse(content, {
                gfm: true,
                breaks: true
            }) as string
        } catch (err) {
            console.error('Error parsing markdown:', err)
            return `<pre>${content}</pre>`
        }
    }, [content])

    return (
        <div
            className={`prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200
                [&_h1]:text-2xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:border-b [&_h1]:pb-3 [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-slate-900 dark:[&_h1]:text-white [&_h1]:border-slate-200 dark:[&_h1]:border-slate-800
                [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-rose-900 dark:[&_h2]:text-rose-400 [&_h2]:border-b [&_h2]:border-slate-100 dark:[&_h2]:border-slate-800/60 [&_h2]:pb-1.5
                [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-slate-900 dark:[&_h3]:text-white
                [&_h4]:text-sm [&_h4]:font-bold [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-slate-800 dark:[&_h4]:text-slate-200
                [&_p]:my-2.5 [&_p]:leading-relaxed [&_p]:text-sm
                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ul]:space-y-1.5
                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-1.5
                [&_li]:text-sm [&_li]:leading-relaxed
                [&_strong]:font-bold [&_strong]:text-slate-900 dark:[&_strong]:text-white
                [&_hr]:my-6 [&_hr]:border-slate-200 dark:[&_hr]:border-slate-800
                [&_table]:w-full [&_table]:border-collapse [&_table]:my-5 [&_table]:text-xs [&_table]:overflow-x-auto [&_table]:block [&_table]:border [&_table]:border-slate-200 dark:[&_table]:border-slate-800
                [&_thead]:bg-slate-100 dark:[&_thead]:bg-slate-800/80
                [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:p-3 [&_th]:font-bold [&_th]:text-slate-900 dark:[&_th]:text-white [&_th]:text-left
                [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-800 [&_td]:p-2.5 [&_td]:text-slate-700 dark:[&_td]:text-slate-300
                [&_blockquote]:border-l-4 [&_blockquote]:border-rose-700 [&_blockquote]:bg-rose-50/50 dark:[&_blockquote]:bg-rose-950/20 [&_blockquote]:px-4 [&_blockquote]:py-2.5 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_blockquote]:my-3
                [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-rose-700 dark:[&_code]:text-rose-400
                [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:text-slate-100 [&_pre_code]:p-0
                ${className}`}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
    )
}
