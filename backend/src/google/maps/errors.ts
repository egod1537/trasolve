export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly service?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
