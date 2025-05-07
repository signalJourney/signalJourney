import mongoose, { Schema, Document, Model } from 'mongoose';

// Define the interface for the Resource document
export interface IResource extends Document {
  id: string; // Use default _id as string or define custom if needed
  name: string;
  type: string;
  data: Record<string, any>; // Flexible data structure
  metadata?: Record<string, any>;
  ownerId?: string; // Optional: if resources are user-owned
  createdAt: Date;
  updatedAt: Date;
}

// Define the Mongoose schema
const ResourceSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true }, // Using Mixed for flexibility
    metadata: { type: Schema.Types.Mixed },
    ownerId: { type: String, index: true }, // Index if frequently queried
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { // Customize JSON output if needed
      transform(doc, ret) {
        ret.id = ret._id; // Map _id to id
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// Define the Model type
export interface IResourceModel extends Model<IResource> {}

// Create and export the Mongoose model
// Use mongoose.models to prevent OverwriteModelError in watch mode/testing
const Resource: IResourceModel = mongoose.models.Resource as IResourceModel || mongoose.model<IResource, IResourceModel>('Resource', ResourceSchema);

export default Resource;
// Export the interface type as well
export type Resource = IResource; 