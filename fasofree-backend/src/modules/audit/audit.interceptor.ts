import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import type { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { AUDIT_METADATA_KEY, AuditMetadata } from './audited.decorator';

type RequestWithActor = Request & {
  user?: { userId?: string; email?: string; role?: string };
};

/**
 * 🧾 Intercepteur d'audit.
 *
 * - N'agit QUE sur les routes annotées `@Audited(...)` → aucun impact sur les
 *   autres routes.
 * - Journalise après coup : SUCCESS si la route a répondu, ERROR si elle a levé.
 * - Ne modifie ni la requête ni la réponse, et ne lève jamais (fail-safe).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMetadata | undefined>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta || context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithActor>();
    const res = http.getResponse<Response>();

    const base = {
      actorId: req?.user?.userId ?? null,
      actorEmail: req?.user?.email ?? null,
      actorRole: req?.user?.role ?? null,
      action: meta.action,
      entityType: meta.entityType ?? null,
      entityId:
        (req?.params as Record<string, string> | undefined)?.[
          meta.entityParam ?? 'id'
        ] ?? null,
      httpMethod: req?.method ?? null,
      path: req?.originalUrl ?? req?.url ?? null,
      ip: req?.ip ?? null,
      userAgent: req?.headers?.['user-agent'] ?? null,
      payload: {
        ...((req?.query as Record<string, unknown>) ?? {}),
        ...((req?.body as Record<string, unknown>) ?? {}),
        ...((req?.params as Record<string, unknown>) ?? {}),
      },
    };

    return next.handle().pipe(
      tap(() => {
        void this.auditService.record({
          ...base,
          result: 'SUCCESS',
          statusCode: res?.statusCode ?? 200,
        });
      }),
      catchError((err: unknown) => {
        const status =
          (err as { status?: number })?.status ?? res?.statusCode ?? 500;
        void this.auditService.record({
          ...base,
          result: 'ERROR',
          statusCode: status,
          payload: {
            ...base.payload,
            error: (err as Error)?.message ?? 'unknown',
          },
        });
        return throwError(() => err);
      }),
    );
  }
}
