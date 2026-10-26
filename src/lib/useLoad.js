// Loads data from the API when a screen opens (and again when `deps` change or reload() is called).
// Returns { data, loading, error, reload }. Requests are cancelled when the screen closes or the inputs change.
import { useCallback, useEffect, useState } from 'react';
import { errorMessage, isCanceled } from './api.js';

export default function useLoad(load, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: '' }));
    Promise.resolve(load(controller.signal))
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((err) => {
        if (isCanceled(err)) return;
        setState((s) => ({ ...s, loading: false, error: errorMessage(err, 'Could not load this page.') }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
