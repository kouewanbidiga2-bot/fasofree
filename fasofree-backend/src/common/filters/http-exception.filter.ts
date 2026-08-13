import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] =
      'Une erreur interne est survenue sur le serveur.';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      // Normaliser les différentes formes de réponse d'exception retournées par Nest/TypeORM
      const resp = exceptionResponse as Record<string, unknown>;

      if (Array.isArray(resp.message)) {
        message = resp.message.map((m) => String(m));
      } else if (typeof resp.message === 'string') {
        message = resp.message;
      } else if (typeof resp.error === 'string') {
        message = resp.error;
      }
    }

    // Logger l'erreur côté serveur pour le debugging (sécurisé)
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison */
    if (Number(status) === HttpStatus.INTERNAL_SERVER_ERROR) {
      const safeMessage =
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception);
      this.logger.error(
        `[${request.method}] ${request.url} - Error: ${safeMessage}`,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status ${status} - Message: ${JSON.stringify(
          message,
        )}`,
      );
    }

    // Format standardisé renvoyé à l'application mobile / web
    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: Array.isArray(message) ? message : [message],
    });
  }
}
