import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-response';
import { GENERIC_MESSAGES } from '../constants/messages.config';

/**
 * Turns EVERY thrown error into the ApiErrorResponse envelope.
 *
 * Empty @Catch() = catch everything, not just HttpException. That's what makes
 * "every error looks the same" true: a Prisma crash or a null dereference gets
 * the same shape as a 401 from a guard, instead of falling through to Nest's
 * default handler with a different one.
 *
 * Registered once, globally, in main.ts. This is the one place in the app
 * that writes to `res` directly — a filter IS the response.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number;
    let message: string;
    let issues: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as {
          message?: string | string[];
          issues?: Record<string, string[]>;
        };
        message = Array.isArray(b.message)
          ? b.message.join(', ')
          : (b.message ?? exception.message);
        issues = b.issues;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = GENERIC_MESSAGES.internal_error;
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const envelope: ApiErrorResponse = {
      success: false,
      statusCode: status,
      errorCode:
        exception instanceof Error
          ? exception.constructor.name
          : 'UnknownError',
      message,
      ...(issues && { issues }),
      timestamp: new Date().toISOString(),
    };

    res.status(status).json(envelope);
  }
}
