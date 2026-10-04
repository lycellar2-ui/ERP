'use client'

import { useState, useEffect, useCallback } from 'react'

export type AppLocale = 'vi' | 'en'

export const APP_LOCALE_STORAGE_KEY = 'erp_locale'
export const APP_LOCALE_CHANGE_EVENT = 'erp_locale_change'
export const LEGACY_VISIT_LOCALE_KEY = 'sales_visits_locale'
export const LEGACY_VISIT_EVENT = 'sales_visits_locale_change'

/**
 * Get current application locale from localStorage (default 'vi')
 */
export function getAppLocale(): AppLocale {
    if (typeof window === 'undefined') return 'vi'
    try {
        const saved = localStorage.getItem(APP_LOCALE_STORAGE_KEY) || localStorage.getItem(LEGACY_VISIT_LOCALE_KEY)
        if (saved === 'en' || saved === 'vi') return saved
    } catch {
        // Ignore localStorage access errors
    }
    return 'vi'
}

/**
 * Set application locale in localStorage and dispatch synchronization events
 */
export function setAppLocale(locale: AppLocale) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale)
        localStorage.setItem(LEGACY_VISIT_LOCALE_KEY, locale)
        
        // Dispatch both events for full cross-module consistency
        window.dispatchEvent(new CustomEvent(APP_LOCALE_CHANGE_EVENT, { detail: locale }))
        window.dispatchEvent(new CustomEvent(LEGACY_VISIT_EVENT, { detail: locale }))
    } catch {
        // Ignore localStorage access errors
    }
}

/**
 * React hook to reactively read and change application locale
 */
export function useAppLocale() {
    const [locale, setLocaleState] = useState<AppLocale>('vi')

    useEffect(() => {
        setLocaleState(getAppLocale())

        const handleLocaleChange = (e: Event) => {
            const customEvent = e as CustomEvent<AppLocale>
            if (customEvent.detail && (customEvent.detail === 'vi' || customEvent.detail === 'en')) {
                setLocaleState(customEvent.detail)
            } else {
                setLocaleState(getAppLocale())
            }
        }

        const handleStorage = (e: StorageEvent) => {
            if ((e.key === APP_LOCALE_STORAGE_KEY || e.key === LEGACY_VISIT_LOCALE_KEY) && (e.newValue === 'vi' || e.newValue === 'en')) {
                setLocaleState(e.newValue as AppLocale)
            }
        }

        window.addEventListener(APP_LOCALE_CHANGE_EVENT, handleLocaleChange)
        window.addEventListener(LEGACY_VISIT_EVENT, handleLocaleChange)
        window.addEventListener('storage', handleStorage)

        return () => {
            window.removeEventListener(APP_LOCALE_CHANGE_EVENT, handleLocaleChange)
            window.removeEventListener(LEGACY_VISIT_EVENT, handleLocaleChange)
            window.removeEventListener('storage', handleStorage)
        }
    }, [])

    const setLocale = useCallback((newLocale: AppLocale) => {
        setLocaleState(newLocale)
        setAppLocale(newLocale)
    }, [])

    const toggleLocale = useCallback(() => {
        const next = locale === 'vi' ? 'en' : 'vi'
        setLocale(next)
    }, [locale, setLocale])

    return {
        locale,
        setLocale,
        toggleLocale,
        isEn: locale === 'en',
        isVi: locale === 'vi',
    }
}
