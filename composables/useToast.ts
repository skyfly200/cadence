import { ref } from 'vue';

export interface ToastItem {
  id: number;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

const toasts = ref<ToastItem[]>([]);
let counter = 0;

export function useToast() {
  function toast(opts: Omit<ToastItem, 'id'>) {
    const id = ++counter;
    toasts.value = [...toasts.value, { id, ...opts }];
    setTimeout(() => dismiss(id), 4000);
    return id;
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }
  return { toast, dismiss, toasts };
}
