import fs from 'fs';
import path from 'path';

const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Parse models and enums
const modelRegex = /model\s+([A-Za-z0-9_]+)\s+{([^}]+)}/g;
let m;
const models = {};

while ((m = modelRegex.exec(schemaContent)) !== null) {
  const modelName = m[1];
  const body = m[2];
  const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  
  const fields = [];
  const relations = [];
  const foreignKeys = [];
  const indexes = [];

  for (const line of lines) {
    if (line.startsWith('@@index')) {
      indexes.push(line);
      continue;
    }
    if (line.startsWith('@@unique')) {
      indexes.push(line);
      continue;
    }
    if (line.startsWith('@@id')) {
      indexes.push(line);
      continue;
    }

    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const fieldName = parts[0];
      const fieldType = parts[1].replace('?', '').replace('[]', '');
      const isArray = parts[1].includes('[]');
      const isOptional = parts[1].includes('?');
      const isId = line.includes('@id');
      const isUnique = line.includes('@unique');
      const hasDefault = line.includes('@default');
      const relationMatch = line.match(/@relation\(([^)]+)\)/);

      fields.push({
        name: fieldName,
        type: fieldType,
        rawType: parts[1],
        isOptional,
        isArray,
        isId,
        isUnique,
        hasDefault
      });

      if (relationMatch) {
        const relDetails = relationMatch[1];
        const fieldsMatch = relDetails.match(/fields:\s*\[([^\]]+)\]/);
        const refMatch = relDetails.match(/references:\s*\[([^\]]+)\]/);
        const nameMatch = relDetails.match(/^"([^"]+)"/);
        const onDeleteMatch = relDetails.match(/onDelete:\s*([A-Za-z]+)/);

        relations.push({
          field: fieldName,
          targetModel: fieldType,
          relationName: nameMatch ? nameMatch[1] : null,
          foreignKeys: fieldsMatch ? fieldsMatch[1].split(',').map(s => s.trim()) : [],
          references: refMatch ? refMatch[1].split(',').map(s => s.trim()) : [],
          onDelete: onDeleteMatch ? onDeleteMatch[1] : 'NONE',
          isArray,
          isOptional
        });

        if (fieldsMatch) {
          fieldsMatch[1].split(',').forEach(fk => foreignKeys.push(fk.trim()));
        }
      }
    }
  }

  models[modelName] = {
    name: modelName,
    fields,
    relations,
    foreignKeys,
    indexes
  };
}

// Find relations where model is on the 1-side (inverse relation)
for (const [mName, mData] of Object.entries(models)) {
  for (const field of mData.fields) {
    if (models[field.type] && !mData.relations.some(r => r.field === field.name)) {
      mData.relations.push({
        field: field.name,
        targetModel: field.type,
        relationName: null,
        foreignKeys: [],
        references: [],
        onDelete: 'NONE',
        isArray: field.isArray,
        isOptional: field.isOptional,
        isInverse: true
      });
    }
  }
}

