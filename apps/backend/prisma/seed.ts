/**
 * Datos de ejemplo para desarrollo. Solo se ejecuta sobre una base vacía.
 *
 * Todo pasa por las mismas tablas que usa la app: el stock sale de las
 * compras (triggers), los lotes de las fechas de vencimiento y las ventas
 * de días anteriores se registran en cajas ya cerradas.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DIA = 24 * 60 * 60 * 1000;
const HORA = 60 * 60 * 1000;
const ahora = new Date();
// Fecha calendario de la tienda (La Paz = UTC-4 todo el año), a medianoche UTC.
const hoyLaPaz = new Date(
  new Date(ahora.getTime() - 4 * HORA).toISOString().slice(0, 10),
);
const diasDesdeHoy = (n: number) => new Date(hoyLaPaz.getTime() + n * DIA);
const fechaISO = (d: Date) => d.toISOString().slice(0, 10);
/** 08:00 en La Paz del día indicado; hoy nunca queda en el futuro. */
const aperturaDelDia = (d: number) => {
  const apertura = new Date(diasDesdeHoy(d).getTime() + 12 * HORA);
  return d === 0 && apertura > ahora
    ? new Date(ahora.getTime() - 2 * HORA)
    : apertura;
};

// Generador pseudoaleatorio determinista para que el seed sea reproducible.
let semilla = 42;
const azar = () =>
  ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
const entre = (min: number, max: number) =>
  Math.floor(azar() * (max - min + 1)) + min;

type ProductoSeed = {
  codigo: string | null;
  nombre: string;
  categoria: string;
  proveedor: string;
  precio: number;
  costo: number;
  minimo: number;
  /** Unidades (o kg) de la compra inicial. */
  compra: number;
  /** Por defecto se vende por unidad. */
  unidad?: 'kg';
  /** Días hasta el vencimiento del lote comprado (si vence). */
  vence?: number;
};

const proveedores = [
  { nombre: 'Distribuidora El Alto', telefono: '+591 71234567' },
  { nombre: 'Lácteos del Valle', telefono: '+591 72345678' },
  { nombre: 'Panadería Doña Rosa', telefono: '+591 73456789' },
  { nombre: 'Limpieza Total SRL', telefono: '+591 74567890' },
];

