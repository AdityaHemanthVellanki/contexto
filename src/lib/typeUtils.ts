export function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null;
}

export function hasProperty<T extends string>(obj: unknown, prop: T): obj is { [K in T]: unknown } {
  return isObject(obj) && prop in obj;
}
