# Trade Visit Multi-Customer Proposal (`TRADE_VISIT`)

## Goal
Implement the `TRADE_VISIT` proposal type modeled on `INTERNAL_TRAINING` allowing multiple customers in a single proposal, each with its own wine SKU list, bottle quantities, optional visit date and purpose, bilingual A4 print with `rowspan`, and bulk/single 0 VND sample Sales Order generation.

## Tasks
- [x] Task 1: Add `TRADE_VISIT` category labels, `TradeVisitScopeData` types, `parseTradeVisitScope`, and `ApprovalMatrix` default routing (`constants.ts`).
- [x] Task 2: Update `proposals/actions.ts` (`resolveProposalCategory`, `getCreatableProposalCategories`, `getProposals`, `getProposalDetail`, `createProposal` role enforcement, `syncProposalToCustomerPriceRules` guard).
- [x] Task 3: Update `sales/actions.ts` and `CreateSODrawer.tsx` (`getProposalWithItemsForSO`, `getApprovedProposalsForSO`, `createBulkTradeVisitDraftSOs` modular boundary).
- [x] Task 4: Update `ProposalsClient.tsx` (multi-customer Trade Visit builder in `CreateDrawer`, creatable category filter, `DetailDrawer` bulk & per-customer SO creation, bilingual A4 print with `rowspan`).
- [x] Task 5: Update `docs/modules/proposals-approval.md` and `docs/modules/sales-allocation.md` (Docs Sync Protocol).
- [x] Task 6: Verify TypeScript (`npx tsc --noEmit`), tests (`npm test`), and P0 Anti-Emoji/Purple Ban checks.
