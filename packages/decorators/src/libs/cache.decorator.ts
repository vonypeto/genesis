/**
 * Simple in-memory cache decorator
 */
const cacheStore = new Map<string, { value: any; expiry: number }>();

export function Cacheable(ttl: number = 300000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;
      const cached = cacheStore.get(cacheKey);

      if (cached && cached.expiry > Date.now()) {
        console.log(`[Cache] Hit: ${cacheKey}`);
        return cached.value;
      }

      console.log(`[Cache] Miss: ${cacheKey}`);
      const result = await originalMethod.apply(this, args);
      cacheStore.set(cacheKey, {
        value: result,
        expiry: Date.now() + ttl,
      });

      return result;
    };

    return descriptor;
  };
}

/**
 * Clear cache for specific key pattern
 */
export function clearCache(pattern?: string) {
  if (!pattern) {
    cacheStore.clear();
    return;
  }

  const keys = Array.from(cacheStore.keys());
  keys.forEach((key) => {
    if (key.includes(pattern)) {
      cacheStore.delete(key);
    }
  });
}
