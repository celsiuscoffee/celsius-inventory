import type { Product, ProductCategory } from "@/types/database";

// Sample data for development (mirrors seed.sql)
// Will be replaced with Supabase queries

export const SAMPLE_CATEGORIES: ProductCategory[] = [
  { id: "1", brand_id: "b1", name: "All", slug: "all", sort_order: 0, storehub_category_id: null, is_active: true, created_at: "" },
  { id: "2", brand_id: "b1", name: "Coffee", slug: "coffee", sort_order: 1, storehub_category_id: null, is_active: true, created_at: "" },
  { id: "3", brand_id: "b1", name: "Non-Coffee", slug: "non-coffee", sort_order: 2, storehub_category_id: null, is_active: true, created_at: "" },
  { id: "4", brand_id: "b1", name: "Tea", slug: "tea", sort_order: 3, storehub_category_id: null, is_active: true, created_at: "" },
  { id: "5", brand_id: "b1", name: "Food", slug: "food", sort_order: 4, storehub_category_id: null, is_active: true, created_at: "" },
  { id: "6", brand_id: "b1", name: "Pastry", slug: "pastry", sort_order: 5, storehub_category_id: null, is_active: true, created_at: "" },
];

const base: Omit<Product, "id" | "name" | "sku" | "category" | "price" | "cost" | "modifiers" | "kitchen_station"> = {
  brand_id: "b1",
  storehub_id: null,
  tags: [],
  description: null,
  image_url: null,
  image_urls: [],
  online_price: null,
  tax_code: null,
  tax_rate: 0,
  pricing_type: "fixed",
  track_stock: false,
  stock_level: null,
  is_available: true,
  is_featured: false,
  synced_at: null,
  created_at: "",
  updated_at: "",
};

export const SAMPLE_PRODUCTS: Product[] = [
  {
    ...base, id: "p1", name: "Iced Latte", sku: "COF001", category: "coffee", price: 1400, cost: 450, kitchen_station: "Bar",
    modifiers: [
      { group_name: "Size", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 200 }] },
      { group_name: "Milk", is_required: false, min_select: 0, max_select: 1, options: [{ name: "Oat Milk", price: 200 }, { name: "Soy Milk", price: 150 }] },
      { group_name: "Sugar", is_required: false, min_select: 0, max_select: 1, options: [{ name: "Less Sugar", price: 0 }, { name: "No Sugar", price: 0 }] },
    ],
  },
  {
    ...base, id: "p2", name: "Hot Latte", sku: "COF002", category: "coffee", price: 1300, cost: 400, kitchen_station: "Bar",
    modifiers: [
      { group_name: "Size", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 200 }] },
      { group_name: "Milk", is_required: false, min_select: 0, max_select: 1, options: [{ name: "Oat Milk", price: 200 }, { name: "Soy Milk", price: 150 }] },
    ],
  },
  {
    ...base, id: "p3", name: "Americano", sku: "COF003", category: "coffee", price: 1100, cost: 300, kitchen_station: "Bar",
    modifiers: [
      { group_name: "Temp", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Iced", price: 0 }, { name: "Hot", price: 0 }] },
      { group_name: "Size", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 200 }] },
    ],
  },
  {
    ...base, id: "p4", name: "Cappuccino", sku: "COF004", category: "coffee", price: 1400, cost: 450, kitchen_station: "Bar",
    modifiers: [
      { group_name: "Size", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 200 }] },
    ],
  },
  {
    ...base, id: "p5", name: "Mocha", sku: "COF005", category: "coffee", price: 1600, cost: 500, kitchen_station: "Bar",
    modifiers: [
      { group_name: "Temp", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Iced", price: 0 }, { name: "Hot", price: 0 }] },
      { group_name: "Size", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 200 }] },
    ],
  },
  {
    ...base, id: "p6", name: "Matcha Latte", sku: "NCF001", category: "non-coffee", price: 1500, cost: 500, kitchen_station: "Bar",
    modifiers: [
      { group_name: "Temp", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Iced", price: 0 }, { name: "Hot", price: 0 }] },
      { group_name: "Size", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 200 }] },
      { group_name: "Milk", is_required: false, min_select: 0, max_select: 1, options: [{ name: "Oat Milk", price: 200 }] },
    ],
  },
  {
    ...base, id: "p7", name: "Chocolate", sku: "NCF002", category: "non-coffee", price: 1400, cost: 450, kitchen_station: "Bar",
    modifiers: [
      { group_name: "Temp", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Iced", price: 0 }, { name: "Hot", price: 0 }] },
      { group_name: "Size", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 200 }] },
    ],
  },
  { ...base, id: "p8",  name: "Earl Grey",         sku: "TEA001", category: "tea",    price: 1000, cost: 250, kitchen_station: "Bar", modifiers: [{ group_name: "Temp", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Iced", price: 0 }, { name: "Hot", price: 0 }] }] },
  { ...base, id: "p9",  name: "Jasmine Green Tea",  sku: "TEA002", category: "tea",    price: 1000, cost: 250, kitchen_station: "Bar", modifiers: [{ group_name: "Temp", is_required: true, min_select: 1, max_select: 1, options: [{ name: "Iced", price: 0 }, { name: "Hot", price: 0 }] }] },
  { ...base, id: "p10", name: "Chicken Sandwich",   sku: "FOD001", category: "food",   price: 1800, cost: 700, kitchen_station: "Kitchen", modifiers: [] },
  { ...base, id: "p11", name: "Egg Croissant",      sku: "FOD002", category: "food",   price: 1500, cost: 600, kitchen_station: "Kitchen", modifiers: [] },
  { ...base, id: "p12", name: "Butter Croissant",   sku: "PST001", category: "pastry", price: 900,  cost: 350, kitchen_station: "Kitchen", modifiers: [] },
  { ...base, id: "p13", name: "Banana Bread",       sku: "PST002", category: "pastry", price: 1000, cost: 400, kitchen_station: "Kitchen", modifiers: [] },
];
