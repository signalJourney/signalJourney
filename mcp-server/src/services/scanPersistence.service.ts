import { randomUUID } from 'crypto';

import { RepositoryScanModel, IRepositoryScan } from '@/models/RepositoryScan.model';
import { TraversedFile, TraversalOptions } from '@/services/repositoryScanner.service';
import logger from '@/utils/logger';

class ScanPersistenceService {

  /**
   * Saves a repository scan result.
   * Generates a unique scanId if one isn't provided.
   * Stores files as an embedded array.
   */
  async saveScanResult(
    repoPath: string,
    options: TraversalOptions,
    files: TraversedFile[],
    existingScanId?: string // Optional: for updating a specific scan
  ): Promise<string> {
    const scanId = existingScanId || randomUUID();
    const scanTimestamp = new Date();
    const totalFiles = files.length;

    try {
      // Use findOneAndUpdate with upsert: true to handle both create and update
      // $inc increments version if document exists, $setOnInsert sets initial version
      const result = await RepositoryScanModel.findOneAndUpdate(
        { scanId: scanId }, // Filter to find existing scan
        {
          $set: { // Fields to set on insert or update
            repoPath,
            scanOptions: options,
            files,
            totalFiles,
            scanTimestamp,
          },
          $inc: { version: 1 }, // Increment version on update
          $setOnInsert: { scanId: scanId, version: 1 } // Set initial version only on insert
        },
        {
          upsert: true, // Create if doesn't exist
          new: true, // Return the updated document
          runValidators: true, // Ensure schema validation runs on update
        }
      );

      logger.info(`Scan result ${result.version > 1 ? 'updated' : 'saved'} with ID: ${result.scanId}, Version: ${result.version}`);
      return result.scanId;
    } catch (error: any) {
      logger.error(`Error saving scan result for scanId ${scanId}: ${error.message}`, { error });
      throw new Error(`Failed to save scan result: ${error.message}`);
    }
  }

  /**
   * Retrieves a specific scan result by its ID.
   */
  async getScanResult(scanId: string): Promise<IRepositoryScan | null> {
    try {
      const scan = await RepositoryScanModel.findOne({ scanId });
      if (!scan) {
        logger.warn(`Scan result not found for ID: ${scanId}`);
        return null;
      }
      logger.info(`Retrieved scan result for ID: ${scanId}`);
      return scan;
    } catch (error: any) {
      logger.error(`Error retrieving scan result ${scanId}: ${error.message}`, { error });
      throw new Error(`Failed to retrieve scan result: ${error.message}`);
    }
  }

  /**
   * Lists scan metadata (excluding the large files array).
   * Optionally filters by repository path.
   */
  async listScans(
    repoPath?: string,
    limit = 50,
    skip = 0
  ): Promise<Partial<IRepositoryScan>[]> {
    try {
      const query = repoPath ? { repoPath: repoPath } : {};
      const scans = await RepositoryScanModel.find(query)
        .select('-files') // Exclude the large embedded files array
        .sort({ scanTimestamp: -1 }) // Sort by most recent first
        .skip(skip)
        .limit(limit);
      
      logger.info(`Listed ${scans.length} scans.` + (repoPath ? ` for repo ${repoPath}` : ''));
      return scans;
    } catch (error: any) {
      logger.error(`Error listing scans: ${error.message}`, { error });
      throw new Error(`Failed to list scans: ${error.message}`);
    }
  }

  /**
   * Deletes a scan result by its ID.
   */
  async deleteScanResult(scanId: string): Promise<boolean> {
    try {
      const result = await RepositoryScanModel.deleteOne({ scanId });
      if (result.deletedCount === 0) {
        logger.warn(`Scan result not found for deletion: ${scanId}`);
        return false;
      }
      logger.info(`Successfully deleted scan result: ${scanId}`);
      return true;
    } catch (error: any) {
      logger.error(`Error deleting scan result ${scanId}: ${error.message}`, { error });
      throw new Error(`Failed to delete scan result: ${error.message}`);
    }
  }
}

export default new ScanPersistenceService(); 