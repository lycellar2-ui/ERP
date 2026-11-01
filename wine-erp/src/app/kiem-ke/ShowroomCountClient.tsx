'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Minus, Plus, Search } from 'lucide-react'
import { addShowroomVintage, getShowroomCount, renameShowroomSpots, saveShowroomCount } from './actions'
import {
    buildCsv, cleanLabel, normalizeSearch, normalizeVintage, sortItems, summarize,
    type ShowroomData, type ShowroomEntry, type ShowroomItem, type ShowroomSpot,
} from './logic'

type View = 'spots' | 'count' | 'sum'
type SumMode = 'wine' | 'spot' | 'people' | 'missing' | 'posm'
const SUM_MODES: SumMode[] = ['wine', 'spot', 'people', 'missing', 'posm']

const WHO_KEY = 'kk_who'
const POLL_MS = 10_000
const SAVE_DELAY_MS = 800

const k = (spotId: string, itemId: string) => `${spotId}|${itemId}`
const fmt = (n: number) => n.toLocaleString('vi-VN')
const when = (iso: string) => {
    const t = new Date(iso)
    return `${t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${t.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
}
const unitOf = (spot?: ShowroomSpot) => (spot?.kind === 'POSM' ? ['món', 'cái'] : ['mã', 'chai'])

export function ShowroomCountClient({ initial, initialError }: { initial: ShowroomData | null; initialError: string | null }) {
    const [data, setData] = useState<ShowroomData>(initial ?? { spots: [], items: [], entries: [] })
    const [loadError, setLoadError] = useState<string | null>(initialError)
    const [who, setWho] = useState<string | null>(null)
    const [view, setView] = useState<View>('spots')
    const [spotId, setSpotId] = useState<string | null>(null)
    const [q, setQ] = useState('')
    const [filter, setFilter] = useState<'all' | 'done' | 'todo'>('all')
    const [homeQ, setHomeQ] = useState('')
    const [sumMode, setSumMode] = useState<SumMode>('wine')
    const [sumQ, setSumQ] = useState('')
    // Local edits not yet confirmed by the server; they win over polled data.
    const [overrides, setOverrides] = useState<Map<string, number | null>>(new Map())
    const [saving, setSaving] = useState<Set<string>>(new Set())
    const [errors, setErrors] = useState<Map<string, string>>(new Map())
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
    const inflight = useRef(new Set<string>())
    const latest = useRef(overrides)
    useEffect(() => { latest.current = overrides }, [overrides])
    // flush re-schedules itself while a save for the same row is in flight
    const flushRef = useRef<(sId: string, itemId: string) => void>(() => {})

    useEffect(() => {
        try { setWho(localStorage.getItem(WHO_KEY) || '') } catch { setWho('') }
        // F5 returns to the same screen: view/spot/tab live in the URL (?v=count&s=t1-1, ?v=sum&m=people)
        const p = new URLSearchParams(window.location.search)
        const v = p.get('v'), s = p.get('s'), m = p.get('m') as SumMode | null
        if (v === 'count' && s) { setSpotId(s); setView('count') }
        else if (v === 'sum') { setView('sum'); if (m && SUM_MODES.includes(m)) setSumMode(m) }
    }, [])

    useEffect(() => {
        if (who === null) return
        const p = new URLSearchParams()
        if (view === 'count' && spotId) { p.set('v', 'count'); p.set('s', spotId) }
        if (view === 'sum') { p.set('v', 'sum'); p.set('m', sumMode) }
        const qs = p.toString()
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    }, [who, view, spotId, sumMode])

    const refresh = useCallback(async () => {
        const res = await getShowroomCount()
        if (res.success && res.data) { setData(res.data); setLoadError(null) }
        else if (!res.success) setLoadError(res.error)
    }, [])

    // Poll so several people counting at once see each other's numbers.
    useEffect(() => {
        const id = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, POLL_MS)
        const onVis = () => { if (document.visibilityState === 'visible') refresh() }
        document.addEventListener('visibilitychange', onVis)
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
    }, [refresh])

    // Every person keeps their own number per spot + item; group them per cell.
    const byCell = useMemo(() => {
        const m = new Map<string, ShowroomEntry[]>()
        for (const e of data.entries) { const key = k(e.spotId, e.itemId); m.set(key, [...(m.get(key) ?? []), e]) }
        return m
    }, [data.entries])
    const mineOf = (sId: string, itemId: string) => byCell.get(k(sId, itemId))?.find(e => e.countedBy === who)
    const othersOf = (sId: string, itemId: string) => (byCell.get(k(sId, itemId)) ?? []).filter(e => e.countedBy !== who)
    const spotById = useMemo(() => new Map(data.spots.map(s => [s.id, s])), [data.spots])
    const groups = useMemo(() => {
        const out: Array<{ name: string; kind: string; spots: ShowroomSpot[] }> = []
        for (const s of data.spots) {
            let g = out.find(x => x.name === s.groupName)
            if (!g) out.push(g = { name: s.groupName, kind: s.kind, spots: [] })
            g.spots.push(s)
        }
        return out
    }, [data.spots])
    const wineItems = useMemo(() => sortItems(data.items.filter(i => i.kind !== 'POSM')), [data.items])
    const posmItems = useMemo(() => data.items.filter(i => i.kind === 'POSM').sort((a, b) => a.sortOrder - b.sortOrder), [data.items])

    const qtyOf = (sId: string, itemId: string) => {
        const key = k(sId, itemId)
        return overrides.has(key) ? overrides.get(key)! : mineOf(sId, itemId)?.qty ?? null
    }

    const flush = useCallback(async (sId: string, itemId: string) => {
        const key = k(sId, itemId)
        timers.current.delete(key)
        if (inflight.current.has(key)) { timers.current.set(key, setTimeout(() => flushRef.current(sId, itemId), 400)); return }
        if (!latest.current.has(key) || !who) return
        const qty = latest.current.get(key)!
        inflight.current.add(key)
        setSaving(s => new Set(s).add(key))
        const res = await saveShowroomCount({ spotId: sId, itemId, qty, countedBy: who })
        inflight.current.delete(key)
        setSaving(s => { const n = new Set(s); n.delete(key); return n })
        if (res.success) {
            setData(d => {
                const rest = d.entries.filter(e => !(e.spotId === sId && e.itemId === itemId && e.countedBy === who))
                const next: ShowroomEntry[] = qty === null ? rest : [...rest, { spotId: sId, itemId, qty, countedBy: who, countedAt: new Date().toISOString() }]
                return { ...d, entries: next }
            })
            // Drop the override only if nothing newer was typed meanwhile.
            setOverrides(o => {
                if (timers.current.has(key) || o.get(key) !== qty) return o
                const n = new Map(o); n.delete(key); return n
            })
        } else {
            setErrors(e => new Map(e).set(key, res.error))
        }
    }, [who])
    useEffect(() => { flushRef.current = flush }, [flush])

    const setQty = (sId: string, itemId: string, qty: number | null, delay = SAVE_DELAY_MS) => {
        const key = k(sId, itemId)
        setOverrides(o => new Map(o).set(key, qty))
        setErrors(e => { if (!e.has(key)) return e; const n = new Map(e); n.delete(key); return n })
        clearTimeout(timers.current.get(key))
        timers.current.set(key, setTimeout(() => flush(sId, itemId), delay))
    }

    const openSpot = (id: string, search = '') => {
        setSpotId(id); setQ(search); setFilter('all'); setView('count'); window.scrollTo(0, 0)
    }

    if (who === null) return null
    if (!who) return (
        <Welcome
            previous={(() => { try { return localStorage.getItem(WHO_KEY) ?? '' } catch { return '' } })()}
            onDone={name => { try { localStorage.setItem(WHO_KEY, name) } catch { /* private mode */ } setOverrides(new Map()); setWho(name) }}
        />
    )

    const summary = summarize({ ...data, entries: mergedEntries(data.entries, overrides, who) })
    const header = (title: string, eyebrow: string) => (
        <div className="mb-3 flex items-end justify-between gap-3">
            <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-lys-muted">{eyebrow}</div>
                <h1 className="mt-1 text-2xl font-extrabold text-lys-primary">{title}</h1>
            </div>
            <div className="text-right text-[13px] text-lys-muted">
                Người kiểm: <b className="text-lys-primary">{who}</b><br />
                <button className="font-semibold text-lys-teal-strong" onClick={() => setWho('')}>Đổi tên</button>
            </div>
        </div>
    )
    const errorNote = loadError && <p className="rounded-lg border border-dashed border-tone-danger-border p-3 text-sm text-tone-danger-fg">{loadError}</p>

    return (
        <div className="min-h-dvh bg-lys-bg text-lys-primary tabular-nums">
            <div className="mx-auto max-w-xl px-4 pb-28 pt-3">
                {view === 'spots' && (
                    <SpotsView
                        header={header('Chọn vị trí', 'Kiểm kê showroom · ' + new Date().toLocaleDateString('vi-VN'))}
                        errorNote={errorNote}
                        groups={groups}
                        summary={summary}
                        homeQ={homeQ}
                        setHomeQ={setHomeQ}
                        items={[...wineItems, ...posmItems]}
                        entries={mergedEntries(data.entries, overrides, who)}
                        spotById={spotById}
                        onOpen={openSpot}
                        onSummary={() => { setView('sum'); window.scrollTo(0, 0) }}
                        onRenamed={refresh}
                    />
                )}
                {view === 'count' && spotId && spotById.get(spotId) && (
                    <CountView
                        spot={spotById.get(spotId)!}
                        items={spotById.get(spotId)!.kind === 'POSM' ? posmItems : wineItems}
                        allWine={wineItems}
                        q={q} setQ={setQ} filter={filter} setFilter={setFilter}
                        qtyOf={qtyOf} setQty={setQty}
                        entryOf={(itemId: string) => mineOf(spotId, itemId)}
                        othersOf={(itemId: string) => othersOf(spotId, itemId)}
                        saving={saving} errors={errors}
                        spotSummary={summary.spots.find(s => s.spot.id === spotId)}
                        errorNote={errorNote}
                        who={who}
                        onBack={() => { setView('spots'); window.scrollTo(0, 0) }}
                        onAdded={async (code) => { await refresh(); setQ(code) }}
                    />
                )}
                {view === 'sum' && (
                    <SummaryView
                        header={header('Tổng hợp', 'Kết quả đợt kiểm')}
                        errorNote={errorNote}
                        summary={summary}
                        groups={groups}
                        mode={sumMode} setMode={setSumMode}
                        q={sumQ} setQ={setSumQ}
                        onOpen={(id) => { openSpot(id); setFilter('done') }}
                        onExport={() => downloadCsv(buildCsv({ ...data, entries: mergedEntries(data.entries, overrides, who) }))}
                    />
                )}
            </div>
            {view !== 'count' && (
                <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-lys-border bg-lys-surface pb-[env(safe-area-inset-bottom)]">
                    <div className="mx-auto flex max-w-xl">
                        {(['spots', 'sum'] as const).map(v => (
                            <button key={v} onClick={() => { setView(v); window.scrollTo(0, 0) }}
                                className={`flex-1 border-t-[3px] py-3 text-sm font-semibold ${view === v ? 'border-lys-teal-strong text-lys-teal-strong' : 'border-transparent text-lys-muted'}`}>
                                {v === 'spots' ? 'Vị trí' : 'Tổng hợp'}
                            </button>
                        ))}
                    </div>
                </nav>
            )}
        </div>
    )
}

function mergedEntries(entries: ShowroomEntry[], overrides: Map<string, number | null>, who: string): ShowroomEntry[] {
    if (!overrides.size) return entries
    // Overrides are this person's unsaved numbers; other people's rows stay untouched.
    const map = new Map(entries.map(e => [`${k(e.spotId, e.itemId)}|${e.countedBy}`, e]))
    for (const [key, qty] of overrides) {
        const [spotId, itemId] = key.split('|')
        const mine = `${key}|${who}`
        if (qty === null) map.delete(mine)
        else map.set(mine, { spotId, itemId, qty, countedBy: who, countedAt: map.get(mine)?.countedAt ?? new Date().toISOString() })
    }
    return [...map.values()]
}

function downloadCsv(csv: string) {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `kiem-ke-showroom-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ───────────────────────── Screens ─────────────────────────

function Welcome({ previous, onDone }: { previous: string; onDone: (name: string) => void }) {
    const [name, setName] = useState(previous)
    const [err, setErr] = useState('')
    const go = () => { const n = cleanLabel(name); if (!n) { setErr('Nhập tên của bạn (tối đa 60 ký tự).'); return } onDone(n) }
    return (
        <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 bg-lys-bg px-4 text-lys-primary">
            <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-lys-muted">LY&apos;s Cellars · Showroom</div>
                <h1 className="mt-1 text-3xl font-extrabold">Kiểm kê rượu</h1>
            </div>
            <p className="text-sm text-lys-secondary">Nhập tên của bạn để mọi người biết ai đã đếm vị trí nào.</p>
            <label htmlFor="who" className="text-sm text-lys-muted">Tên người kiểm</label>
            <input id="who" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()}
                placeholder="Ví dụ: Lan" className="rounded-lg border border-lys-border bg-lys-surface px-4 py-3 text-base" />
            {err && <p className="text-sm text-tone-danger-fg">{err}</p>}
            <button onClick={go} className="rounded-lg bg-lys-teal-strong py-3.5 font-semibold text-white">Bắt đầu kiểm</button>
        </div>
    )
}

