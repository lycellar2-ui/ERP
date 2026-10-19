import fs from 'fs';

const filesToCheck = [
  'src/app/dashboard/returns/actions.ts',
  'src/app/dashboard/contracts/actions.ts',
  'src/app/dashboard/crm/actions.ts',
  'src/app/dashboard/payment-requests/actions.ts',
  'src/app/dashboard/proposals/actions.ts',
  'src/app/dashboard/sales/actions.ts',
  'src/app/dashboard/warehouse/actions.ts',
  'src/app/dashboard/warehouse/actions-do.ts',
  'src/app/dashboard/warehouse/actions-gr.ts'
];

for (const file of filesToCheck) {
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    console.log(`\n=== ${file} ===`);
    
    // Check for returns
    if (file.includes('returns')) {
      console.log('Return lines created:', /returnOrderLine|lines:\s*\{/i.test(text));
      console.log('Quarantine lot handled:', /quarantine/i.test(text));
      console.log('Credit note handled:', /creditNote/i.test(text));
    }
    
    // Check for proposals
    if (file.includes('proposals')) {
      console.log('Proposal attachments:', /proposalAttachment|attachments:\s*\{/i.test(text));
      console.log('Proposal price items:', /proposalPriceItem|priceItems:\s*\{/i.test(text));
      console.log('Proposal approval logs:', /proposalApprovalLog|approvalLogs:\s*\{/i.test(text));
    }

    // Check for payment requests
    if (file.includes('payment-requests')) {
      console.log('Payment attachments:', /paymentRequestAttachment|attachments:\s*\{/i.test(text));
      console.log('Payment items:', /paymentRequestItem|items:\s*\{/i.test(text));
      console.log('Approval logs:', /paymentApprovalLog|approvalLogs:\s*\{/i.test(text));
      console.log('Budget deduction:', /budget/i.test(text));
    }

    // Check for CRM
    if (file.includes('crm')) {
      console.log('Tasting attendees:', /attendee|tastingEventAttendee|tastingEventGuest/i.test(text));
      console.log('Complaint tickets:', /complaintTicket/i.test(text));
      console.log('Wine preferences:', /winePreference/i.test(text));
    }

    // Check for contracts
    if (file.includes('contracts')) {
      console.log('RegDocAlert:', /regDocAlert|alerts:\s*\{/i.test(text));
      console.log('Amendments:', /contractAmendment/i.test(text));
    }

    // Check for DO
    if (file.includes('actions-do')) {
      console.log('StockLot deduction:', /stockLot\.update/i.test(text));
      console.log('StockMovement creation:', /stockMovement\.create/i.test(text));
    }
  } else {
    console.log(`File NOT found: ${file}`);
  }
}
