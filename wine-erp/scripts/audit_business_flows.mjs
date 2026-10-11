import fs from 'fs';
import path from 'path';

const actionsDir = path.resolve('src/app/dashboard');
const libDir = path.resolve('src/lib');

// Find all actions.ts or actions-*.ts files
function findActionFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(findActionFiles(full));
    } else if (entry.name.startsWith('actions') && entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const actionFiles = findActionFiles(actionsDir);
console.log(`Found ${actionFiles.length} action files in src/app/dashboard.`);

// We will inspect cross-module business flows:
const flows = [
  {
    name: '1. PO ➔ GoodsReceipt ➔ StockLot (Procurement to WMS)',
    module: 'Procurement / WMS',
    files: actionFiles.filter(f => f.includes('procurement') || f.includes('warehouse')),
    checks: [
      { id: 'PO_CREATE', desc: 'Creates PurchaseOrder and POLine', regex: /prisma\.purchaseOrder\.create/ },
      { id: 'GR_CREATE', desc: 'GoodsReceipt references poId', regex: /poId|purchaseOrderId/ },
      { id: 'GR_CONFIRM_STOCK', desc: 'GR confirmation creates or increments StockLot', regex: /stockLot\.create|stockLot\.upsert|stockLot\.update/ },
      { id: 'PO_STATUS_SYNC', desc: 'GR status update updates PO status (e.g. RECEIVED / PARTIALLY_RECEIVED)', regex: /purchaseOrder\.update.*status/s }
    ]
  },
  {
    name: '2. SO ➔ DeliveryOrder ➔ StockLot (Sales to WMS Outbound)',
    module: 'Sales / WMS',
    files: actionFiles.filter(f => f.includes('sales') || f.includes('warehouse') || f.includes('delivery')),
    checks: [
      { id: 'SO_CREATE', desc: 'Creates SalesOrder and SOLine', regex: /prisma\.salesOrder\.create/ },
      { id: 'SO_CHECK_CREDIT', desc: 'Checks customer credit limit or credit hold', regex: /creditHold|creditLimit|isCreditHold/i },
      { id: 'SO_CHECK_STOCK', desc: 'Validates available stock before order', regex: /qty_available|availableQty|qtyAvailable/ },
      { id: 'DO_RESERVE_STOCK', desc: 'Reserves stock on DO picking/creation', regex: /qty_reserved|reservedQty|reserve/i },
      { id: 'DO_DEDUCT_STOCK', desc: 'Deducts physical stock on DO SHIPPED/CONFIRMED', regex: /stockLot\.update.*qty_available/s },
      { id: 'FIFO_ALLOCATION', desc: 'Uses FIFO logic to select lots by expiry/receipt date', regex: /FIFO|pickByFIFO|orderBy:.*expiryDate|orderBy:.*receivedDate/i },
      { id: 'SO_STATUS_DELIVERED', desc: 'DO completion updates SO status to DELIVERED/COMPLETED', regex: /salesOrder\.update.*status/s }
    ]
  },
  {
    name: '3. DO / SO ➔ ARInvoice ➔ ARPayment (Sales to Finance AR)',
    module: 'Sales / Finance / Delivery',
    files: actionFiles.filter(f => f.includes('sales') || f.includes('finance') || f.includes('delivery')),
    checks: [
      { id: 'AR_INVOICE_CREATE', desc: 'Creates ARInvoice linked to SalesOrder or Customer', regex: /prisma\.aRInvoice\.create/ },
      { id: 'AR_PAYMENT_CREATE', desc: 'Creates ARPayment linked to ARInvoice', regex: /prisma\.aRPayment\.create/ },
      { id: 'COD_TO_AR_SYNC', desc: 'Syncs COD collection from delivery to ARPayment/ARInvoice', regex: /syncCODToAR|aRPayment\.create/ },
      { id: 'AR_STATUS_PAID', desc: 'Updates ARInvoice to PAID when payments equal total', regex: /aRInvoice\.update.*PAID/s }
    ]
  },
  {
    name: '4. PO ➔ APInvoice ➔ APPayment (Procurement to Finance AP)',
    module: 'Procurement / Finance',
    files: actionFiles.filter(f => f.includes('procurement') || f.includes('finance')),
    checks: [
      { id: 'AP_INVOICE_CREATE', desc: 'Creates APInvoice linked to PurchaseOrder or Supplier', regex: /prisma\.aPInvoice\.create/ },
      { id: 'AP_PAYMENT_CREATE', desc: 'Creates APPayment linked to APInvoice', regex: /prisma\.aPPayment\.create/ },
      { id: 'LANDED_COST_AP', desc: 'Allocates landed cost to stock lots or creates journal entries', regex: /landedCost|unit_landed_cost/i }
    ]
  },
  {
    name: '5. Wine Stamp (STP) ➔ StockLot & Sales/WMS Verification',
    module: 'Stamps / Warehouse / Sales',
    files: actionFiles.filter(f => f.includes('stamps') || f.includes('warehouse') || f.includes('sales')),
    checks: [
      { id: 'STAMP_PURCHASE', desc: 'Records WineStampPurchase', regex: /prisma\.wineStampPurchase\.create/ },
      { id: 'STAMP_USAGE', desc: 'Records WineStampUsage linked to StockLot or Product', regex: /prisma\.wineStampUsage\.create/ },
      { id: 'STAMP_BALANCE_CHECK', desc: 'Prevents using more stamps than remaining quantity', regex: /remainingQty|qtyUsed.*totalQty|throw new Error/ },
      { id: 'STAMP_SO_VERIFY', desc: 'Checks or warns on sales/shipment of unstamped wine', regex: /stamp|WineStampUsage|isStamped/i }
    ]
  },
  {
    name: '6. Payment Requests ➔ Approval Workflow ➔ Finance/Expense',
    module: 'Payment Requests / Finance / Settings',
    files: actionFiles.filter(f => f.includes('payment-requests') || f.includes('finance') || f.includes('settings')),
    checks: [
      { id: 'PAYMENT_REQ_CREATE', desc: 'Creates PaymentRequest and items', regex: /prisma\.paymentRequest\.create/ },
      { id: 'PAYMENT_REQ_APPROVAL', desc: 'Connects to approval workflow / multi-step approval', regex: /approval|ApprovalLog|ApprovalWorkflow/i },
      { id: 'BUDGET_DEDUCTION', desc: 'Checks or deducts from Department/Category Budget', regex: /budget|allocatedAmount|spentAmount/i },
      { id: 'PAYMENT_REQ_FIN_SYNC', desc: 'Links to APInvoice or creates Expense/JournalEntry on final approval', regex: /aPInvoice|journalEntry|expense/i }
    ]
  },
  {
    name: '7. CRM Pipeline ➔ Quotation ➔ Sales Order',
    module: 'CRM / Sales / Pipeline',
    files: actionFiles.filter(f => f.includes('crm') || f.includes('pipeline') || f.includes('quotations') || f.includes('sales')),
    checks: [
      { id: 'LEAD_DEAL_CREATE', desc: 'Manages Leads/Deals/Pipelines', regex: /prisma\.deal\.create|prisma\.crmLead\.create|prisma\.pipeline/i },
      { id: 'DEAL_TO_QUOTATION', desc: 'Converts Deal to SalesQuotation or links quotationId', regex: /quotation|dealId|deal\.update/i },
      { id: 'QUOTATION_TO_SO', desc: 'Converts Quotation to SalesOrder', regex: /convertQuotationToSO|salesOrder\.create.*quotationId|fromQuotation/i }
    ]
  },
  {
    name: '8. Field Visits ➔ Customer & HR/Employee Linkage',
    module: 'Sales Field / CRM / HR',
    files: actionFiles.filter(f => f.includes('visits') || f.includes('sales') || f.includes('hr')),
    checks: [
      { id: 'CHECKIN_CREATE', desc: 'Records SalesFieldVisit / Checkin with GPS and photo', regex: /checkIn|salesFieldVisit|salesVisit/i },
      { id: 'LINK_CUSTOMER', desc: 'Visit links to Customer ID', regex: /customerId/i },
      { id: 'LINK_EMPLOYEE', desc: 'Visit links to Employee or User ID', regex: /employeeId|userId/i },
      { id: 'VISIT_OUTCOME_ORDER', desc: 'Visit logs order or notes that link back to CRM/Sales', regex: /salesOrder|lead|deal|notes/i }
    ]
  },
  {
    name: '9. POS & Retail ➔ WMS Inventory & Finance Cash/AR',
    module: 'POS / WMS / Finance',
    files: actionFiles.filter(f => f.includes('pos') || f.includes('warehouse') || f.includes('finance')),
    checks: [
      { id: 'POS_ORDER_CREATE', desc: 'Creates POS Order and order items', regex: /posOrder\.create|posTransaction/i },
      { id: 'POS_STOCK_DEDUCT', desc: 'Deducts stock immediately from POS store location/lot', regex: /stockLot\.update|stockMovement\.create/i },
      { id: 'POS_LOYALTY_EARN', desc: 'Accrues loyalty points for Customer', regex: /loyalty|points/i },
      { id: 'POS_FIN_CLOSE', desc: 'Reconciles POS cash session to JournalEntry / Cash account', regex: /posSession|cashFloat|journalEntry/i }
    ]
  },
  {
    name: '10. Consignment ➔ WMS Stock & Settlement',
    module: 'Consignment / WMS / Sales',
    files: actionFiles.filter(f => f.includes('consignment') || f.includes('warehouse')),
    checks: [
      { id: 'CSG_ORDER_CREATE', desc: 'Creates Consignment Order to customer venue', regex: /consignmentOrder|consignment/i },
      { id: 'CSG_STOCK_HOLD', desc: 'Transfers stock to Consignment Location or flags lot as consigned', regex: /consignmentLocation|isConsigned|transfer/i },
      { id: 'CSG_SETTLEMENT', desc: 'Settles sold consignment stock into SalesOrder/ARInvoice', regex: /settle|salesOrder\.create|aRInvoice/i }
    ]
  },
  {
    name: '11. Stock Transfer & Inter-entity Pairing',
    module: 'Warehouse / Transfers / Multi-Entity',
    files: actionFiles.filter(f => f.includes('transfers') || f.includes('warehouse') || f.includes('sales')),
    checks: [
      { id: 'TRANSFER_CREATE', desc: 'Creates StockTransfer between warehouses', regex: /stockTransfer\.create/i },
      { id: 'TRANSFER_LOT_MOVE', desc: 'Moves lots or creates new lots in target location upon receipt', regex: /stockLot\.update.*locationId|stockLot\.create/s },
      { id: 'INTER_ENTITY_PAIRING', desc: 'Auto-pairs Thắng Ân SO with Lys PO or transfers ownerEntityId', regex: /ownerEntityId|legalEntityId|INTER_COMPANY|interCompany/i }
    ]
  },
  {
    name: '12. Contracts & Regulated Documents Compliance',
    module: 'Contracts / Compliance / Sales / Procurement',
    files: actionFiles.filter(f => f.includes('contracts') || f.includes('sales') || f.includes('procurement')),
    checks: [
      { id: 'CONTRACT_CREATE', desc: 'Creates Contract with Customer/Supplier', regex: /prisma\.contract\.create/i },
      { id: 'CONTRACT_AMENDMENT', desc: 'Creates ContractAmendment with audit trail', regex: /contractAmendment\.create/i },
      { id: 'REG_DOC_LINK', desc: 'RegulatedDocument links to Supplier or Product', regex: /regulatedDocument|regDoc/i },
      { id: 'COMPLIANCE_GATE', desc: 'Checks active contract or required permits before SO/PO', regex: /contractId|contract\.find/i }
    ]
  },
  {
    name: '13. Warehouse Inspection & Quality Check',
    module: 'Warehouse Inspection / WMS',
    files: actionFiles.filter(f => f.includes('warehouse') || f.includes('inspection')),
    checks: [
      { id: 'INSPECTION_CREATE', desc: 'Creates daily or periodic warehouse inspection', regex: /warehouseInspection|inspection/i },
      { id: 'CHECKLIST_ITEMS', desc: 'Records temperature, humidity, security checklist items', regex: /checklist|temperature|humidity/i },
      { id: 'INCIDENT_REPORT', desc: 'Links failed checks or damage to Quarantine / StockAdjustment', regex: /quarantine|stockAdjustment|damage/i }
    ]
  },
  {
    name: '14. Bank Statement Reconciliation (Fin Reconciliation)',
    module: 'Finance / Banking',
    files: actionFiles.filter(f => f.includes('finance') || f.includes('bank')),
    checks: [
      { id: 'BANK_STATEMENT_UPLOAD', desc: 'Imports BankStatement and BankTransaction', regex: /bankStatement|bankTransaction/i },
      { id: 'AUTO_MATCH_AR_AP', desc: 'Matches bank transactions with ARPayment / APPayment', regex: /reconcil|match|BankTransactionMatch/i },
      { id: 'JOURNAL_RECONCILE', desc: 'Creates reconciliation journal entries', regex: /journalEntry|reconciled/i }
    ]
  }
];

const flowResults = [];

for (const flow of flows) {
  const result = {
    name: flow.name,
    module: flow.module,
    checks: []
  };

  // Read all related files
  const fileContents = flow.files.map(f => ({
    file: path.relative(process.cwd(), f).replace(/\\/g, '/'),
    content: fs.readFileSync(f, 'utf8')
  }));

  for (const check of flow.checks) {
    let matched = false;
    let foundIn = [];

    for (const fc of fileContents) {
      if (check.regex.test(fc.content)) {
        matched = true;
        foundIn.push(fc.file);
      }
    }

    result.checks.push({
      id: check.id,
      desc: check.desc,
      status: matched ? 'LINKED' : 'GAP_OR_MANUAL',
      foundIn
    });
  }

  flowResults.push(result);
}

fs.writeFileSync('scratch/business_flow_audit.json', JSON.stringify(flowResults, null, 2));
console.log('Business flow audit saved to scratch/business_flow_audit.json');

// Print brief console report
for (const fr of flowResults) {
  console.log(`\n=== ${fr.name} ===`);
  for (const c of fr.checks) {
    const icon = c.status === 'LINKED' ? '[x]' : '[ ]';
    console.log(`  ${icon} ${c.id}: ${c.desc} -> ${c.status} (${c.foundIn.length} files)`);
  }
}
