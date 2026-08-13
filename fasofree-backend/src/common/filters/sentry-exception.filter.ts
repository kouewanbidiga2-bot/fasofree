import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 🚨 Capture dans Sentry uniquement s'il s'agit d'une erreur 500 ou d'un crash imprévu
    if (status >= 500) {
      Sentry.captureException(exception, {
        extra: {
          url: request.url,
          method: request.method,
          body: request.body,
          headers: request.headers,
          user: request.user || 'Non authentifié',
        },
      });

      this.logger.error(
        `[500 ERROR] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const responseMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: 500, message: 'Erreur interne du serveur' };

    response
      .status(status)
      .json(
        typeof responseMessage === 'object'
          ? responseMessage
          : { statusCode: status, message: responseMessage },
      );
  }
}
