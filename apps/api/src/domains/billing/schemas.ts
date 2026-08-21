import { z } from 'zod';

export const listInvoicesQuerySchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'void']).optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(Number(v ?? '25'), 100))
    .pipe(z.number().int().min(1).max(100)),
});

export const residualsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(Number(v ?? '25'), 100))
    .pipe(z.number().int().min(1).max(100)),
});

export type ListInvoicesQuery = z.output<typeof listInvoicesQuerySchema>;
export type ResidualsQuery = z.output<typeof residualsQuerySchema>;
