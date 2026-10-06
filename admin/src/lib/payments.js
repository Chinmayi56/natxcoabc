import api from "@/lib/api";
import { notifyDataChanged } from "@/lib/dataSync";

// Modular payment layer. Backend returns test mode until Razorpay keys
// are added to backend .env, after which it returns mode="live" with no frontend change.
export async function createOrder({ amount }) {
  const { data } = await api.post("/payments/create-order", { amount });
  return data.data;
}

export async function verifyPayment(payload) {
  const { data } = await api.post("/payments/verify", payload);
  notifyDataChanged(["payments", "invoices", "bookings", "customers", "agents"]);
  return data.data;
}
