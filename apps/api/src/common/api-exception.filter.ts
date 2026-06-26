import type {
  ArgumentsHost,
  ExceptionFilter} from "@nestjs/common";
import {
  Catch,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { Request, Response } from "express";
import { getRequestId } from "./request-context.js";

function errorCodeForStatus(status: number): string {
  if (status === HttpStatus.UNAUTHORIZED) return "UNAUTHORIZED";
  if (status === HttpStatus.FORBIDDEN) return "FORBIDDEN";
  if (status === HttpStatus.NOT_FOUND) return "NOT_FOUND";
  if (status === HttpStatus.CONFLICT) return "CONFLICT";
  if (status === HttpStatus.BAD_REQUEST) return "VALIDATION_ERROR";
  return "INTERNAL_ERROR";
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const message =
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null &&
      "message" in exceptionResponse
        ? String((exceptionResponse as { message: unknown }).message)
        : exception instanceof Error
          ? exception.message
          : "Internal error";
    const code =
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null &&
      "code" in exceptionResponse &&
      typeof (exceptionResponse as { code: unknown }).code === "string"
        ? (exceptionResponse as { code: string }).code
        : errorCodeForStatus(status);

    response.status(status).json({
      ok: false,
      error: {
        code,
        message
      },
      meta: {
        requestId: getRequestId(request)
      }
    });
  }
}
