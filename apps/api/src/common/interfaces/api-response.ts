export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  requestId?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  // Field-level validation errors from ZodValidationPipe, when applicable.
  issues?: Record<string, string[]>;
  requestId?: string;
  timestamp: string;
}
