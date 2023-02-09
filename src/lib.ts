export type Delayed<T> = T extends () => unknown ? never : T | (() => T);
export function undelay<T>(delayedObject: Delayed<T>): T {
  return typeof delayedObject === "function" ? delayedObject() : delayedObject;
}
