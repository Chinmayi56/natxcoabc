import api from "@/lib/api";

// Modular payment layer. Backend returns test mode until Razorpay keys
// are added to backend .env, after which it returns mode="live" with no frontend change.
export async function createOrder({ amount }) {
  const { data } = await api.post("/payments/create-order", { amount });
  return data.data;
}

export async function verifyPayment(payload) {
  const { data } = await api.post("/payments/verify", payload);
  return data.data;
}
