import { describe, it, expect } from 'vitest'
import { getPageNumbers } from '@/lib/ui/pagination'

describe('getPageNumbers', () => {
    it('lists all pages when few', () => {
        expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5])
        expect(getPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('adds ellipses around the current page', () => {
        expect(getPageNumbers(10, 20)).toEqual([1, '...', 9, 10, 11, '...', 20])
    })

    it('omits leading ellipsis near the start', () => {
        expect(getPageNumbers(2, 20)).toEqual([1, 2, 3, '...', 20])
    })

    it('omits trailing ellipsis near the end', () => {
        expect(getPageNumbers(19, 20)).toEqual([1, '...', 18, 19, 20])
    })
})
