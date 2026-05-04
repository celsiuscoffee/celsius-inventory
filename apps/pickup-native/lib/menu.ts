import { supabase } from "./supabase";

export type Category = {
  id: string;
  name: string;
  slug: string;
  position: number;
};

export type ModifierOption = {
  id: string;
  label: string;
  priceDelta: number;
  isDefault: boolean;
};

export type ModifierGroup = {
  id: string;
  name: string;
  multiSelect: boolean;
  options: ModifierOption[];
};

export type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  modifiers: ModifierGroup[];
};

export async function fetchMenu(): Promise<{ categories: Category[]; products: Product[] }> {
  const [{ data: cats, error: catErr }, { data: prods, error: prodErr }] = await Promise.all([
    supabase.from("categories").select("id,name,slug,position").order("position"),
    supabase
      .from("products")
      .select("id,name,category,description,price,image_url,is_available,is_featured,modifiers")
      .eq("brand_id", "brand-celsius")
      .order("name"),
  ]);
  if (catErr) throw catErr;
  if (prodErr) throw prodErr;
  return {
    categories: (cats ?? []) as Category[],
    products: ((prods ?? []) as Product[]).map((p) => ({
      ...p,
      modifiers: Array.isArray(p.modifiers) ? p.modifiers : [],
    })),
  };
}

export async function fetchOrder(orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,status,total,pickup_time,store_id,items,created_at,payment_method,payment_status")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  return data;
}
