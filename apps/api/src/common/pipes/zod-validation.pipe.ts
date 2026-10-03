import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/**
 * Validates one handler parameter against a Zod schema and hands the handler
 * the PARSED value (trimmed, lowercased, coerced), not the raw one.
 * `implements PipeTransform` is what makes Nest recognise it as a pipe.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const flat = result.error.flatten();
      // Object schemas report per-field under fieldErrors. A bare schema
      // (z.string().uuid() on a param or query) reports under formErrors
      // instead — without this fallback the response said `issues: {}`.
      const issues = Object.keys(flat.fieldErrors).length
        ? flat.fieldErrors
        : { value: flat.formErrors };
      throw new BadRequestException({ message: 'Validation failed', issues });
    }
    return result.data;
  }
}
