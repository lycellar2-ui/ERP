import fs from 'node:fs'

const files = [
  "src/app/dashboard/warehouse/TransfersTab.tsx",
  "src/app/dashboard/stock-count/MobileLocationCounter.tsx",
  "src/app/dashboard/stock-count/PrintableAuditReport.tsx",
  "src/app/dashboard/stock-count/StockCountClient.tsx",
  "src/app/dashboard/stock-count/StockCountTableModal.tsx",
  "src/app/dashboard/stock-count/BarcodeLookupModal.tsx",
  "src/app/dashboard/stock-count/AddUnlistedModal.tsx"
]

for (const f of files) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, "utf8")
    content = content.replace(/bg-\[#0E7490\]\s+hover:bg-\[#76BAA8\]\s+text-slate-900/g, "bg-[#0891B2] hover:bg-[#0E7490] text-white")
    content = content.replace(/bg-\[#0E7490\]\s+hover:bg-\[#76BAA8\]/g, "bg-[#0891B2] hover:bg-[#0E7490]")
    content = content.replace(/hover:bg-\[#76BAA8\]\s+text-slate-900/g, "hover:bg-[#0E7490] text-white")
    content = content.replace(/border-\[#76BAA8\]/g, "border-[#0891B2]")
    fs.writeFileSync(f, content, "utf8")
    console.log("Updated", f)
  }
}
