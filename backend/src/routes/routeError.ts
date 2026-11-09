export class RouteError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly service?: string,
  ) {
    super(message);
    this.name = 'RouteError';
  }
}
