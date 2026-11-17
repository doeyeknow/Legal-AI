// Browser-side Web Push for new court mail (opt-in, per device).
//
// The toggle lives on the Account page and defaults OFF: nothing
// prompts on first load and nothing nags. Turning it on requests
// Notification permission and subscribes this browser; turning it
// off unsubscribes the browser and removes the server row.
//
// Every function is best-effort and NEVER throws: a denied prompt,
// an unsupported browser, or an unconfigured server must never
// block or break the page around it.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** Register the push service worker. Safe to call repeatedly; the
 *  browser dedupes the registration. Never throws. */
export async function registerPushWorker(): Promise<boolean> {
  try {
    if (!pushSupported()) return false;
    await navigator.serviceWorker.register("/sw.js");
    return true;
  } catch {
    return false;
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

/** This browser's current push subscription, if it holds one. */
export async function getBrowserSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/public-key");
    const data = (await res.json().catch(() => ({}))) as { publicKey?: string };
    if (!res.ok || !data.publicKey) return null;
    return data.publicKey;
  } catch {
    return null;
  }
}

/** POST a browser subscription to the server. The endpoint upserts
 *  by endpoint, so re-posting an already-known subscription simply
 *  refreshes its keys — and re-creates the server row when pruning
 *  removed it (silent self-heal). Never throws. */
export async function syncSubscriptionToServer(
  subscription: PushSubscription,
): Promise<boolean> {
  try {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type EnableResult = "subscribed" | "denied" | "unsupported" | "unconfigured" | "error";

/** Request permission (if not yet decided) and subscribe this
 *  browser for new-court-mail push. Returns what happened; never
 *  throws. */
export async function enableEmailPush(): Promise<EnableResult> {
  try {
    if (!pushSupported()) return "unsupported";
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const registration = await getRegistration();
    if (!registration) return "error";
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const publicKey = await fetchPublicKey();
      if (!publicKey) return "unconfigured";
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    return (await syncSubscriptionToServer(subscription)) ? "subscribed" : "error";
  } catch {
    return "error";
  }
}

/** Unsubscribe this browser and remove its server row. Returns
 *  whether the browser-side unsubscribe happened; never throws. */
export async function disableEmailPush(): Promise<boolean> {
  try {
    const subscription = await getBrowserSubscription();
    if (!subscription) return true;
    const endpoint = subscription.endpoint;
    let ok = true;
    try {
      ok = await subscription.unsubscribe();
    } catch {
      ok = false;
    }
    try {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      /* the browser row is gone; the server row prunes on next send */
    }
    return ok;
  } catch {
    return false;
  }
}
