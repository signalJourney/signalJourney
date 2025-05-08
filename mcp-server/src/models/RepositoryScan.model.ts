import mongoose, { Schema, Document /*, Model*/ } from 'mongoose';

import { TraversedFile } from '@/services/repositoryScanner.service'; // Import TraversedFile

// import { TraversedFile, CodeMetadata } from '@/services/repositoryScanner.service'; // Removed unused import

// Define interface for CodeMetadata document part
interface ICodeMetadata extends Document {
  imports?: string[];
  functions?: string[];
  classes?: string[];
  hasMainGuard?: boolean;
}

// Define interface for TraversedFile document part
interface ITraversedFile extends Document, Omit<TraversedFile, 'codeMetadata'> {
  codeMetadata?: ICodeMetadata | null;
}

// Define interface for the main RepositoryScan document
export interface IRepositoryScan extends Document {
  scanId: string;
  repoPath: string;
  scanTimestamp: Date;
  scanOptions: Record<string, any>; // Store options used for the scan
  totalFiles: number;
  version: number;
  files: ITraversedFile[];
}

// Mongoose Schema Definitions
const CodeMetadataSchema: Schema<ICodeMetadata> = new Schema({
  imports: [String],
  functions: [String],
  classes: [String],
  hasMainGuard: Boolean,
}, { _id: false }); // Don't create separate IDs for this subdocument

const TraversedFileSchema: Schema<ITraversedFile> = new Schema({
  path: { type: String, required: true },
  relativePath: { type: String, required: true },
  name: { type: String, required: true },
  ext: { type: String },
  depth: { type: Number, required: true },
  size: { type: Number },
  isSymlink: { type: Boolean, default: false },
  isDirectory: { type: Boolean, default: false },
  isFile: { type: Boolean, default: true },
  lastModified: { type: Date },
  codeMetadata: { type: CodeMetadataSchema, default: null },
});

// Index common query fields within the files array if needed (can impact write performance)
// TraversedFileSchema.index({ fileType: 1 }); 
// TraversedFileSchema.index({ fileCategory: 1 });

const RepositoryScanSchema: Schema<IRepositoryScan> = new Schema({
  scanId: { type: String, required: true, unique: true, index: true },
  repoPath: { type: String, required: true, index: true },
  scanTimestamp: { type: Date, default: Date.now, index: true },
  scanOptions: { type: Schema.Types.Mixed }, // Store arbitrary options object
  totalFiles: { type: Number, required: true },
  version: { type: Number, default: 1 },
  files: [TraversedFileSchema], // Embed files within the scan document
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps to the scan document itself
});

// Consider adding TTL index if scans should expire automatically
// RepositoryScanSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 * 24 * 30 }); // e.g., expire after 30 days

export const RepositoryScanModel = mongoose.model<IRepositoryScan>('RepositoryScan', RepositoryScanSchema); 