// The envelope every API response is wrapped in (ResponseInterceptor and
// HttpExceptionFilter in apps/api). Hooks return `data`, never the envelope.

export interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorBody {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  /** 400 validation errors: field → messages. Mapped onto form fields. */
  issues?: Record<string, string[]>;
  timestamp: string;
}
