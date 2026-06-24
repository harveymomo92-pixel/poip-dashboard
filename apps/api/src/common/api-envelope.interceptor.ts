import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor
} from "@nestjs/common";
import {
  Injectable,
  Logger
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { finalize, map } from "rxjs";
import { getRequestId } from "./request-context.js";

interface RequestWithPrincipal extends Request {
  readonly user?: { readonly id?: string };
}

@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HttpRequest");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = getRequestId(request);
    const startedAt = Date.now();

    return next
      .handle()
      .pipe(
        map((data) => ({
          ok: true,
          data,
          meta: {
            requestId,
            generatedAt: new Date().toISOString()
          }
        })),
        finalize(() => {
          this.logger.log(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              service: "api",
              environment: process.env.NODE_ENV ?? "development",
              requestId,
              userId: request.user?.id ?? null,
              method: request.method,
              route: request.path,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt
            })
          );
        })
      );
  }
}
