import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

/** Códigos de PostgreSQL que traducimos a errores HTTP comprensibles. */
const PG: Record<string, { status: number; message: string }> = {
  '23505': {
    status: HttpStatus.CONFLICT,
    message: 'Ya existe un registro con ese valor único',
  },
  '23503': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Referencia inválida o registro en uso',
  },
  '23514': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Los datos no cumplen una regla de la base de datos',
  },
  '23502': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Falta un dato obligatorio',
  },
};

const PRISMA: Record<string, { status: number; message: string }> = {
  P2002: PG['23505'],
  P2003: PG['23503'],
  P2004: PG['23514'],
  P2011: PG['23502'],
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Registro no encontrado' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const meta = (error.meta ?? {}) as {
      driverAdapterError?: {
        cause?: {
          originalCode?: string;
          originalMessage?: string;
          constraint?: { index?: string };
        };
      };
    };
    const cause = meta.driverAdapterError?.cause;

    // Reglas de negocio de los triggers (RAISE ... USING ERRCODE = 'TD001'):
    // su mensaje ya está escrito para el usuario.
    if (cause?.originalCode === 'TD001' && cause.originalMessage) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: cause.originalMessage,
        code: cause.originalCode,
      });
    }

    const mapped =
      (cause?.originalCode && PG[cause.originalCode]) || PRISMA[error.code];

    if (!mapped) {
      this.logger.error(error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno de base de datos',
      });
    }

    return res.status(mapped.status).json({
      statusCode: mapped.status,
      message: mapped.message,
      code: cause?.originalCode ?? error.code,
      constraint: cause?.constraint?.index,
    });
  }
}
