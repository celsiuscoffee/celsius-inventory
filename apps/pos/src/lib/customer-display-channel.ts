/**
 * BroadcastChannel bridge between POS Register and Customer Display.
 *
 * Register broadcasts cart state → Customer Display listens and renders.
 */

export type CustomerDisplayData = {
  items: { name: string; qty: number; amount: number; modifiers?: string }[];
  subtotal: number;
  serviceCharge: number;
  discount: number;
  total: number;
  outletId: string;
  outletName: string;
  status: "idle" | "ordering" | "payment" | "complete";
  orderNumber?: string;
  paymentMethod?: string;
};

const CHANNEL_NAME = "celsius-customer-display";

export function broadcastToCustomerDisplay(data: CustomerDisplayData) {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage(data);
    ch.close();
  } catch {
    // BroadcastChannel not supported (e.g. Safari < 15.4)
  }
}

export function listenToCustomerDisplay(callback: (data: CustomerDisplayData) => void): () => void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (e) => callback(e.data as CustomerDisplayData);
    return () => ch.close();
  } catch {
    return () => {};
  }
}
