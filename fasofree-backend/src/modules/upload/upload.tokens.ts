/**
 * Injection token for the storage driver.
 * Exported from a separate file to break the circular dependency
 * between upload.module.ts and upload.controller.ts.
 *
 * upload.module  → imports upload.controller (to register it)
 * upload.controller → imports STORAGE_DRIVER from upload.module
 *   ↑ this circular import causes STORAGE_DRIVER to be undefined at runtime
 */
export const STORAGE_DRIVER = 'STORAGE_DRIVER';
