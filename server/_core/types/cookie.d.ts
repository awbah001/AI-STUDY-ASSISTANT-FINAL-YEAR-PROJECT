declare module "cookie" {
  export function serialize(name: string, value: string, options?: Record<string, unknown>): string;
  export function parse(
    str: string,
    options?: Record<string, unknown>
  ): Record<string, string>;
}
