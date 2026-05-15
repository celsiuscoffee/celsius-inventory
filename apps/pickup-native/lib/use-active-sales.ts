import { useQuery } from "@tanstack/react-query";
import { fetchActiveSales, type ProductSale } from "./product-sales";

/**
 * Shared cache for active sale-shaped promos. Every screen that
 * renders product prices (menu list, product detail, pair-with cart
 * empty-state, etc.) calls this hook; React Query dedupes the
 * underlying network request and the price strikethrough lights up
 * everywhere at once.
 *
 * 5-min stale time matches the combo cache. Sales rarely change
 * during a session; the stat that does change (current time-of-day)
 * is checked client-side in bestSaleForProduct.
 */
export function useActiveSales(): { sales: ProductSale[] } {
  const { data } = useQuery({
    queryKey: ["active-sales"],
    queryFn: fetchActiveSales,
    staleTime: 5 * 60_000,
  });
  return { sales: data ?? [] };
}
