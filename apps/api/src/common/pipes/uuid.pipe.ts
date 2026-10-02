import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/** For every `:id` route param: anything that isn't a UUID is a 400 before the service runs. */
export const UuidPipe = new ZodValidationPipe(z.string().uuid());
