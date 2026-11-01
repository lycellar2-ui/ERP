import type { Metadata } from 'next'
import Link from 'next/link'
import { getShowroomCount } from '../actions'
import { buildGroupReport } from '../logic'
import { PrintButton } from './PrintButton'

export const metadata: Metadata = { title: 'Biên bản kiểm kê showroom' }
export const dynamic = 'force-dynamic'

// Vercel chạy giờ UTC: luôn hiển thị theo giờ Việt Nam.
const TZ = 'Asia/Ho_Chi_Minh'
const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const date = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
const fmt = (n: number) => n.toLocaleString('vi-VN')

const th = 'border border-black px-1.5 py-1 text-left font-bold'
const td = 'border border-black px-1.5 py-1 align-top'
const num = 'border border-black px-1.5 py-1 text-right align-top tabular-nums'
const PRINT_CSS = '@page { size: A4 landscape; margin: 10mm } @media print { thead { display: table-header-group } tr { break-inside: avoid } }'

/** Biên bản kiểm kê in được theo từng khu vực (?g=Tầng 1). Công khai như /kiem-ke. */
export default async function BienBanPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
    const { g } = await searchParams
    const res = await getShowroomCount()
    if (!res.success || !res.data) return <p className="p-6">{res.success ? 'Không có dữ liệu.' : res.error}</p>
    const groups = [...new Set([...res.data.spots].sort((a, b) => a.sortOrder - b.sortOrder).map(s => s.groupName))]
    const report = buildGroupReport(res.data, g ?? groups[0])
    if (!report) return <p className="p-6">Không có khu vực “{g}”.</p>

    const now = new Date().toISOString()
    const posm = report.kind === 'POSM'
    const unit = posm ? 'cái' : 'chai'
    const signers: Array<[string, string]> = [
        ...report.people.map((p): [string, string] => ['Người kiểm kê', p]),
        ...report.checkers.filter(c => !report.people.includes(c)).map((c): [string, string] => ['Người kiểm lại', c]),
        ['Thủ kho / Quản lý showroom', ''], ['Kế toán', ''], ['Giám đốc', ''],
    ]
    const itemLabel = (item: { kind: string; code: string; name: string; vintage: string }) =>
        item.kind === 'POSM' ? item.name : `${item.code} ${item.vintage || 'NV'}`

    return (
        <div className="min-h-dvh bg-white text-[13px] leading-snug text-black print:text-[11px]">
            <style>{PRINT_CSS}</style>
            <div className="sticky top-0 flex flex-wrap items-center gap-2 border-b border-lys-border bg-white p-3 print:hidden">
                <Link href="/kiem-ke?v=sum" className="font-semibold text-lys-teal-strong">‹ Kiểm kê</Link>
                <span className="ml-2 text-lys-muted">Khu vực:</span>
                {groups.map(x => (
                    <Link key={x} href={`/kiem-ke/bien-ban?g=${encodeURIComponent(x)}`}
                        className={`rounded-full border px-3 py-1 ${x === report.group ? 'border-lys-teal-strong bg-lys-teal-strong text-white' : 'border-lys-border'}`}>{x}</Link>
                ))}
                <span className="flex-1" />
                <PrintButton />
            </div>

            <div className="mx-auto max-w-[1100px] space-y-4 p-6 print:max-w-none print:p-0">
                <div className="flex justify-between gap-4 text-[12px]">
                    <div><b>LY&apos;s Cellars</b><br />Showroom</div>
                    <div className="text-center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br />Độc lập – Tự do – Hạnh phúc</div>
                </div>
                <h1 className="pt-2 text-center text-xl font-extrabold uppercase">Biên bản kiểm kê showroom — {report.group}</h1>
                <p className="text-center">Số liệu chốt lúc {time(now)} ngày {date(now)}</p>

                <section>
                    <h2 className="mb-1 font-bold">I. Thông tin chung</h2>
                    <ul className="list-disc pl-6">
                        <li>Địa điểm: Showroom — {report.group} ({report.spots.length} vị trí)</li>
                        <li>Thời gian kiểm: {report.firstAt && report.lastAt ? `${time(report.firstAt)} – ${time(report.lastAt)} ngày ${date(report.lastAt)}` : 'chưa có số đếm'}</li>
                        <li>Người kiểm kê: {report.people.join(', ') || '—'}{report.checkers.length ? ` · Người kiểm lại: ${report.checkers.join(', ')}` : ''}</li>
                        <li>Kết quả: <b>{fmt(report.total)} {unit}</b>, {report.rows.length} dòng hàng; đã kiểm lại lần 2: {report.rechecked}/{report.cells} dòng.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="mb-1 font-bold">II. Tổng hợp theo vị trí</h2>
                    <table className="w-full border-collapse">
                        <thead><tr>
                            <th className={th}>STT</th><th className={th}>Vị trí</th><th className={th}>Số dòng có hàng</th>
                            <th className={th}>Số {unit}</th><th className={th}>Người đếm</th><th className={th}>Đã kiểm lại</th><th className={th}>Người kiểm lại</th>
                        </tr></thead>
                        <tbody>
                            {report.spots.map((s, i) => (
                                <tr key={s.spot.id}>
                                    <td className={num}>{i + 1}</td><td className={td}>{s.spot.name}</td><td className={num}>{s.lines}</td>
                                    <td className={num}>{fmt(s.qty)}</td><td className={td}>{s.people.join(', ')}</td>
                                    <td className={num}>{s.cells ? `${s.rechecked}/${s.cells}` : ''}</td><td className={td}>{s.checkers.join(', ')}</td>
                                </tr>
                            ))}
                            <tr className="font-bold">
                                <td className={td} /><td className={td}>Cộng {report.group}</td><td className={num}>{report.rows.length}</td>
                                <td className={num}>{fmt(report.total)}</td><td className={td} /><td className={num}>{report.rechecked}/{report.cells}</td><td className={td} />
                            </tr>
                        </tbody>
                    </table>
                    <p className="mt-1 text-[11px]">Dòng Cộng đếm số dòng hàng không trùng; một dòng có thể nằm ở nhiều vị trí.</p>
                </section>

                <section>
                    <h2 className="mb-1 font-bold">III. Chi tiết theo mặt hàng</h2>
                    <p className="mb-1 text-[11px]">Cột (1)–({report.spots.length}) là số {unit} tại các vị trí đánh số ở mục II.</p>
                    <table className="w-full border-collapse">
                        <thead><tr>
                            <th className={th}>STT</th>
                            {!posm && <th className={th}>Mã</th>}
                            <th className={th}>Tên hàng</th>
                            {!posm && <th className={th}>Vintage</th>}
                            {report.spots.map((s, i) => <th key={s.spot.id} className={`${th} text-right`}>({i + 1})</th>)}
                            <th className={`${th} text-right`}>Cộng</th>
                        </tr></thead>
                        <tbody>
                            {report.rows.map((r, i) => (
                                <tr key={r.item.id}>
                                    <td className={num}>{i + 1}</td>
                                    {!posm && <td className={`${td} font-bold`}>{r.item.code}</td>}
                                    <td className={td}>{r.item.name}</td>
                                    {!posm && <td className={td}>{r.item.vintage || 'NV'}</td>}
                                    {r.bySpot.map((n, j) => <td key={j} className={num}>{n || ''}</td>)}
                                    <td className={`${num} font-bold`}>{fmt(r.total)}</td>
                                </tr>
                            ))}
                            <tr className="font-bold">
                                <td className={td} colSpan={posm ? 2 : 4}>Cộng</td>
                                {report.spotTotals.map((n, j) => <td key={j} className={num}>{fmt(n)}</td>)}
                                <td className={num}>{fmt(report.total)}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className="break-inside-avoid">
                    <h2 className="mb-1 font-bold">IV. Kiểm lại lần 2 và ghi chú</h2>
                    {report.unchecked.length
                        ? <p>{report.unchecked.length} dòng chưa có người kiểm lại (hoặc số đã đổi sau khi kiểm lại): {report.unchecked.map(u =>
                            `${itemLabel(u.item)} tại ${u.spot.name} (${u.total})`).join('; ')}.</p>
                        : <p>{report.cells ? `Tất cả ${report.cells} dòng đã được người thứ hai kiểm lại và xác nhận đúng số.` : 'Khu vực này chưa có số đếm.'}</p>}
                    {report.notes.length > 0 && (
                        <ul className="mt-1 list-disc pl-6">
                            {report.notes.map((n, i) => (
                                <li key={i}>{n.spot.name}{n.item ? ` · ${itemLabel(n.item)}` : ''} — {n.writtenBy}: {n.note}</li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-2">Chênh lệch / ý kiến khác: ..........................................................................................................................................</p>
                    <p className="mt-2">......................................................................................................................................................................................</p>
                </section>

                <section className="break-inside-avoid">
                    <h2 className="mb-1 font-bold">V. Kết luận và chữ ký</h2>
                    <p>Các bên thống nhất số lượng thực tế tại {report.group} showroom là <b>{fmt(report.total)} {unit}</b>, chi tiết theo mục III. Biên bản lập thành 02 bản, mỗi bên giữ 01 bản.</p>
                    <table className="mt-2 w-full border-collapse">
                        <thead><tr><th className={th}>Vai trò</th><th className={th}>Họ và tên</th><th className={`${th} w-[40%]`}>Chữ ký</th></tr></thead>
                        <tbody>
                            {signers.map(([role, name], i) => (
                                <tr key={i} className="h-14"><td className={td}>{role}</td><td className={td}>{name}</td><td className={td} /></tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="mt-3 text-right">Ngày ký: ......./......./{date(now).slice(-4)}</p>
                </section>
            </div>
        </div>
    )
}
