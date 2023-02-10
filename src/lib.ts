// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Delayed<T> = [T] extends [(...args: any) => any] ? never : T | (() => T);
export function undelay<T>(delayedObject: Delayed<T>): T {
  return typeof delayedObject === "function" ? delayedObject() : delayedObject;
}
