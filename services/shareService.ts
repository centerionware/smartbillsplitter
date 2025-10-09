// services/shareService.ts
// This file acts as an orchestrator, exporting the public API for the share service.
// The business logic is implemented in the components within the shareService/ subdirectory.

export { generateShareText } from './shareService/utils';
export { pollImportedBills, pollOwnedSharedBills } from './shareService/polling';
export { syncSharedBillUpdate, reactivateShare, recreateShareSession } from './shareService/session';
export { generateOneTimeShareLink, generateShareLink } from './shareService/link-generation';
