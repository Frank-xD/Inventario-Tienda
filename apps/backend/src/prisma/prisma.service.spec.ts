import { describe, expect, it } from 'vitest';
import { opcionesConexion } from './prisma.service.js';

describe('opcionesConexion', () => {
  it('sin sslmode deja la URL igual y sin SSL (Docker local)', () => {
    const url = 'postgresql://tienda:password@database:5432/tienda_db';
    expect(opcionesConexion(url)).toEqual({ connectionString: url });
  });

  it('con sslmode=disable no activa SSL', () => {
    const url = 'postgresql://u:p@host:5432/db?sslmode=disable';
    expect(opcionesConexion(url)).toEqual({ connectionString: url });
  });

  it('con sslmode=require cifra sin validar la CA y quita sslmode de la URL', () => {
    const opciones = opcionesConexion(
      'postgresql://postgres.abc:secreto@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require',
    );
    expect(opciones.ssl).toEqual({ rejectUnauthorized: false });
    expect(opciones.connectionString).toBe(
      'postgresql://postgres.abc:secreto@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
    );
  });

  it('conserva los demás parámetros de la URL', () => {
    const opciones = opcionesConexion('postgresql://u:p@h:5432/db?sslmode=require&application_name=tienda');
    expect(opciones.connectionString).toBe('postgresql://u:p@h:5432/db?application_name=tienda');
  });
});
