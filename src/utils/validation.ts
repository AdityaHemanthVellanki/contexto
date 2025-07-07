import { z } from 'zod';

/**
 * Schema for token usage metrics
 */
export const tokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
});

/**
 * Schema for API usage logging
 */
export const usageLogSchema = z.object({
  callType: z.string().min(1),
  usage: tokenUsageSchema,
  userId: z.string().min(1),
});

/**
 * Schema for pipeline node
 */
export const pipelineNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.unknown()).optional(),
});

/**
 * Schema for pipeline edge
 */
export const pipelineEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

/**
 * Schema for pipeline graph
 */
export const pipelineGraphSchema = z.object({
  nodes: z.array(pipelineNodeSchema),
  edges: z.array(pipelineEdgeSchema),
});

/**
 * Schema for pipeline creation/update
 */
export const pipelineSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  graph: pipelineGraphSchema,
});

/**
 * Schema for pipeline run
 */
export const pipelineRunSchema = z.object({
  prompt: z.string().min(1).max(4000),
});

/**
 * Schema for text refinement
 */
export const refineSchema = z.object({
  text: z.string().min(1).max(8000),
  instructions: z.string().max(1000).optional(),
});

/**
 * Helper function to validate data against schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true, data: T } | { success: false, error: string } {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { success: false, error: 'Validation error' };
  }
}
