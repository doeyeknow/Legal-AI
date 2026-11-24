import { useEffect, useRef, useState } from 'react';
import { browserRecognition, createCompanionRecognition, type RecognitionStatus } from '@/lib/companion-recognition';

export function useCompanionRecognition(onFinal: (chunk: string) => void, sessionKey?: string) {
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<RecognitionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const onFinalRef = useRef(onFinal);
  const session = useRef<ReturnType<typeof createCompanionRecognition> | null>(null);

  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);
  useEffect(() => {
    const Ctor = browserRecognition();
    setStatus('idle');
    setError(null);
    setInterim('');
    setReady(Boolean(Ctor));
    setUnavailable(Ctor ? null : !window.isSecureContext
      ? 'Microphone access requires a secure connection. Open the app using HTTPS.'
      : 'This browser does not offer speech recognition. Try an up-to-date version of Chrome in a regular browser tab.');
    if (!Ctor) return;
    const controller = createCompanionRecognition(Ctor, {
      status: setStatus,
      error: setError,
      transcript(final, partial) {
        for (const chunk of final) onFinalRef.current(chunk);
        setInterim(partial);
      },
    });
    session.current = controller;
    return () => {
      controller.dispose();
      session.current = null;
    };
  }, [sessionKey]);

  return {
    ready, unavailable, status, error, interim,
    start() {
      setError(null);
      session.current?.start();
    },
    stop() { session.current?.stop(); },
  };
}
