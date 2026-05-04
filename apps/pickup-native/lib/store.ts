import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ModifierSelection = {
  groupId: string;
  groupName: string;
  optionId: string;
  label: string;
  priceDelta: number;
};

export type CartItem = {
  cartId: string;
  productId: string;
  name: string;
  image?: string;
  basePrice: number;
  quantity: number;
  modifiers: ModifierSelection[];
  specialInstructions?: string;
  totalPrice: number;
};

export type AppliedReward = {
  id: string;
  name: string;
  points_required: number;
  discount_type: "flat" | "percent" | "free_item" | "bogo" | "fixed_amount" | "percentage" | "none" | null;
  discount_value: number | null;
  bogo_buy_qty?: number;
  bogo_free_qty?: number;
  free_product_name?: string | null;
};

type AppState = {
  outletId: string | null;
  outletName: string | null;
  cart: CartItem[];
  phone: string | null;
  loyaltyId: string | null;
  appliedReward: AppliedReward | null;

  setOutlet: (id: string, name: string) => void;
  addToCart: (item: Omit<CartItem, "cartId">) => void;
  updateQuantity: (cartId: string, qty: number) => void;
  removeFromCart: (cartId: string) => void;
  clearCart: () => void;
  setPhone: (phone: string) => void;
  setLoyaltyId: (id: string | null) => void;
  setAppliedReward: (reward: AppliedReward | null) => void;
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      outletId: null,
      outletName: null,
      cart: [],
      phone: null,
      loyaltyId: null,
      appliedReward: null,

      setOutlet: (id, name) => set({ outletId: id, outletName: name }),
      addToCart: (item) =>
        set((s) => ({
          cart: [
            ...s.cart,
            { ...item, cartId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          ],
        })),
      updateQuantity: (cartId, qty) =>
        set((s) => ({
          cart: s.cart
            .map((i) =>
              i.cartId === cartId
                ? { ...i, quantity: qty, totalPrice: (i.totalPrice / i.quantity) * qty }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),
      removeFromCart: (cartId) => set((s) => ({ cart: s.cart.filter((i) => i.cartId !== cartId) })),
      clearCart: () => set({ cart: [], appliedReward: null }),
      setPhone: (phone) => set({ phone }),
      setLoyaltyId: (id) => set({ loyaltyId: id }),
      setAppliedReward: (reward) => set({ appliedReward: reward }),
    }),
    {
      name: "celsius-pickup",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        outletId: s.outletId,
        outletName: s.outletName,
        cart: s.cart,
        phone: s.phone,
        loyaltyId: s.loyaltyId,
        appliedReward: s.appliedReward,
      }),
    }
  )
);

export const cartTotal = (cart: CartItem[]) =>
  cart.reduce((sum, i) => sum + i.totalPrice, 0);

export const cartCount = (cart: CartItem[]) =>
  cart.reduce((sum, i) => sum + i.quantity, 0);
