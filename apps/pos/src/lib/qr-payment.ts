/**
 * QR Payment via Revenue Monster
 *
 * Flow:
 * 1. POS calls createQRPayment() with amount
 * 2. Revenue Monster returns a QR code URL/string
 * 3. QR is displayed on customer-facing screen
 * 4. Customer scans with any Malaysian e-wallet/bank app
 * 5. POS polls checkPaymentStatus() every 3s
 * 6. On SUCCESS → confirm order, print receipt
 *
 * Supported methods: DuitNow QR, Touch 'n Go, GrabPay, Boost, ShopeePay
 *
 * Revenue Monster credentials are stored in outlet_settings
 * (rm_merchant_id, rm_client_id, rm_client_secret)
 */

export type QRPaymentRequest = {
  amount: number; // in sen (e.g., 1500 = RM15.00)
  orderNumber: string;
  outletName: string;
  // RM credentials from outlet_settings
  rmClientId?: string;
  rmClientSecret?: string;
  rmMerchantId?: string;
  isProduction?: boolean;
};

export type QRPaymentResult = {
  checkoutId: string;
  qrCodeUrl: string; // URL to QR image or raw QR string
  transactionId: string;
  expiresAt: string;
  status: "pending" | "success" | "failed" | "expired";
};

export type PaymentStatus = {
  status: "pending" | "success" | "failed" | "expired";
  method?: string; // "DUITNOW_QR", "TNG", "BOOST", "GRABPAY"
  transactionId?: string;
  amount?: number;
};

const RM_SANDBOX_URL = "https://sb-open.revenuemonster.my/v3";
const RM_PRODUCTION_URL = "https://open.revenuemonster.my/v3";

// ─── Create QR Payment ────────────────────────────────────

export async function createQRPayment(req: QRPaymentRequest): Promise<QRPaymentResult> {
  // For now, simulate the Revenue Monster API call
  // In production, replace with actual RM API integration

  // TODO: Implement actual Revenue Monster OAuth + API call:
  // 1. POST /v3/payment/transaction/qrcode
  // 2. Body: { amount, currencyType: "MYR", method: ["DUITNOW_QR","TNG","BOOST","GRABPAY"], ... }
  // 3. Returns: { checkoutId, qrCodeUrl, transactionId }

  const checkoutId = `qr_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Generate a demo QR code URL (using a QR code generator API)
  // In production this comes from Revenue Monster
  const qrData = JSON.stringify({
    merchant: "Celsius Coffee",
    amount: req.amount,
    currency: "MYR",
    ref: req.orderNumber,
  });

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

  return {
    checkoutId,
    qrCodeUrl,
    transactionId: `txn_${checkoutId}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min expiry
    status: "pending",
  };
}

// ─── Check Payment Status ──────────────────────────────────

export async function checkPaymentStatus(checkoutId: string): Promise<PaymentStatus> {
  // TODO: Implement actual Revenue Monster polling:
  // GET /v3/payment/transaction/qrcode/{checkoutId}
  // Returns: { status: "SUCCESS" | "PENDING" | "FAILED" | "EXPIRED" }

  // Simulate: auto-succeed after 5 seconds for testing
  const created = parseInt(checkoutId.split("_")[1] ?? "0");
  const elapsed = Date.now() - created;

  if (elapsed > 8000) {
    return {
      status: "success",
      method: "DUITNOW_QR",
      transactionId: `txn_${checkoutId}`,
      amount: 0, // would come from RM response
    };
  }

  return { status: "pending" };
}

// ─── Cancel QR Payment ─────────────────────────────────────

export async function cancelQRPayment(checkoutId: string): Promise<void> {
  // TODO: Call RM API to cancel/void the pending QR transaction
  console.log(`[QR] Cancelled QR payment: ${checkoutId}`);
}

// ─── Generate QR Code as Data URL ──────────────────────────

export function generateQRDataUrl(data: string, size = 300): string {
  // Uses external QR code API — in production use a local library
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&color=1A1A1A&bgcolor=FFFFFF`;
}
