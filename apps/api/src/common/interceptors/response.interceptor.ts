import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import { ApiSuccessResponse } from '../interfaces/api-response';

/**
 * Wraps every successful handler result in the ApiSuccessResponse envelope.
 * Registered once, globally, in main.ts — controllers keep returning plain data.
 *
 * NestInterceptor<In, Out>: the handler produced `In` (T), we emit `Out`.
 * intercept() returns a STREAM that will emit the envelope, hence Observable<...>.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      // A fresh object per response — never mutate something shared.
      map((data) => ({
        success: true as const,
        statusCode: res.statusCode,
        message: 'OK',
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
