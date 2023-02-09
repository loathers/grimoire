export type Delayed<T> = T | (() => T);
export function undelay<T>(delayedObject: Delayed<T>): T {
  return typeof delayedObject === "function"
    ? delayedObject.bind(delayedObject).call()
    : delayedObject;
}
