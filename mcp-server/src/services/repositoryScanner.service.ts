import fs from 'fs/promises';
import path from 'path';
import { minimatch } from 'minimatch';
import logger from '@/utils/logger';
import { McpApplicationError } from '@/core/mcp-types';

export interface TraversalOptions {
  excludePatterns?: string[]; // Glob patterns for exclusion
  maxDepth?: number;
  followSymlinks?: boolean; 
}

export interface TraversedFile {
  path: string; // Absolute path
  relativePath: string; // Path relative to initial directory
  name: string;
  ext: string;
  depth: number;
  isSymlink?: boolean; 
}

class RepositoryScannerService {
  constructor() {
    logger.info('RepositoryScannerService initialized');
  }

  private isExcluded(filePath: string, initialPath: string, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }
    const relativePath = path.relative(initialPath, filePath);
    for (const pattern of patterns) {
      // Use matchBase:true if patterns are like 'node_modules' instead of '**/node_modules/**'
      // Use dot:true to ensure patterns starting with . match hidden files/dirs
      if (minimatch(relativePath, pattern, { dot: true, matchBase: true })) { 
        logger.debug(`Path ${relativePath} (abs: ${filePath}) excluded by pattern: ${pattern}`);
        return true;
      }
    }
    return false;
  }

  private async traverseDirectoryRecursive(
    dirPath: string,
    initialPath: string,
    currentDepth: number,
    options: TraversalOptions,
    accumulatedFiles: TraversedFile[],
    visitedSymlinks: Set<string> = new Set() 
  ): Promise<void> {
    if (options.maxDepth !== undefined && currentDepth > options.maxDepth) {
      logger.debug(`Max depth ${options.maxDepth} reached at ${dirPath}`);
      return;
    }

    // Check exclusion for the directory itself before reading
    if (this.isExcluded(dirPath, initialPath, options.excludePatterns)) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        // Check exclusion for each entry (file or directory)
        // Important: check exclusion *before* following symlinks or recursing
        if (this.isExcluded(entryPath, initialPath, options.excludePatterns)) {
          continue;
        }

        if (entry.isSymbolicLink() && options.followSymlinks) {
          try {
            const realPath = await fs.realpath(entryPath);
            // Prevent infinite loops
            if (visitedSymlinks.has(realPath)) {
              logger.warn(`Symlink loop detected for ${entryPath} -> ${realPath}. Skipping.`);
              continue;
            }
            // Clone the set for the recursive call to prevent siblings interfering
            const nextVisited = new Set(visitedSymlinks);
            nextVisited.add(realPath);
            
            const linkStats = await fs.lstat(realPath); // Use lstat on realpath to check what it points to
            
            // Record the symlink itself
            accumulatedFiles.push({ 
              path: entryPath,
              relativePath: path.relative(initialPath, entryPath),
              name: entry.name,
              ext: '', // Symlinks don't have extensions themselves
              depth: currentDepth,
              isSymlink: true,
            });

            // If the link points to a directory, traverse it
            if (linkStats.isDirectory()) {
                await this.traverseDirectoryRecursive(
                    realPath, 
                    initialPath,
                    currentDepth + 1, 
                    options,
                    accumulatedFiles,
                    nextVisited 
                );
            } 
            // Note: If it points to a file, we've already recorded the symlink. We don't double-add the file itself here.
            // If specific behaviour is needed for symlinks-to-files, add it here.

          } catch (symlinkError: any) {
            logger.warn(`Could not resolve or stat symlink ${entryPath}: ${symlinkError.message}`);
            // Record the broken symlink maybe? Or just skip.
             accumulatedFiles.push({ 
              path: entryPath,
              relativePath: path.relative(initialPath, entryPath),
              name: entry.name,
              ext: '',
              depth: currentDepth,
              isSymlink: true, // Mark as symlink even if broken
            });
          }
        } else if (entry.isDirectory()) {
          await this.traverseDirectoryRecursive(
            entryPath,
            initialPath,
            currentDepth + 1,
            options,
            accumulatedFiles,
            // Pass visited set only if following symlinks, otherwise pass empty/new set
            options.followSymlinks ? new Set(visitedSymlinks) : new Set() 
          );
        } else if (entry.isFile()) {
          accumulatedFiles.push({
            path: entryPath,
            relativePath: path.relative(initialPath, entryPath),
            name: entry.name,
            ext: path.extname(entry.name),
            depth: currentDepth,
            isSymlink: false,
          });
        }
      }
    } catch (error: any) {
      // Log errors like permission denied but continue traversal if possible
      logger.warn(`Failed to read directory ${dirPath}: ${error.message}`);
    }
  }

  public async scanRepository(
    repoPath: string,
    options: TraversalOptions = {}
  ): Promise<TraversedFile[]> {
    logger.info(`Starting repository scan at: ${repoPath}, options: ${JSON.stringify(options)}`);
    const absoluteRepoPath = path.resolve(repoPath);
    const files: TraversedFile[] = [];

    try {
      const stats = await fs.stat(absoluteRepoPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${absoluteRepoPath}`);
      }
    } catch (error: any) {
      logger.error(`Error accessing repository path ${absoluteRepoPath}: ${error.message}`);
      throw new McpApplicationError(
        `Failed to access repository: ${error.message}`,
        'REPOSITORY_SCAN_ERROR'
      );
    }
    
    const initialVisited = options.followSymlinks ? new Set<string>() : undefined;
    if(initialVisited) initialVisited.add(absoluteRepoPath); // Add root to prevent loops if symlink points back to root

    await this.traverseDirectoryRecursive(absoluteRepoPath, absoluteRepoPath, 0, options, files, initialVisited);
    logger.info(`Repository scan completed. Found ${files.length} files.`);
    return files;
  }
}

const repositoryScannerService = new RepositoryScannerService();
export default repositoryScannerService; 