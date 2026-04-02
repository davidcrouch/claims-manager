import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  details?: unknown;
  timestamp: string;
  path: string;
  requestId: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] })?.message;
    const msg = Array.isArray(message) ? message.join(', ') : (message as string);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: msg ?? 'An error occurred',
      error: HttpStatus[status] ?? 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request.headers['x-request-id'] as string) ?? uuid(),
    };

    if (typeof exceptionResponse === 'object' && 'details' in exceptionResponse) {
      errorResponse.details = (exceptionResponse as { details?: unknown }).details;
    }

    this.logger.error(
      `HttpExceptionFilter.catch - ${status} ${request.method} ${request.url} - ${msg}`,
    );

    response.status(status).json(errorResponse);
  }
}
