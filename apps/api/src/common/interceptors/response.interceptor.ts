import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
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
    // Only HTTP answers get the envelope; Socket.io replies (live deploy logs) go as they are.
    if (context.getType() !== 'http') return next.handle() as unknown as Observable<ApiSuccessResponse<T>>;
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      // A fresh object per response — never mutate something shared.
      // A file download (StreamableFile) goes out as the raw bytes.
      map((data) =>
        data instanceof StreamableFile
          ? (data as unknown as ApiSuccessResponse<T>)
          : {
              success: true as const,
              statusCode: res.statusCode,
              message: 'OK',
              data,
              timestamp: new Date().toISOString(),
            },
      ),
    );
  }
}
