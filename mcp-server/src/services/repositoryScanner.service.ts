import * as fs from 'fs';
import * as path from 'path';

import minimatch from 'minimatch';
import { z } from 'zod';

import logger from '@/utils/logger';
import { McpApplicationError } from '@/core/mcp-types';

// Define interfaces within the service file for now
// Consider moving to a dedicated types file later (e.g., src/types/repository.types.ts)
export interface TraversalOptions {
  maxDepth?: number;
  excludePatterns?: string[];
  followSymlinks?: boolean;
  includeHidden?: boolean;
  // Concurrency, gitAwareMode, onProgress etc. to be added later
}

export interface TraversedFile {
  path: string;         // Full path
  relativePath: string; // Path relative to the scanned root
  name: string;         // File/directory name
  ext: string;          // File extension (including dot)
  depth: number;        // Directory depth relative to root
  size?: number;        // Size in bytes
  isSymlink?: boolean;  // Is it a symbolic link?
  isDirectory?: boolean;// Is it a directory?
  isFile?: boolean;     // Is it a file?
  lastModified?: Date; // Last modification time
}

const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.DS_Store'
];

const DEFAULT_MAX_DEPTH = 20;

export class RepositoryScannerService {

  constructor() {
    // If logging needs context, use logger.child() or pass logger instance
    logger.info('RepositoryScannerService initialized');
  }

  private shouldExclude(relativePath: string, patterns: string[] = []): boolean {
    // Normalize path separators for consistent matching
    const normalizedPath = relativePath.replace(/\\/g, '/');
    return patterns.some(pattern => minimatch(normalizedPath, pattern, { dot: true }));
  }

  async scanRepository(
    repositoryPath: string,
    options: TraversalOptions = {}
  ): Promise<TraversedFile[]> {
    const absoluteRepoPath = path.resolve(repositoryPath);

    logger.info(`Starting repository scan at: ${absoluteRepoPath}`);

    if (!fs.existsSync(absoluteRepoPath)) {
      throw new McpApplicationError(`Repository path does not exist: ${absoluteRepoPath}`, 'NOT_FOUND');
    }

    try {
      const stats = await fs.promises.stat(absoluteRepoPath);
      if (!stats.isDirectory()) {
        throw new McpApplicationError(`Repository path is not a directory: ${absoluteRepoPath}`, 'VALIDATION_ERROR');
      }
    } catch (error: any) {
        logger.error(`Error accessing repository path ${absoluteRepoPath}: ${error.message}`);
        throw new McpApplicationError(`Failed to access repository path: ${error.message}`, 'ACCESS_ERROR', error);
    }

    const visitedPaths = new Set<string>();
    const result: TraversedFile[] = [];
    const mergedOptions: TraversalOptions = {
        maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
        excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS, ...(options.excludePatterns ?? [])],
        followSymlinks: options.followSymlinks ?? false,
        includeHidden: options.includeHidden ?? false,
    };

    await this.traverseDirectoryRecursive(
      absoluteRepoPath, // rootPath
      absoluteRepoPath, // currentPath starts at root
      result,
      mergedOptions,
      0, // initial depth
      visitedPaths
    );

    logger.info(`Repository scan complete. Found ${result.length} files/directories.`);
    return result;
  }

  private async traverseDirectoryRecursive(
    rootPath: string,
    currentPath: string,
    result: TraversedFile[],
    options: TraversalOptions,
    depth: number,
    visitedPaths: Set<string>
  ): Promise<void> {
    // Base case: Check depth limit
    if (depth > (options.maxDepth ?? Infinity)) {
      logger.debug(`Max depth (${options.maxDepth}) reached at: ${currentPath}`);
      return;
    }

    // Base case: Prevent infinite loops with visited paths (especially for symlinks)
    // Using realpath to resolve symlinks before adding to visited set
    try {
        const realCurrentPath = await fs.promises.realpath(currentPath);
        if (visitedPaths.has(realCurrentPath)) {
            logger.warn(`Already visited path (possible symlink loop): ${currentPath} -> ${realCurrentPath}`);
            return;
        }
        visitedPaths.add(realCurrentPath);
    } catch (error: any) { // Handle potential errors during realpath (e.g., broken symlink)
        logger.warn(`Could not resolve real path for ${currentPath}: ${error.message}`);
        // Decide if we should stop or continue for the non-resolved path
        if (visitedPaths.has(currentPath)) return; // Still check the non-resolved path
        visitedPaths.add(currentPath);
    }

    let dirents: fs.Dirent[] = [];
    try {
      dirents = await fs.promises.readdir(currentPath, { withFileTypes: true });
    } catch (error: any) {
      logger.error(`Error reading directory ${currentPath}:`, error);
      return; // Cannot proceed if directory is unreadable
    }

    for (const dirent of dirents) {
      const entryPath = path.join(currentPath, dirent.name);
      const relativePath = path.relative(rootPath, entryPath);

      // Skip hidden files/dirs unless explicitly included
      if (!options.includeHidden && dirent.name.startsWith('.')) {
        continue;
      }

      // Check exclusion patterns
      if (this.shouldExclude(relativePath, options.excludePatterns)) {
        logger.debug(`Excluding path based on pattern: ${relativePath}`);
        continue;
      }

      let stats: fs.Stats | null = null;
      const isSymlink = dirent.isSymbolicLink();
      const targetPath = entryPath; // Path to stat (could be symlink target)

      try {
        if (isSymlink) {
            // If following symlinks, stat the target, otherwise stat the link itself
            if (options.followSymlinks) {
                // Note: fs.promises.stat follows symlinks by default
                stats = await fs.promises.stat(entryPath);
                // We might need the real path of the target later if it's a directory
                // targetPath = await fs.promises.realpath(entryPath); // This could be redundant if stat works
            } else {
                // Use lstat to get info about the link itself
                stats = await fs.promises.lstat(entryPath);
            }
        } else {
            stats = await fs.promises.stat(entryPath);
        }
      } catch (error: any) {
        logger.warn(`Could not get stats for ${entryPath}: ${error.message}`);
        continue; // Skip entry if we cannot get stats
      }

      if (!stats) continue; // Should not happen if try/catch works, but for type safety

      const traversedEntry: TraversedFile = {
        path: entryPath,
        relativePath,
        name: dirent.name,
        ext: path.extname(dirent.name),
        depth,
        size: stats.size,
        isSymlink,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        lastModified: stats.mtime,
      };

      // Add the entry (file or directory, or link if not following)
      result.push(traversedEntry);
      // logger.debug(`Added entry: ${traversedEntry.relativePath} (isFile: ${traversedEntry.isFile}, isDir: ${traversedEntry.isDirectory})`);

      // If it's a directory, recurse
      if (stats.isDirectory()) {
         await this.traverseDirectoryRecursive(
            rootPath,
            entryPath, // Recurse into the directory path
            result,
            options,
            depth + 1,
            visitedPaths // Pass the same visited set down
         );
      }
       // Note: If followSymlinks is true and it's a symlink to a directory, stats.isDirectory() should be true
       // and recursion will happen automatically.
       // If followSymlinks is false, stats.isDirectory() will be false for a symlink, so no recursion.
    }
  }
}

// Remove singleton export
// const repositoryScannerService = new RepositoryScannerService();
// export default repositoryScannerService;

// Export the class directly
// No default export needed if only exporting the class 