function SearchBox({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-lys-dim" />
            <input id={id} type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
                className="w-full rounded-lg border border-lys-border bg-lys-surface py-3 pl-9 pr-3 text-base" />
        </label>
    )
}

function Vintage({ v }: { v: string }) {
    return v
        ? <span className="rounded bg-tone-brand-bg px-1.5 py-0.5 text-[13px] font-bold text-tone-brand-fg">{v}</span>
        : <span className="rounded border border-dashed border-lys-border px-1.5 py-0.5 text-[13px] text-lys-muted">NV</span>
}

function Code({ c }: { c: string }) {
    return <span className="text-[14px] font-extrabold tracking-wide text-lys-primary">{c}</span>
}

type Summary = ReturnType<typeof summarize>

function SpotsView(props: {
    header: React.ReactNode; errorNote: React.ReactNode
    groups: Array<{ name: string; kind: string; spots: ShowroomSpot[] }>
    summary: Summary; homeQ: string; setHomeQ: (v: string) => void
    items: ShowroomItem[]; entries: ShowroomEntry[]; spotById: Map<string, ShowroomSpot>
    onOpen: (id: string, search?: string) => void; onSummary: () => void; onRenamed: () => Promise<void>
}) {
    const { summary, groups } = props
    const [editing, setEditing] = useState<Map<string, string> | null>(null)
    const [msg, setMsg] = useState('')
    const touched = summary.spots.filter(s => s.touched).length
    const hits = useMemo(() => {
        const q = normalizeSearch(props.homeQ.trim())
        if (!q) return []
        return props.items.filter(i => normalizeSearch(`${i.name} ${i.code} ${i.vintage}`).includes(q)).slice(0, 40)
    }, [props.homeQ, props.items])

    const save = async () => {
        if (!editing) return
        const res = await renameShowroomSpots([...editing].map(([id, name]) => ({ id, name })))
        if (!res.success) { setMsg(res.error); return }
        setMsg(''); setEditing(null); await props.onRenamed()
    }

    return (
        <div className="space-y-4">
            {props.header}
            {props.errorNote}
            {!editing && (
                <>
                    <button onClick={props.onSummary} className="flex w-full items-center justify-between gap-3 rounded-xl bg-lys-teal-strong px-4 py-3 text-left text-white">
                        <div>
                            <div className="text-xs opacity-85">Tổng đã đếm</div>
                            <div className="text-[15px]"><b className="text-[26px] font-bold leading-tight">{fmt(summary.bottles)}</b> chai{summary.posmTotal ? ` · ${fmt(summary.posmTotal)} POSM` : ''}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-[13px]">
                            <span>{touched}/{summary.spots.length} vị trí</span>
                            <span className="font-bold">Xem tổng hợp ›</span>
                        </div>
                    </button>
                    <SearchBox id="homeSearch" value={props.homeQ} onChange={props.setHomeQ} placeholder="Tìm tên hoặc mã (vd: L20019, Chablis)…" />
                </>
            )}
            {props.homeQ.trim() && !editing ? (
                <div className="overflow-hidden rounded-xl border border-lys-border bg-lys-surface">
                    {!hits.length && <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">Không tìm thấy</b>Thử gõ một phần tên hoặc mã, ví dụ “1er Cru” hoặc “L200”.</p>}
                    {hits.map(item => {
                        const where = props.entries.filter(e => e.itemId === item.id)
                        const total = where.reduce((t, e) => t + e.qty, 0)
                        return (
                            <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-lys-border p-3 first:border-t-0">
                                <div>
                                    <div className="text-sm font-medium leading-snug">{item.name}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-lys-muted">
                                        {item.kind === 'POSM' ? 'POSM' : <><Vintage v={item.vintage} /><Code c={item.code} /></>}
                                    </div>
                                </div>
                                <div className={`self-center text-[21px] font-bold ${where.length ? '' : 'text-lys-dim'}`}>{where.length ? fmt(total) : '–'}</div>
                                <div className="col-span-2 mt-1 flex flex-wrap gap-1.5">
                                    {where.length
                                        ? where.map(e => (
                                            <button key={`${e.spotId}|${e.countedBy}`} onClick={() => { props.setHomeQ(''); props.onOpen(e.spotId, item.code) }}
                                                className="rounded-full border border-lys-border bg-lys-bg px-2.5 py-1 text-[13px]">
                                                {props.spotById.get(e.spotId)?.name ?? e.spotId}: <b className="text-lys-teal-strong">{e.qty}</b>
                                                <span className="text-lys-muted"> · {e.countedBy}</span>
                                            </button>))
                                        : <span className="text-sm text-lys-muted">Chưa đếm ở vị trí nào</span>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <>
                    {groups.map(g => (
                        <section key={g.name} className="space-y-2">
                            <h2 className="text-[15px] font-bold uppercase tracking-wide text-lys-muted">{g.name}</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {g.spots.map(s => {
                                    const ss = summary.spots.find(x => x.spot.id === s.id)
                                    const [u1, u2] = unitOf(s)
                                    if (editing) return (
                                        <div key={s.id} className="flex flex-col gap-1.5 rounded-xl border border-lys-border bg-lys-surface p-3">
                                            <span className="text-xs text-lys-muted">{g.name}</span>
                                            <input aria-label="Tên vị trí" value={editing.get(s.id) ?? s.name}
                                                onChange={e => setEditing(m => new Map(m!).set(s.id, e.target.value))}
                                                className="rounded-md border border-lys-border px-2 py-1.5 text-[15px]" />
                                        </div>
                                    )
                                    return (
                                        <button key={s.id} onClick={() => props.onOpen(s.id)}
                                            className={`flex min-h-[84px] flex-col gap-1.5 rounded-xl border bg-lys-surface p-3 text-left ${ss?.touched ? 'border-tone-success-fg' : 'border-lys-border'}`}>
                                            <span className="font-semibold leading-tight">{s.name}</span>
                                            <span className={`mt-auto text-[13px] font-semibold ${ss?.touched ? 'text-tone-success-fg' : 'text-lys-muted'}`}>
                                                {ss?.touched ? `${ss.lines} ${u1} · ${fmt(ss.qty)} ${u2}` : 'Chưa đếm'}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>
                    ))}
                    {editing ? (
                        <div className="space-y-2">
                            <button onClick={save} className="w-full rounded-lg bg-lys-teal-strong py-3 font-semibold text-white">Lưu tên vị trí</button>
                            <button onClick={() => { setEditing(null); setMsg('') }} className="w-full rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">Hủy</button>
                        </div>
                    ) : (
                        <button onClick={() => setEditing(new Map())} className="w-full rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">Đổi tên vị trí</button>
                    )}
                    {msg && <p className="text-sm text-tone-danger-fg">{msg}</p>}
                </>
            )}
        </div>
    )
}

function CountView(props: {
    spot: ShowroomSpot; items: ShowroomItem[]; allWine: ShowroomItem[]
    q: string; setQ: (v: string) => void; filter: 'all' | 'done' | 'todo'; setFilter: (f: 'all' | 'done' | 'todo') => void
    qtyOf: (spotId: string, itemId: string) => number | null
    setQty: (spotId: string, itemId: string, qty: number | null, delay?: number) => void
    entryOf: (itemId: string) => ShowroomEntry | undefined
    othersOf: (itemId: string) => ShowroomEntry[]
    saving: Set<string>; errors: Map<string, string>
    spotSummary?: { lines: number; qty: number }
    errorNote: React.ReactNode; who: string
    onBack: () => void; onAdded: (code: string) => Promise<void>
}) {
    const { spot } = props
    const posm = spot.kind === 'POSM'
    const [u1, u2] = unitOf(spot)
    const [addCode, setAddCode] = useState<string | null>(null)
    const shown = useMemo(() => {
        const q = normalizeSearch(props.q.trim())
        return props.items.filter(i => {
            const n = props.qtyOf(spot.id, i.id)
            const others = props.othersOf(i.id)
            const any = (n !== null && n > 0) || others.some(e => e.qty > 0)
            if (props.filter === 'done' && !any) return false
            if (props.filter === 'todo' && (n !== null || others.length > 0)) return false
            return !q || normalizeSearch(`${i.name} ${i.code} ${i.vintage}`).includes(q)
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.items, props.q, props.filter, props.qtyOf, props.othersOf, spot.id])

    return (
        <div className="space-y-3">
            <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-lys-bg px-4 py-2">
                <button onClick={props.onBack} className="flex items-center gap-1 py-1 font-semibold text-lys-teal-strong"><ChevronLeft className="size-4" />Các vị trí</button>
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-lys-muted">
                        {spot.groupName}{props.spotSummary?.lines ? ` · ${props.spotSummary.lines} ${u1} · ${fmt(props.spotSummary.qty)} ${u2}` : ''}
                    </div>
                    <h1 className="mt-1 text-2xl font-extrabold">{spot.name}</h1>
                </div>
                <SearchBox id="search" value={props.q} onChange={props.setQ} placeholder={posm ? 'Tìm vật phẩm…' : 'Tìm tên rượu, mã, vintage…'} />
                <div role="group" aria-label="Lọc" className="flex gap-1 rounded-lg border border-lys-border bg-lys-surface p-1">
                    {([['all', 'Tất cả'], ['done', 'Đã có số'], ['todo', 'Chưa đếm']] as const).map(([v, l]) => (
                        <button key={v} aria-pressed={props.filter === v} onClick={() => props.setFilter(v)}
                            className={`flex-1 rounded-md py-2 text-sm ${props.filter === v ? 'bg-lys-teal-strong font-semibold text-white' : 'text-lys-muted'}`}>{l}</button>
                    ))}
                </div>
            </div>
            {props.errorNote}
            <div className="overflow-hidden rounded-xl border border-lys-border bg-lys-surface">
                {!shown.length && <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">{posm ? 'Không thấy vật phẩm nào' : 'Không thấy rượu nào'}</b>{posm ? 'Thử từ khóa khác.' : 'Thử từ khóa khác, hoặc thêm vintage chưa có ở bên dưới.'}</p>}
                {shown.map(item => {
                    const key = `${spot.id}|${item.id}`
                    const n = props.qtyOf(spot.id, item.id)
                    const entry = props.entryOf(item.id)
                    const err = props.errors.get(key)
                    const stamp = err ?? (props.saving.has(key) ? 'Đang lưu…' : entry ? `Bạn (${entry.countedBy}) · ${when(entry.countedAt)}` : '')
                    // Other people's own numbers for this spot: they add up, nobody overwrites anybody.
                    const others = props.othersOf(item.id)
                    const total = (n ?? 0) + others.reduce((t, e) => t + e.qty, 0)
                    return (
                        <div key={item.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-lys-border p-3 first:border-t-0 ${total > 0 ? 'bg-tone-success-bg' : ''}`}>
                            <div>
                                <div className="text-sm font-medium leading-snug">{item.name}</div>
                                {!posm && (
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-lys-muted">
                                        <Vintage v={item.vintage} /><Code c={item.code} />
                                        {item.isExtra && <span>thêm tay</span>}
                                        <button onClick={() => { setAddCode(item.code); setTimeout(() => document.getElementById('addVin')?.focus(), 30) }}
                                            className="py-1 font-semibold text-lys-teal-strong">+ vintage khác</button>
                                    </div>
                                )}
                            </div>
                            <Stepper value={n} label={`Số lượng ${item.name} ${item.vintage}`} onChange={(v, delay) => props.setQty(spot.id, item.id, v, delay)} />
                            {stamp && <div className={`col-span-2 text-xs ${err ? 'text-tone-danger-fg' : 'text-lys-muted'}`}>{stamp}</div>}
                            {others.length > 0 && (
                                <div className="col-span-2 rounded-md bg-tone-warning-bg px-2 py-1 text-xs text-tone-warning-fg">
                                    Người khác đã đếm ở đây: {others.map(e => `${e.countedBy} ${e.qty}`).join(' · ')} — tổng vị trí <b>{total}</b>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            {!posm && <AddVintage spot={spot} wines={props.allWine} code={addCode} setCode={setAddCode} who={props.who} onAdded={props.onAdded} />}
            <p className="text-sm text-lys-muted">Số tự lưu sau khi bạn ngừng gõ. Để trống nghĩa là chưa đếm; nhập 0 nghĩa là đã kiểm và không có {u2} nào.</p>
        </div>
    )
}

function Stepper({ value, label, onChange }: { value: number | null; label: string; onChange: (v: number | null, delay?: number) => void }) {
    return (
        <div className="flex items-center overflow-hidden rounded-lg border border-lys-border bg-lys-surface">
            <button aria-label="Bớt 1" onClick={() => onChange(value === null ? null : value <= 0 ? null : value - 1, 600)}
                className="flex h-11 w-10 items-center justify-center text-lys-teal-strong"><Minus className="size-5" /></button>
            <input inputMode="numeric" aria-label={label} value={value ?? ''} onFocus={e => e.target.select()}
                onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(0, 6); onChange(t === '' ? null : parseInt(t, 10)) }}
                className="w-14 bg-transparent py-2.5 text-center text-[21px] font-bold" />
            <button aria-label="Thêm 1" onClick={() => onChange((value ?? 0) + 1, 600)}
                className="flex h-11 w-10 items-center justify-center text-lys-teal-strong"><Plus className="size-5" /></button>
        </div>
    )
}

function AddVintage({ spot, wines, code, setCode, who, onAdded }: {
    spot: ShowroomSpot; wines: ShowroomItem[]; code: string | null; setCode: (c: string | null) => void; who: string; onAdded: (code: string) => Promise<void>
}) {
    const codes = useMemo(() => [...new Map(wines.map(w => [w.code, w.name])).entries()], [wines])
    const [vin, setVin] = useState('')
    const [msg, setMsg] = useState('')
    const [busy, setBusy] = useState(false)
    if (code === null) return (
        <button onClick={() => setCode(codes[0]?.[0] ?? '')} className="w-full rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">+ Thêm vintage chưa có trong danh sách</button>
    )
    const add = async () => {
        if (normalizeVintage(vin) === null) { setMsg('Vintage là năm 4 chữ số, ví dụ 2021. Để trống nếu là NV.'); return }
        setBusy(true)
        const res = await addShowroomVintage({ code, vintage: vin, spotId: spot.id, countedBy: who })
        setBusy(false)
        if (!res.success) { setMsg(res.error); return }
        setMsg(''); setVin(''); setCode(null)
        await onAdded(code)
    }
    return (
        <div className="space-y-2 rounded-xl border border-lys-border bg-lys-surface p-3">
            <b>Thêm vintage khác</b>
            <div className="flex gap-2">
                <select aria-label="Chọn rượu" value={code} onChange={e => setCode(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-lys-border bg-lys-surface p-2.5 text-sm">
                    {codes.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
                </select>
                <input id="addVin" inputMode="numeric" maxLength={4} placeholder="Năm" aria-label="Vintage" value={vin} onChange={e => setVin(e.target.value)}
                    className="w-24 rounded-lg border border-lys-border px-3 text-base" />
            </div>
            <div className="flex gap-2">
                <button disabled={busy} onClick={add} className="flex-1 rounded-lg bg-lys-teal-strong py-3 font-semibold text-white disabled:opacity-50">Thêm vào vị trí này</button>
                <button onClick={() => { setCode(null); setMsg('') }} className="flex-1 rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">Hủy</button>
            </div>
            {msg && <p className="text-sm text-tone-danger-fg">{msg}</p>}
        </div>
    )
}

function SummaryView(props: {
    header: React.ReactNode; errorNote: React.ReactNode; summary: Summary
    groups: Array<{ name: string; kind: string; spots: ShowroomSpot[] }>
    mode: SumMode; setMode: (m: SumMode) => void; q: string; setQ: (v: string) => void
    onOpen: (spotId: string) => void; onExport: () => void
}) {
    const { summary: s } = props
    const wineGroups = props.groups.filter(g => g.kind !== 'POSM')
    const groupTotal = (name: string) => s.wineFound.reduce((t, x) => t + (x.byGroup[name] ?? 0), 0)
    const q = normalizeSearch(props.q.trim())
    const hit = (i: ShowroomItem) => !q || normalizeSearch(`${i.name} ${i.code} ${i.vintage}`).includes(q)
    const modes: Array<[SumMode, string]> = [['wine', 'Theo rượu'], ['spot', 'Vị trí'], ['people', `Người kiểm (${s.people.length})`], ['missing', `Chưa thấy (${s.wineMissing.length})`]]
    if (s.posm.length) modes.push(['posm', 'POSM'])
    const row = 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-lys-border p-3 first:border-t-0'

    return (
        <div className="space-y-4">
            {props.header}
            {props.errorNote}
            <div className="grid grid-cols-3 gap-2">
                {[[fmt(s.bottles), 'chai đã đếm'], [String(s.wineFound.length), `/${s.wineCount} dòng có hàng`], [`${s.spots.filter(x => x.touched).length}/${s.spots.length}`, 'vị trí đã kiểm']].map(([n, l]) => (
                    <div key={l} className="rounded-xl border border-lys-border bg-lys-surface px-3 py-2.5">
                        <div className="text-2xl font-bold">{n}</div><div className="text-xs text-lys-muted">{l}</div>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                {wineGroups.map(g => (
                    <div key={g.name} className="flex min-w-[90px] flex-1 items-baseline justify-between gap-2 rounded-lg bg-tone-brand-bg px-3 py-2 text-[13px] font-semibold text-tone-brand-fg">
                        <span>{g.name}</span><b className="text-lg">{fmt(groupTotal(g.name))}</b>
                    </div>
                ))}
            </div>
            <div role="group" aria-label="Kiểu tổng hợp" className="grid grid-cols-3 gap-1 rounded-lg border border-lys-border bg-lys-surface p-1">
                {modes.map(([v, l]) => (
                    <button key={v} aria-pressed={props.mode === v} onClick={() => props.setMode(v)}
                        className={`rounded-md px-1 py-2 text-sm ${props.mode === v ? 'bg-lys-teal-strong font-semibold text-white' : 'text-lys-muted'}`}>{l}</button>
                ))}
            </div>
            {props.mode !== 'spot' && <SearchBox id="sumSearch" value={props.q} onChange={props.setQ}
                placeholder={props.mode === 'posm' ? 'Tìm vật phẩm…' : props.mode === 'people' ? 'Tìm người kiểm, rượu, mã…' : 'Tìm tên rượu, mã, vintage…'} />}

            <div className="overflow-hidden rounded-xl border border-lys-border bg-lys-surface">
                {props.mode === 'wine' && (() => {
                    const list = s.wineFound.filter(x => hit(x.item))
                    if (!list.length) return <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">{q ? 'Không có dòng nào khớp' : 'Chưa có số nào'}</b>{q ? '' : 'Chọn một vị trí ở tab Vị trí để bắt đầu đếm.'}</p>
                    return list.map(x => (
                        <details key={x.item.id} className="border-t border-lys-border p-3 first:border-t-0">
                            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                                <div>
                                    <div className="text-sm font-medium leading-snug">{x.item.name}</div>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-lys-muted"><Vintage v={x.item.vintage} /><Code c={x.item.code} /></div>
                                    <div className="mt-1 text-xs text-lys-muted">{Object.entries(x.byGroup).map(([g, n]) => `${g}: ${n}`).join(' · ')}</div>
                                </div>
                                <div className="self-center text-[21px] font-bold">{fmt(x.total)}</div>
                            </summary>
                            <div className="mt-2 space-y-1 rounded-lg bg-lys-bg px-3 py-2 text-[13px]">
                                {x.parts.map(p => (
                                    <div key={`${p.spot.id}|${p.by}`} className="flex justify-between gap-3">
                                        <span>{p.spot.name} <span className="text-lys-muted">· {p.by}</span></span><b>{p.qty}</b>
                                    </div>
                                ))}
                            </div>
                        </details>
                    ))
                })()}
                {props.mode === 'people' && (() => {
                    // Who counted what, so each person's numbers can be re-checked.
                    const list = s.people
                        .map(p => normalizeSearch(p.name).includes(q) ? p : { ...p, lines: p.lines.filter(l => hit(l.item)) })
                        .filter(p => !q || p.lines.length)
                    if (!list.length) return <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">{q ? 'Không có dòng nào khớp' : 'Chưa ai đếm'}</b></p>
                    return list.map(p => (
                        <details key={p.name} className="border-t border-lys-border p-3 first:border-t-0">
                            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                                <div>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="mt-1 text-xs text-lys-muted">
                                        {p.lines.length} dòng · {[...new Set(p.lines.map(l => l.spot.name))].join(', ')}
                                    </div>
                                </div>
                                <div className="self-center text-right">
                                    <div className="text-[21px] font-bold">{fmt(p.wine)}</div>
                                    <div className="text-xs text-lys-muted">chai{p.posm ? ` · ${fmt(p.posm)} POSM` : ''}</div>
                                </div>
                            </summary>
                            <div className="mt-2 divide-y divide-lys-border rounded-lg bg-lys-bg px-3 text-[13px]">
                                {p.lines.map(l => (
                                    <div key={`${l.spot.id}|${l.item.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
                                        <div>
                                            <div className="text-xs text-lys-muted">{l.spot.name} · {when(l.at)}</div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                {l.item.kind !== 'POSM' && <><Code c={l.item.code} /><Vintage v={l.item.vintage} /></>}
                                                <span>{l.item.name}</span>
                                            </div>
                                        </div>
                                        <b className="self-center text-base">{l.qty}</b>
                                    </div>
                                ))}
                            </div>
                        </details>
                    ))
                })()}
                {props.mode === 'missing' && (() => {
                    const list = s.wineMissing.filter(x => hit(x.item))
                    if (!list.length) return <p className="p-6 text-center font-bold">{q ? 'Không có dòng nào khớp' : 'Dòng nào cũng đã thấy hàng'}</p>
                    return list.map(x => (
                        <div key={x.item.id} className={row}>
                            <div>
                                <div className="text-sm font-medium leading-snug">{x.item.name}</div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-lys-muted"><Vintage v={x.item.vintage} /><Code c={x.item.code} /></div>
                            </div>
                            <span className="self-center whitespace-nowrap rounded-md border border-lys-border px-2 py-1 text-xs text-lys-muted">{x.checked ? 'Đã kiểm = 0' : 'Chưa đếm'}</span>
                        </div>
                    ))
                })()}
                {props.mode === 'posm' && (
                    <>
                        <div className="flex justify-between bg-tone-brand-bg px-3 py-2.5 text-[13px] font-bold uppercase tracking-wide text-tone-brand-fg"><span>POSM</span><b className="normal-case">{fmt(s.posmTotal)} cái</b></div>
                        {s.posm.filter(x => hit(x.item)).map(x => (
                            <div key={x.item.id} className={row}>
                                <div>
                                    <div className="text-sm font-medium leading-snug">{x.item.name}</div>
                                    <div className="mt-1 text-xs text-lys-muted">{x.total ? x.parts.map(p => `${p.spot.name}: ${p.qty} (${p.by})`).join(' · ') : x.checked ? 'Đã kiểm = 0' : 'Chưa đếm'}</div>
                                </div>
                                <div className={`self-center text-[21px] font-bold ${x.checked ? '' : 'text-lys-dim'}`}>{x.checked ? fmt(x.total) : '–'}</div>
                            </div>
                        ))}
                    </>
                )}
                {props.mode === 'spot' && props.groups.map(g => (
                    <div key={g.name}>
                        <div className="flex justify-between bg-tone-brand-bg px-3 py-2.5 text-[13px] font-bold uppercase tracking-wide text-tone-brand-fg">
                            <span>{g.name}</span><b className="normal-case">{g.kind === 'POSM' ? `${fmt(s.posmTotal)} cái` : `${fmt(groupTotal(g.name))} chai`}</b>
                        </div>
                        {g.spots.map(spot => {
                            const ss = s.spots.find(x => x.spot.id === spot.id)
                            return (
                                <button key={spot.id} onClick={() => props.onOpen(spot.id)} className={`${row} w-full text-left`}>
                                    <div>
                                        <div className="font-medium">{spot.name}</div>
                                        <div className="mt-1 text-xs text-lys-muted">{ss?.touched ? `${ss.lines} dòng có hàng · ${ss.people.join(', ')} · ${ss.lastAt ? when(ss.lastAt) : ''}` : 'Chưa kiểm'}</div>
                                    </div>
                                    <div className={`self-center text-[21px] font-bold ${ss?.touched ? '' : 'text-lys-dim'}`}>{ss?.touched ? fmt(ss.qty) : '–'}</div>
                                </button>
                            )
                        })}
                    </div>
                ))}
            </div>
            <button onClick={props.onExport} className="w-full rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">Tải kết quả (.csv)</button>
        </div>
    )
}
