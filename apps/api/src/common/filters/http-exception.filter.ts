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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) ?? uuid();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message?: string | string[] })?.message;
      const msg = Array.isArray(message) ? message.join(', ') : (message as string);

      response.status(status).json({
        statusCode: status,
        message: msg ?? 'An error occurred',
        error: HttpStatus[status] ?? 'Error',
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
      } satisfies ErrorResponse);
      return;
    }

    const isAxios = (exception as { isAxiosError?: boolean })?.isAxiosError === true;
    const upstreamStatus = (exception as { response?: { status?: number } })?.response?.status;
    let briefMessage: string;

    if (isAxios && upstreamStatus) {
      briefMessage = `Upstream service returned ${upstreamStatus}`;
      this.logger.error(
        `AllExceptionsFilter.catch - upstream ${upstreamStatus} on ${request.method} ${request.url}`,
      );
    } else {
      briefMessage = 'An unexpected error occurred';
      const errMsg = exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `AllExceptionsFilter.catch - unhandled exception on ${request.method} ${request.url}: ${errMsg}`,
        stack,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: briefMessage,
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }
}
