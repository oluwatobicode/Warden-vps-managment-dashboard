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
  issues?: Record<string, string[]>;
  timestamp: string;
}
