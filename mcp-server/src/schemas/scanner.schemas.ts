// scanner.schemas.ts
// This file contains Zod schemas for validating scanner-related API requests

import { z } from 'zod';

// Schema for scanRepository endpoint
export const ScanRepositoryParamsSchema = z.object({
  repoPath: z.string().min(1).describe('The local file system path to the repository to scan.'),
  excludePatterns: z.array(z.string()).optional().describe('Glob patterns for exclusion (relative to repoPath).'),
  maxDepth: z.number().int().positive().optional().describe('Maximum directory traversal depth.'),
  followSymlinks: z.boolean().optional().default(false).describe('Whether to follow symbolic links.'),
  parseCode: z.boolean().optional().default(true).describe('Whether to perform basic code structure parsing.'),
});

// Infer TypeScript type from the Zod schema
export type ScanRepositoryParams = z.infer<typeof ScanRepositoryParamsSchema>; 