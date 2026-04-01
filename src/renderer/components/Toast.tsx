import React, { useState, useCallback } from 'react';
import type { ToastMessage } from '../types';
import { TOAST_DURATION_MS } from '@shared/constants';

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);
  return { toasts, addToast };
}

interface ContainerProps { toasts: ToastMessage[]; }

export function ToastContainer({ toasts }: ContainerProps): React.ReactElement | null {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <strong className="toast-title">{t.title}</strong>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
