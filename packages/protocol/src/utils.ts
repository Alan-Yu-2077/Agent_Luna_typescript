export function assertNever(x: never): never {
  throw new Error(`Unhandled discriminator: ${JSON.stringify(x)}`);
}
