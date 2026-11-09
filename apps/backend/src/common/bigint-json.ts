// movimientos_inventario.id es BIGSERIAL y algunas vistas devuelven SUM() como
// bigint. JSON.stringify no sabe serializar BigInt, así que se convierte a
// number (los valores de una tienda están muy lejos de Number.MAX_SAFE_INTEGER).
declare global {
  interface BigInt {
    toJSON(): number;
  }
}

BigInt.prototype.toJSON = function (this: bigint) {
  return Number(this);
};

export {};
