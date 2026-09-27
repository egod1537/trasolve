import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

export interface DatabaseExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export class Database implements DatabaseExecutor {
  public constructor(connectionString: string) {
    if (!connectionString.trim()) {
      throw new Error('DATABASE_URL must not be empty.');
    }

    this.pool = new Pool({ connectionString });
  }

  public static fromEnvironment(
    environment: NodeJS.ProcessEnv = process.env,
  ): Database {
    const connectionString = environment.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error('DATABASE_URL is required to start the backend.');
    }

    return new Database(connectionString);
  }

  public query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(text, values ? [...values] : undefined);
  }

  public async transaction<Result>(
    operation: (executor: DatabaseExecutor) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await operation(this.createClientExecutor(client));
      await client.query('COMMIT');
      return result;
    } catch (cause) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackCause) {
        throw new AggregateError(
          [cause, rollbackCause],
          'Database transaction and rollback both failed.',
        );
      }
      throw cause;
    } finally {
      client.release();
    }
  }

  public close(): Promise<void> {
    this.closePromise ??= this.pool.end();
    return this.closePromise;
  }

  private readonly pool: Pool;
  private closePromise: Promise<void> | undefined;

  private createClientExecutor(client: PoolClient): DatabaseExecutor {
    return {
      query: <Row extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: readonly unknown[],
      ) => client.query<Row>(text, values ? [...values] : undefined),
    };
  }
}
