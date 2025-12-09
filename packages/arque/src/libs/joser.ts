
export type Serializer<T, R> = {
  type: any;
  serialize(value: T): R;
  deserialize(value: R): T;
};

export class Joser {
  private readonly serializers: Serializer<unknown, unknown>[];

  constructor(opts: { serializers: Serializer<unknown, unknown>[] }) {
    this.serializers = opts.serializers;
  }

  serialize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.serialize(v));
    }

    if (typeof value === 'object') {
      const proto = Object.getPrototypeOf(value);
      const serializer = this.serializers.find((s) => 
        (s.type && value instanceof s.type) || (proto && proto.constructor === s.type)
      );

      if (serializer) {
        return serializer.serialize(value);
      }

      if (value.constructor === Object) {
        const result: Record<string, unknown> = {};
        for (const key in value) {
            result[key] = this.serialize((value as Record<string, unknown>)[key]);
        }
        return result;
      }
    }

    return value;
  }

  deserialize(value: unknown): unknown {
     if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.deserialize(v));
    }

    if (typeof value === 'object') {
       // Check if this matches any serializer's output structure if strictly needed, 
       // but typically we might need a hint or recursive check.
       // However, Joser in the original code seemed to rely on the *type* of the input to serialize,
       // and presumably some structural hint to deserialize.
       // For Mongo/JSON simple types, deserialization is often context-dependent or identity for basic types.
       // The original code passed `deserialize` logic in the options.
       
       // Creating a simplified version that assumes leaf-node transformation based on known structures
       // might be tricky without type hints in the stored JSON.
       // BUT, checking the usage:
       // { type: Buffer, serialize: (v) => v, deserialize: (v: { buffer: Buffer }) => Buffer.from(v.buffer) }
       // This implies the serialized form IS distinct (e.g. BSON Binary).
       // For standard JSON, Buffer -> { type: 'Buffer', data: [...] }.
       
       // Let's implement a recursive traversal that gives serializers a shot at it.
       // Note: Mongoose BSON types might need special handling if we are "deserializing" from Mongoose docs.
       
      for (const serializer of this.serializers) {
         // This part is heuristic if the serialized form doesn't carry type info explicitly 
         // other than its structure. 
         // In the generic case, we might just return the value if we can't definitively match.
         // However, the specific usage shows:
         // serialize: buffer -> buffer (identity)
         // deserialize: { buffer: buffer } -> buffer
         try {
             const result = serializer.deserialize(value);
             if (result !== value) return result; 
         } catch (e) {
             // ignore
         }
      }

      const result: Record<string, unknown> = {};
      for (const key in value) {
        result[key] = this.deserialize((value as Record<string, unknown>)[key]);
      }
      return result;
    }

    return value;
  }
}
