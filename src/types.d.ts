declare type AnyPrimitive = string | number | boolean;

declare type IntersectKeys<T, Keys extends (keyof T)[]> = {
  [K in Keys[number]]: T[K];
};
