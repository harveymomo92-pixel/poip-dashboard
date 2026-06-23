import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor
} from "@nestjs/common";
import {
  Injectable
} from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { map } from "rxjs";
import { getRequestId } from "./request-context.js";

@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = getRequestId(request);

    return next.handle().pipe(
      map((data) => ({
        ok: true,
        data,
        meta: {
          requestId,
          generatedAt: new Date().toISOString()
        }
      }))
    );
  }
}
