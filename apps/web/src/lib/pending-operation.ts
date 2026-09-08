const listeners = new Set<() => void>();
let pending = 0;
export const subscribeOperation = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const isOperationPending = () => pending > 0;
export function beginOperation() {
  pending += 1;
  listeners.forEach((listener) => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pending -= 1;
    listeners.forEach((listener) => listener());
  };
}
