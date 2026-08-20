'use client'

import React, { useState, useEffect, useRef, memo, forwardRef, useImperativeHandle } from 'react'

export interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
    value: string
    onChange: (value: string) => void
    debounceMs?: number
}

/**
 * High-performance textarea with local state isolation and debounced sync.
 * Eliminates input lag and typing delays in large forms and drawers by decoupling
 * keypress rendering from parent component re-renders.
 */
export const DebouncedTextarea = memo(forwardRef<HTMLTextAreaElement, DebouncedTextareaProps>(
    function DebouncedTextarea({ value: externalValue, onChange, debounceMs = 150, onBlur, ...rest }, ref) {
        const [localValue, setLocalValue] = useState(externalValue ?? '')
        const internalRef = useRef<HTMLTextAreaElement | null>(null)
        const timeoutRef = useRef<NodeJS.Timeout | null>(null)
        const latestValRef = useRef(externalValue ?? '')

        useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement)

        // Sync local value when external value changes programmatically
        useEffect(() => {
            setLocalValue(externalValue ?? '')
            latestValRef.current = externalValue ?? ''
        }, [externalValue])

        // Cleanup timer on unmount
        useEffect(() => {
            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current)
                }
            }
        }, [])

        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const nextVal = e.target.value
            latestValRef.current = nextVal
            setLocalValue(nextVal) // Instant 0ms response for smooth typing & Vietnamese IME

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
            timeoutRef.current = setTimeout(() => {
                onChange(nextVal)
            }, debounceMs)
        }

        const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
            // Immediately commit the latest value to parent on blur
            if (latestValRef.current !== externalValue) {
                onChange(latestValRef.current)
            }
            onBlur?.(e)
        }

        return (
            <textarea
                ref={internalRef}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                {...rest}
            />
        )
    }
))

export interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: string
    onChange: (value: string) => void
    debounceMs?: number
}

/**
 * High-performance input with local state isolation and debounced sync.
 */
export const DebouncedInput = memo(forwardRef<HTMLInputElement, DebouncedInputProps>(
    function DebouncedInput({ value: externalValue, onChange, debounceMs = 150, onBlur, ...rest }, ref) {
        const [localValue, setLocalValue] = useState(externalValue ?? '')
        const internalRef = useRef<HTMLInputElement | null>(null)
        const timeoutRef = useRef<NodeJS.Timeout | null>(null)
        const latestValRef = useRef(externalValue ?? '')

        useImperativeHandle(ref, () => internalRef.current as HTMLInputElement)

        useEffect(() => {
            setLocalValue(externalValue ?? '')
            latestValRef.current = externalValue ?? ''
        }, [externalValue])

        useEffect(() => {
            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current)
                }
            }
        }, [])

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const nextVal = e.target.value
            latestValRef.current = nextVal
            setLocalValue(nextVal)

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
            timeoutRef.current = setTimeout(() => {
                onChange(nextVal)
            }, debounceMs)
        }

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
            if (latestValRef.current !== externalValue) {
                onChange(latestValRef.current)
            }
            onBlur?.(e)
        }

        return (
            <input
                ref={internalRef}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                {...rest}
            />
        )
    }
))