const productos: ProductoSeed[] = [
  {
    codigo: '7771234000011',
    nombre: 'Agua sin gas 2L',
    categoria: 'Bebidas',
    proveedor: 'Distribuidora El Alto',
    precio: 8,
    costo: 5.5,
    minimo: 12,
    compra: 60,
  },
  {
    codigo: '7771234000028',
    nombre: 'Gaseosa cola 2L',
    categoria: 'Bebidas',
    proveedor: 'Distribuidora El Alto',
    precio: 14,
    costo: 10,
    minimo: 10,
    compra: 48,
  },
  {
    codigo: '7771234000035',
    nombre: 'Jugo de durazno 1L',
    categoria: 'Bebidas',
    proveedor: 'Distribuidora El Alto',
    precio: 10,
    costo: 7,
    minimo: 6,
    compra: 12,
    vence: 5,
  },
  {
    codigo: '7771234000042',
    nombre: 'Leche entera 1L',
    categoria: 'Lácteos',
    proveedor: 'Lácteos del Valle',
    precio: 7.5,
    costo: 5.8,
    minimo: 10,
    compra: 40,
    vence: 4,
  },
  {
    codigo: '7771234000059',
    nombre: 'Yogur bebible frutilla 1L',
    categoria: 'Lácteos',
    proveedor: 'Lácteos del Valle',
    precio: 12,
    costo: 9,
    minimo: 6,
    compra: 18,
    vence: -1,
  },
  {
    codigo: '7771234000066',
    nombre: 'Queso fresco 500g',
    categoria: 'Lácteos',
    proveedor: 'Lácteos del Valle',
    precio: 28,
    costo: 21,
    minimo: 4,
    compra: 10,
    vence: 12,
  },
  {
    codigo: null,
    nombre: 'Marraqueta (unidad)',
    categoria: 'Panadería',
    proveedor: 'Panadería Doña Rosa',
    precio: 0.5,
    costo: 0.3,
    minimo: 40,
    compra: 400,
  },
  {
    codigo: null,
    nombre: 'Pan integral (unidad)',
    categoria: 'Panadería',
    proveedor: 'Panadería Doña Rosa',
    precio: 1,
    costo: 0.6,
    minimo: 20,
    compra: 150,
  },
  {
    codigo: '7771234000073',
    nombre: 'Arroz 1kg',
    categoria: 'Abarrotes',
    proveedor: 'Distribuidora El Alto',
    precio: 9,
    costo: 6.8,
    minimo: 10,
    compra: 50,
  },
  {
    codigo: '7771234000080',
    nombre: 'Azúcar 1kg',
    categoria: 'Abarrotes',
    proveedor: 'Distribuidora El Alto',
    precio: 8,
    costo: 6,
    minimo: 10,
    compra: 40,
  },
  // A granel: se venden por peso (precio por kg, cantidades con decimales).
  {
    codigo: null,
    nombre: 'Arroz a granel',
    categoria: 'Abarrotes',
    proveedor: 'Distribuidora El Alto',
    precio: 8.5,
    costo: 6.2,
    minimo: 5,
    compra: 46,
    unidad: 'kg',
  },
  {
    codigo: null,
    nombre: 'Azúcar a granel',
    categoria: 'Abarrotes',
    proveedor: 'Distribuidora El Alto',
    precio: 7.5,
    costo: 5.6,
    minimo: 5,
    compra: 46,
    unidad: 'kg',
  },
  {
    codigo: '7771234000097',
    nombre: 'Aceite vegetal 900ml',
    categoria: 'Abarrotes',
    proveedor: 'Distribuidora El Alto',
    precio: 16,
    costo: 12.5,
    minimo: 6,
    compra: 14,
  },
  {
    codigo: '7771234000103',
    nombre: 'Fideo tallarín 400g',
    categoria: 'Abarrotes',
    proveedor: 'Distribuidora El Alto',
    precio: 6,
    costo: 4.2,
    minimo: 10,
    compra: 45,
  },
  {
    codigo: '7771234000110',
    nombre: 'Detergente en polvo 1kg',
    categoria: 'Limpieza',
    proveedor: 'Limpieza Total SRL',
    precio: 22,
    costo: 16,
    minimo: 4,
    compra: 15,
  },
  {
    codigo: '7771234000127',
    nombre: 'Lavavajillas 500ml',
    categoria: 'Limpieza',
    proveedor: 'Limpieza Total SRL',
    precio: 11,
    costo: 7.5,
    minimo: 4,
    compra: 6,
  },
  {
    codigo: '7771234000134',
    nombre: 'Papel higiénico x4',
    categoria: 'Limpieza',
    proveedor: 'Limpieza Total SRL',
    precio: 13,
    costo: 9.5,
    minimo: 6,
    compra: 24,
  },
];

