// Client-side guard for "Send OTP".
//
// Keeps one click == one request and respects the cooldown the server asks
// for, so the same number is never re-sent while a request is in flight or
// while a cooldown is active. This does NOT replace the server-side rate
// limit - it only avoids wasting requests (and the SMS provider's quota).

export const OTP_DEFAULT_COOLDOWN_SECONDS = 30;

// key -> Promise of the request currently in flight
export const otpSendInFlight = new Map();
// key -> epoch ms until which a new send should not be attempted
export const otpCooldownUntil = new Map();

export function otpCooldownRemaining(key) {
  const until = otpCooldownUntil.get(key);
  if (!until) return 0;
  const left = Math.ceil((until - Date.now()) / 1000);
  if (left <= 0) {
    otpCooldownUntil.delete(key);
    return 0;
  }
  return left;
}

export function formatOtpWait(seconds) {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

export function otpCooldownError(seconds) {
  const err = new Error(`An OTP was sent just now. Please wait ${formatOtpWait(seconds)} before requesting another one.`);
  err.retryAfter = seconds;
  return err;
}

// Seconds the server asked us to wait (Retry-After header or detail.retry_after), else 0.
export function otpRetryAfterSeconds(error) {
  if (error?.response?.status !== 429) return 0;
  const fromBody = Number(error.response?.data?.detail?.retry_after);
  if (fromBody > 0) return Math.ceil(fromBody);
  const fromHeader = Number(error.response?.headers?.["retry-after"]);
  return fromHeader > 0 ? Math.ceil(fromHeader) : 0;
}
