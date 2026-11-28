'use client';

import { useEffect, useRef, useState } from 'react';
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js';

export default function EmbeddedCheckoutBox({
  clientSecret,
  onComplete,
  onError,
}: {
  clientSecret: string;
  onComplete: () => void;
  onError?: (message: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const completeRef = useRef(onComplete);
  const errorRef = useRef(onError);
  const [loading, setLoading] = useState(true);
  completeRef.current = onComplete;
  errorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    let checkout: StripeEmbeddedCheckout | null = null;
    async function mount() {
      setLoading(true);
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        errorRef.current?.('Checkout is not configured to stay on this page yet. No charge was made.');
        setLoading(false);
        return;
      }
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe) throw new Error('Stripe could not load');
        checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret,
          onComplete: () => completeRef.current(),
        });
        if (cancelled) {
          checkout.destroy();
          return;
        }
        if (mountRef.current) checkout.mount(mountRef.current);
      } catch {
        if (!cancelled) errorRef.current?.('Checkout could not load on this page. No charge was made. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void mount();
    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [clientSecret]);

  return (
    <div className="embedded-checkout" aria-live="polite">
      {loading && <p role="status">Loading secure checkout…</p>}
      <div ref={mountRef} />
    </div>
  );
}