async function main() {
  if ((await prisma.categoria.count()) > 0) {
    console.log('La base ya tiene datos: seed omitido.');
    return;
  }

  // Catálogo
  const categoriaId = new Map<string, number>();
  for (const nombre of [...new Set(productos.map((p) => p.categoria))]) {
    const c = await prisma.categoria.create({ data: { nombre } });
    categoriaId.set(nombre, c.id);
  }
  const proveedorId = new Map<string, number>();
  for (const p of proveedores) {
    const prov = await prisma.proveedor.create({ data: p });
    proveedorId.set(p.nombre, prov.id);
  }
  const productoId = new Map<string, number>();
  for (const p of productos) {
    const creado = await prisma.producto.create({
      data: {
        codigoBarras: p.codigo,
        nombre: p.nombre,
        categoriaId: categoriaId.get(p.categoria)!,
        proveedorId: proveedorId.get(p.proveedor)!,
        precio: p.precio,
        costo: p.costo,
        stockMinimo: p.minimo,
        unidadMedida: p.unidad ?? 'unidad',
      },
    });
    productoId.set(p.nombre, creado.id);
  }

  // Compras hace 15 días: los triggers suman stock, fijan el costo y crean lotes.
  for (const [nombreProveedor, provId] of proveedorId) {
    const lineas = productos.filter((p) => p.proveedor === nombreProveedor);
    const compra = await prisma.compra.create({
      data: {
        proveedorId: provId,
        fecha: diasDesdeHoy(-15),
        notas: 'Compra inicial',
      },
    });
    await prisma.detalleCompra.createMany({
      data: lineas.map((p) => ({
        compraId: compra.id,
        productoId: productoId.get(p.nombre)!,
        cantidad: p.compra,
        costoUnit: p.costo,
        fechaVencimiento:
          p.vence === undefined
            ? null
            : new Date(fechaISO(diasDesdeHoy(p.vence))),
      })),
    });
  }

  // Ventas de los últimos 14 días, una caja cerrada por día (hoy queda abierta).
  const precios = new Map(productos.map((p) => [productoId.get(p.nombre)!, p]));
  const stock = new Map(
    productos.map((p) => [productoId.get(p.nombre)!, p.compra]),
  );

  for (let d = -13; d <= 0; d++) {
    const apertura = aperturaDelDia(d);
    const caja = await prisma.caja.create({
      data: { abiertaEn: apertura, montoInicial: 100 },
    });

    let efectivo = 0;
    const ventasDelDia = d === 0 ? 4 : entre(3, 8);
    for (let v = 0; v < ventasDelDia; v++) {
      const items: { productoId: number; cantidad: number }[] = [];
      const usados = new Set<number>();
      for (let i = 0; i < entre(1, 3); i++) {
        const id = [...precios.keys()][entre(0, precios.size - 1)];
        const prod = precios.get(id)!;
        // Por kg: de 0,25 a 2 kg en pasos de 250 g.
        const cantidad =
          prod.unidad === 'kg'
            ? entre(1, 8) * 0.25
            : entre(1, prod.precio < 2 ? 10 : 3);
        // Deja algo de stock para que no todo quede agotado.
        if (usados.has(id) || stock.get(id)! - cantidad < 2) continue;
        usados.add(id);
        stock.set(id, stock.get(id)! - cantidad);
        items.push({ productoId: id, cantidad });
      }
      if (items.length === 0) continue;

      const detalles = items.map((it) => {
        const p = precios.get(it.productoId)!;
        return { ...it, precioUnit: p.precio, costoUnit: p.costo };
      });
      const total = detalles.reduce(
        // Igual que la API: cada línea se redondea al centavo.
        (acc, it) => acc + Math.round(it.cantidad * it.precioUnit * 100) / 100,
        0,
      );
      const metodoPago = azar() < 0.65 ? 'efectivo' : 'transferencia';
      if (metodoPago === 'efectivo') efectivo += total;

      await prisma.venta.create({
        data: {
          cajaId: caja.id,
          // Hoy: ventas entre la apertura y ahora. Días anteriores: cada 45 min.
          fecha:
            d === 0
              ? new Date(
                  apertura.getTime() +
                    ((v + 1) * (ahora.getTime() - apertura.getTime())) /
                      (ventasDelDia + 1),
                )
              : new Date(apertura.getTime() + (v + 1) * 45 * 60 * 1000),
          metodoPago,
          subtotal: new Prisma.Decimal(total.toFixed(2)),
          total: new Prisma.Decimal(total.toFixed(2)),
          detalles: { create: detalles },
        },
      });
    }

    if (d < 0) {
      await prisma.movimientoCaja.create({
        data: {
          cajaId: caja.id,
          tipo: 'egreso',
          monto: 20,
          motivo: 'Bolsas y cambio',
        },
      });
      await prisma.caja.update({
        where: { id: caja.id },
        data: {
          cerradaEn: new Date(apertura.getTime() + 12 * 60 * 60 * 1000),
          // Arqueo con una pequeña diferencia algunos días.
          montoContado: new Prisma.Decimal(
            (100 + efectivo - 20 - (d % 4 === 0 ? 1.5 : 0)).toFixed(2),
          ),
        },
      });
    }
  }

  // Merma de ejemplo (yogur vencido) y un anuncio vigente.
  await prisma.movimientoInventario.create({
    data: {
      productoId: productoId.get('Yogur bebible frutilla 1L')!,
      tipo: 'merma',
      cantidad: -2,
      motivo: 'Envases dañados',
    },
  });
  await prisma.anuncio.create({
    data: {
      texto: '¡Pan recién horneado todos los días desde las 7:00!',
      desde: new Date(fechaISO(diasDesdeHoy(-3))),
      hasta: new Date(fechaISO(diasDesdeHoy(30))),
    },
  });

  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
