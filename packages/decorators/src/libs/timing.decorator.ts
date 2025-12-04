/**
 * Decorator to measure execution time
 */
export function Timing(label?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const methodLabel = label || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        console.log(`[Timing] ${methodLabel}: ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        console.log(`[Timing] ${methodLabel} (error): ${duration}ms`);
        throw error;
      }
    };

    return descriptor;
  };
}
