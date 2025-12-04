import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';

/**
 * Custom API Response decorator
 */
export function ApiSuccessResponse(
  description: string,
  type?: Type<any> | Function,
) {
  return applyDecorators(
    SwaggerApiResponse({
      status: 200,
      description,
      type,
    }),
  );
}

export function ApiErrorResponse(status: number, description: string) {
  return applyDecorators(
    SwaggerApiResponse({
      status,
      description,
    }),
  );
}

export function ApiStandardResponses() {
  return applyDecorators(
    SwaggerApiResponse({ status: 200, description: 'Success' }),
    SwaggerApiResponse({ status: 400, description: 'Bad Request' }),
    SwaggerApiResponse({ status: 401, description: 'Unauthorized' }),
    SwaggerApiResponse({ status: 403, description: 'Forbidden' }),
    SwaggerApiResponse({ status: 404, description: 'Not Found' }),
    SwaggerApiResponse({ status: 500, description: 'Internal Server Error' }),
  );
}