// Group models by functional domain
const domainRules = [
  {
    domain: '1. Hệ Thống, Phân Quyền & Phê Duyệt (SYS & Approval)',
    match: m => /^(User|Role|Permission|RolePermission|UserRole|AuditLog|Approval|Department|SystemConfig|Notification|InAppNotification)/i.test(m)
  },
  {
    domain: '2. Danh Mục Dữ Liệu Gốc (Master Data - MDM)',
    match: m => /^(Product|Category|GrapeVariety|WineRegion|Appellation|Producer|Customer|Supplier|PriceList|CustomerPriceRule|CustomerProductCode|ExchangeRate|PaymentTerm|Incoterm|UnitOfMeasure)/i.test(m) && !/^(PosmProduct|PurchaseOrder|SalesOrder)/i.test(m)
  },
  {
    domain: '3. Quản Lý Kho Vận & Tồn Kho (WMS & Inventory)',
    match: m => /^(Warehouse|Location|StockLot|StockMovement|GoodsReceipt|GoodsReceiptLine|StockAdjustment|StockAdjustmentLine|StockCount|StockCountItem|StockCountSession|Quarantine|WriteOff|WarehouseInspection|IncidentReport|TransferOrder|TransferOrderLine)/i.test(m)
  },
  {
    domain: '4. Mua Hàng & Ngoại Thương (Procurement & Import - PRC)',
    match: m => /^(PurchaseOrder|PurchaseOrderLine|PODocument|Shipment|ShipmentContainer|ShipmentItem|LandedCost|CustomsDeclaration|InsurancePolicy|ImportAgency|AgencyDocument|PurchaseSuggestion)/i.test(m)
  },
  {
    domain: '5. Bán Hàng & Phân Bổ (Sales & Allocation - SLS)',
    match: m => /^(SalesOrder|SalesOrderLine|SalesQuotation|SalesQuotationLine|AllocationCampaign|AllocationQuota|AllocationLog|SalesOpportunity|SalesCallPlan|SalesCallLog|WeeklyVisitPlan|SalesVisitSchedule|SalesVisit)/i.test(m)
  },
  {
    domain: '6. Giao Hàng & Logistics (Logistics & Delivery - TRS)',
    match: m => /^(DeliveryOrder|DeliveryOrderLine|DeliveryTrip|DeliveryStop|ProofOfDelivery|Driver|Vehicle|ReturnOrder|ReturnOrderLine)/i.test(m)
  },
  {
    domain: '7. Tài Chính, Kế Toán & Thuế (Finance & Accounting - FIN)',
    match: m => /^(ARInvoice|ARInvoiceLine|ARPayment|APInvoice|APInvoiceLine|APPayment|JournalEntry|JournalLine|ChartOfAccount|GeneralLedger|PeriodClose|FiscalYear|BankStatement|BankTransaction|BankTransactionMatch|TaxDeclaration|TaxDocument|TaxRate)/i.test(m)
  },
  {
    domain: '8. Quản Lý Tem Rượu (Wine Stamp - STP)',
    match: m => /^(WineStampPurchase|WineStampUsage|WineStampInventory)/i.test(m)
  },
  {
    domain: '9. Quan Hệ Khách Hàng & CSKH (CRM & Support)',
    match: m => /^(CustomerContact|CustomerAddress|CustomerTag|CustomerTagOnCustomer|CustomerActivity|TastingEvent|TastingEventAttendee|TastingEventGuest|ComplaintTicket|WinePreference)/i.test(m)
  },
  {
    domain: '10. Bán Lẻ & POS & Khách Thân Thiết (POS & Loyalty)',
    match: m => /^(PosSession|POSShift|PosOrder|PosOrderItem|PosPayment|PosCashMovement|LoyaltyMember|LoyaltyReward|LoyaltyTransaction|LoyaltyTier)/i.test(m)
  },
  {
    domain: '11. Vật Phẩm Quảng Cáo (POSM Management)',
    match: m => /^Posm/i.test(m)
  },
  {
    domain: '12. Hợp Đồng & Hồ Sơ Pháp Lý (Contracts & Legal - CNT)',
    match: m => /^(Contract|ContractAmendment|ContractDocument|RegulatedDocument|RegDocFile|RegDocAlert)/i.test(m)
  },
  {
    domain: '13. Đề Nghị Thanh Toán & Ngân Sách (Payment Requests & Budget)',
    match: m => /^(PaymentRequest|PaymentRequestItem|PaymentRequestAttachment|PaymentApprovalLog|DepartmentBudget|BudgetCategory)/i.test(m)
  },
  {
    domain: '14. Nhân Sự & Lao Động (HR & Personnel)',
    match: m => /^(Employee|EmployeeDocument|LaborContract|HealthRecord|EmployeeDependent)/i.test(m)
  },
  {
    domain: '15. Ký Gửi Rượu (Consignment - CSG)',
    match: m => /^Consignment/i.test(m)
  },
  {
    domain: '16. Đề Xuất Chiến Dịch & Báo Giá Đặc Biệt (Proposals)',
    match: m => /^Proposal/i.test(m)
  },
  {
    domain: '17. Chuẩn Vận Hành Doanh Nghiệp (SOP Knowledge Hub)',
    match: m => /^Sop/i.test(m)
  },
  {
    domain: '18. Trí Tuệ Nhân Tạo & Báo Cáo CEO (AI & Analytics)',
    match: m => /^Ai/i.test(m)
  }
];

const domainMap = {};
for (const dr of domainRules) {
  domainMap[dr.domain] = [];
}
domainMap['19. Khác / Unclassified'] = [];

for (const mName of Object.keys(models)) {
  let placed = false;
  for (const dr of domainRules) {
    if (dr.match(mName)) {
      domainMap[dr.domain].push(mName);
      placed = true;
      break;
    }
  }
  if (!placed) {
    domainMap['19. Khác / Unclassified'].push(mName);
  }
}

// Read codebase usage from previous step
const modelAudit = JSON.parse(fs.readFileSync('scratch/model_audit_summary.json', 'utf8'));

const fullDomainReport = [];

for (const [domainName, modelNames] of Object.entries(domainMap)) {
  const domainData = {
    domain: domainName,
    modelCount: modelNames.length,
    models: []
  };

  for (const mName of modelNames) {
    const mData = models[mName];
    const usage = modelAudit.modelsSummary[mName] ? modelAudit.modelsSummary[mName].usage : { filesCount: 0, reads: 0, writes: 0, actions: [] };

    // Identify outgoing foreign key links and targets
    const outgoing = mData.relations.filter(r => !r.isInverse).map(r => ({
      field: r.field,
      targetModel: r.targetModel,
      foreignKeys: r.foreignKeys,
      onDelete: r.onDelete
    }));

    // Identify incoming links
    const incoming = mData.relations.filter(r => r.isInverse).map(r => ({
      field: r.field,
      sourceModel: r.targetModel,
      isArray: r.isArray
    }));

    domainData.models.push({
      name: mName,
      fieldCount: mData.fields.length,
      outgoingLinks: outgoing,
      incomingLinks: incoming,
      usageFilesCount: usage.filesCount,
      actions: usage.actions,
      reads: usage.reads,
      writes: usage.writes
    });
  }

  fullDomainReport.push(domainData);
}

fs.writeFileSync('scratch/full_domain_audit.json', JSON.stringify(fullDomainReport, null, 2));

console.log('--- DOMAIN BREAKDOWN ---');
for (const d of fullDomainReport) {
  console.log(`${d.domain}: ${d.modelCount} models`);
  if (d.domain.includes('Unclassified') && d.modelCount > 0) {
    console.log('  Unclassified models:', d.models.map(m => m.name).join(', '));
  }
}
