/**
 * Projects Tool - Backward Compatibility Layer
 *
 * This file maintains backward compatibility by re-exporting the modular
 * project operations. The actual implementation has been refactored into
 * separate modules in the ./projects/ directory.
 *
 * Refactored from 1,053-line god module into focused, single-responsibility modules:
 * - validation.ts: Input validation and hierarchy validation
 * - response-formatter.ts: Response creation and formatting
 * - crud.ts: Basic CRUD operations (list, get, create, update, delete, archive)
 * - hierarchy.ts: Complex tree operations (children, tree, breadcrumb, move)
 * - sharing.ts: Link sharing operations
 * - index.ts: Main orchestration and tool registration
 */

export { registerProjectsTool } from './projects/index';
