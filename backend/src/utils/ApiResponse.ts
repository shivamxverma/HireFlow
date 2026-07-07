export interface ApiResponseBody<T = any> {
  statusCode: number;
  message: string;
  data: T | null;
  success: boolean;
}

class ApiResponse<T = any> implements ApiResponseBody<T> {
  statusCode: number;
  message: string;
  data: T | null;
  success: boolean;

  constructor(statusCode: number, arg2: T | string | null, arg3?: T | string | null) {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;

    if (typeof arg2 === 'string') {
      this.message = arg2;
      this.data = (arg3 ?? null) as T | null;
    } else {
      this.data = (arg2 ?? null) as T | null;
      this.message = typeof arg3 === 'string' ? arg3 : '';
    }
  }
}

export { ApiResponse };
