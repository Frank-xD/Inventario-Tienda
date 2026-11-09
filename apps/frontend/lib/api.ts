export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  minStock: number;
  active: boolean;
  category: Category | null;
}

export interface StatsSummary {
  totalProducts: number;
  totalUnits: number;
  inventoryValue: number;
  lowStock: number;
  byCategory: { category: string; stock: number; value: number }[];
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
