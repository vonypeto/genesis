import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom application error
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Handle error and format response
 */
export function handleError(error: any): never {
  if (error instanceof AppError) {
    throw new HttpException(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      error.statusCode,
    );
  }

  if (error instanceof HttpException) {
    throw error;
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  throw new HttpException(
    {
      success: false,
      error: 'Internal server error',
    },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

/**
 * Create error response
 */
export function createErrorResponse(message: string, code?: string) {
  return {
    success: false,
    error: message,
    code,
  };
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    message,
  };
}
