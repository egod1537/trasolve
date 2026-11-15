import type { QueryResultRow } from 'pg';
import type {
  AdminAuditListResponse,
  AdminOperationsSummaryResponse,
  AdminTripListResponse,
  AdminTripSummary,
  AdminUserActionResponse,
  AdminUserDetailResponse,
  AdminUserListResponse,
  ExternalApiService,
  ExternalApiUsageSummaryResponse,
} from '@trasolve/shared';
import { canonicalGoogleIssuer } from '../auth/authenticationService.js';
import type { Database, DatabaseExecutor } from '../database/database.js';
import type {
  AdminAuditInput,
  AdminAuthorizationRecord,
  AdminBootstrapRepository,
  AdminPageCursor,
  AdminRepository,
  AdminTripListInput,
  AdminUsageInput,
  AdminUserListInput,
  AdminUserMutation,
  BootstrapAdminRecord,
} from './adminRepository.js';

interface AuthorizationRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly role: 'user' | 'admin';
  readonly deleted_at: Date | null;
  readonly suspended_at: Date | null;
  readonly email: string | null;
  readonly has_verified_google_identity: boolean;
}

interface UserRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly avatar_url: string | null;
  readonly email: string | null;
  readonly role: 'user' | 'admin';
  readonly suspended_at: Date | null;
  readonly created_at: Date;
  readonly last_login_at: Date | null;
  readonly trip_count: string;
}

interface IdentityRow extends QueryResultRow {
  readonly issuer: string;
  readonly subject: string;
  readonly email: string | null;
  readonly email_verified: boolean;
  readonly last_login_at: Date | null;
}

interface CountRow extends QueryResultRow {
  readonly count: string;
}

interface SummaryRow extends QueryResultRow {
  readonly total_users: string;
  readonly active_users: string;
  readonly recent_login_users: string;
  readonly total_trips: string;
}

interface TripRow extends QueryResultRow {
  readonly id: string;
  readonly title: string;
  readonly owner_user_id: string;
  readonly owner_display_name: string;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly day_count: number;
  readonly place_count: string;
  readonly share_enabled: boolean;
  readonly searchable: boolean;
  readonly revision: string;
  readonly schema_version: number;
}

interface UsageAggregateRow extends QueryResultRow {
  readonly actual_calls: string;
  readonly success_calls: string;
  readonly failed_calls: string;
  readonly blocked_calls: string;
  readonly mock_calls: string;
  readonly avg_duration_ms: number | null;
  readonly p95_duration_ms: number | null;
}

interface UsageServiceRow extends UsageAggregateRow {
  readonly service: ExternalApiService;
  readonly last_observed_at: Date | null;
}

interface UsageBucketRow extends QueryResultRow {
  readonly bucket_start: Date;
  readonly actual_calls: string;
  readonly failed_calls: string;
  readonly blocked_calls: string;
  readonly mock_calls: string;
}

interface UsageActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly display_name: string;
  readonly actual_calls: string;
}

interface OperationRow extends QueryResultRow {
  readonly service: ExternalApiService;
  readonly actual_calls: string;
  readonly failed_calls: string;
  readonly avg_duration_ms: number | null;
  readonly last_observed_at: Date | null;
  readonly recent_error_codes: string[];
}

interface AuditRow extends QueryResultRow {
  readonly id: string;
  readonly actor_user_id: string;
  readonly actor_display_name: string;
  readonly action: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly created_at: Date;
  readonly metadata: unknown;
}

interface LockedUserRow extends QueryResultRow {
  readonly id: string;
  readonly role: 'user' | 'admin';
  readonly suspended_at: Date | null;
  readonly deleted_at: Date | null;
}

interface BootstrapRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly email: string;
  readonly issuer: string;
  readonly role: 'user' | 'admin';
}

const actualOutcomeSql = `('success', 'http_error', 'network_error')`;
const tripProjectionSql = `
  trips.id,
  trips.title,
  trips.owner_user_id,
  users.display_name AS owner_display_name,
  trips.created_at,
  trips.updated_at,
  trips.start_date::text,
  trips.end_date::text,
  jsonb_array_length(trips.document -> 'days') AS day_count,
  COALESCE((
    SELECT SUM(jsonb_array_length(day.value -> 'places'))
    FROM jsonb_array_elements(trips.document -> 'days') AS day(value)
    WHERE jsonb_typeof(day.value -> 'places') = 'array'
  ), 0)::text AS place_count,
  (shares.trip_id IS NOT NULL) AS share_enabled,
  COALESCE(shares.searchable, false) AS searchable,
  trips.revision::text,
  trips.schema_version`;

export class PostgresAdminRepository
  implements AdminRepository, AdminBootstrapRepository
{
  public constructor(private readonly database: Database) {}

  public async getAuthorization(
    userId: string,
  ): Promise<AdminAuthorizationRecord | undefined> {
    const result = await this.database.query<AuthorizationRow>(
      `SELECT
         users.id,
         users.display_name,
         users.role,
         users.deleted_at,
         users.suspended_at,
         google_identity.email,
         (google_identity.user_id IS NOT NULL) AS has_verified_google_identity
       FROM trasolve.users AS users
       LEFT JOIN LATERAL (
         SELECT identities.user_id, identities.email
         FROM trasolve.auth_identities AS identities
         WHERE identities.user_id = users.id
           AND identities.issuer = $2
           AND identities.email_verified = true
           AND identities.email IS NOT NULL
         ORDER BY identities.last_login_at DESC NULLS LAST,
                  identities.created_at DESC,
                  identities.id DESC
         LIMIT 1
       ) AS google_identity ON true
       WHERE users.id = $1`,
      [userId, canonicalGoogleIssuer],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          displayName: row.display_name,
          email: row.email,
          role: row.role,
          deleted: row.deleted_at !== null,
          suspended: row.suspended_at !== null,
          hasVerifiedGoogleIdentity: row.has_verified_google_identity,
        }
      : undefined;
  }

  public async listUsers(
    input: AdminUserListInput,
  ): Promise<AdminUserListResponse> {
    const parameters: unknown[] = [];
    const conditions = ['users.deleted_at IS NULL'];
    if (input.query) {
      parameters.push(`%${escapeLike(input.query)}%`);
      conditions.push(`(
        users.display_name ILIKE $${parameters.length} ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM trasolve.auth_identities AS searched_identity
          WHERE searched_identity.user_id = users.id
            AND searched_identity.email ILIKE $${parameters.length} ESCAPE '\\'
        )
      )`);
    }
    if (input.role) {
      parameters.push(input.role);
      conditions.push(`users.role = $${parameters.length}`);
    }
    if (input.state) {
      conditions.push(
        input.state === 'active'
          ? 'users.suspended_at IS NULL'
          : 'users.suspended_at IS NOT NULL',
      );
    }
    if (input.cursor) {
      parameters.push(input.cursor.at, input.cursor.id);
      conditions.push(
        `(users.created_at, users.id) < ($${parameters.length - 1}, $${parameters.length}::uuid)`,
      );
    }

    const countParameters = parameters.slice(
      0,
      input.cursor ? parameters.length - 2 : parameters.length,
    );
    const countConditions = input.cursor
      ? conditions.slice(0, conditions.length - 1)
      : conditions;
    const countResult = await this.database.query<CountRow>(
      `SELECT COUNT(*)::text AS count
       FROM trasolve.users AS users
       WHERE ${countConditions.join(' AND ')}`,
      countParameters,
    );

    parameters.push(input.limit + 1);
    const result = await this.database.query<UserRow>(
      `SELECT
         users.id,
         users.display_name,
         users.avatar_url,
         selected_identity.email,
         users.role,
         users.suspended_at,
         users.created_at,
         last_identity.last_login_at,
         (SELECT COUNT(*) FROM trasolve.trips
          WHERE owner_user_id = users.id AND deleted_at IS NULL)::text AS trip_count
       FROM trasolve.users AS users
       LEFT JOIN LATERAL (
         SELECT identities.email
         FROM trasolve.auth_identities AS identities
         WHERE identities.user_id = users.id
           AND identities.email_verified = true
           AND identities.email IS NOT NULL
         ORDER BY identities.last_login_at DESC NULLS LAST,
                  identities.created_at DESC,
                  identities.id DESC
         LIMIT 1
       ) AS selected_identity ON true
       LEFT JOIN LATERAL (
         SELECT MAX(identities.last_login_at) AS last_login_at
         FROM trasolve.auth_identities AS identities
         WHERE identities.user_id = users.id
       ) AS last_identity ON true
       WHERE ${conditions.join(' AND ')}
       ORDER BY users.created_at DESC, users.id DESC
       LIMIT $${parameters.length}`,
      parameters,
    );
    const hasNext = result.rows.length > input.limit;
    const rows = result.rows.slice(0, input.limit);
    return {
      users: rows.map(mapUser),
      nextCursor: hasNext ? encodeCursor(rows.at(-1)) : null,
      totalCount: parseCount(countResult.rows[0]?.count),
      appliedFilters: {
        query: input.query,
        role: input.role,
        state: input.state,
        limit: input.limit,
      },
    };
  }

  public async getUserDetail(
    userId: string,
  ): Promise<AdminUserDetailResponse | undefined> {
    const userResult = await this.database.query<UserRow>(
      `SELECT
         users.id,
         users.display_name,
         users.avatar_url,
         selected_identity.email,
         users.role,
         users.suspended_at,
         users.created_at,
         last_identity.last_login_at,
         (SELECT COUNT(*) FROM trasolve.trips
          WHERE owner_user_id = users.id AND deleted_at IS NULL)::text AS trip_count
       FROM trasolve.users AS users
       LEFT JOIN LATERAL (
         SELECT identities.email
         FROM trasolve.auth_identities AS identities
         WHERE identities.user_id = users.id
           AND identities.email_verified = true
           AND identities.email IS NOT NULL
         ORDER BY identities.last_login_at DESC NULLS LAST,
                  identities.created_at DESC,
                  identities.id DESC
         LIMIT 1
       ) AS selected_identity ON true
       LEFT JOIN LATERAL (
         SELECT MAX(identities.last_login_at) AS last_login_at
         FROM trasolve.auth_identities AS identities
         WHERE identities.user_id = users.id
       ) AS last_identity ON true
       WHERE users.id = $1 AND users.deleted_at IS NULL`,
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) {
      return undefined;
    }
    const [identityResult, activityResult] = await Promise.all([
      this.database.query<IdentityRow>(
        `SELECT issuer, subject, email, email_verified, last_login_at
         FROM trasolve.auth_identities
         WHERE user_id = $1
         ORDER BY last_login_at DESC NULLS LAST, created_at DESC, id DESC`,
        [userId],
      ),
      this.database.query<CountRow>(
        `SELECT COUNT(*)::text AS count
         FROM trasolve.analytics_events
         WHERE user_id = $1
           AND occurred_at >= clock_timestamp() - INTERVAL '30 days'`,
        [userId],
      ),
    ]);
    return {
      user: mapUser(user),
      identities: identityResult.rows.map((identity) => ({
        issuer: identity.issuer,
        subjectHint: maskIdentifier(identity.subject),
        emailHint: maskEmail(identity.email),
        emailVerified: identity.email_verified,
        lastLoginAt: toNullableIso(identity.last_login_at),
      })),
      recentActivityCount: parseCount(activityResult.rows[0]?.count),
    };
  }

  public async getSummary(): Promise<{
    totalUsers: number;
    activeUsers: number;
    recentLoginUsers: number;
    totalTrips: number;
    recentLoginWindowDays: 7;
    timeZone: 'Asia/Seoul';
    generatedAt: string;
  }> {
    const result = await this.database.query<SummaryRow>(
      `SELECT
         (SELECT COUNT(*) FROM trasolve.users
          WHERE deleted_at IS NULL)::text AS total_users,
         (SELECT COUNT(*) FROM trasolve.users
          WHERE deleted_at IS NULL AND suspended_at IS NULL)::text AS active_users,
         (SELECT COUNT(DISTINCT identities.user_id)
          FROM trasolve.auth_identities AS identities
          JOIN trasolve.users AS users ON users.id = identities.user_id
          WHERE identities.last_login_at >= clock_timestamp() - INTERVAL '7 days'
            AND users.deleted_at IS NULL)::text
          AS recent_login_users,
         (SELECT COUNT(*) FROM trasolve.trips
          WHERE deleted_at IS NULL)::text AS total_trips`,
    );
    const row = result.rows[0];
    return {
      totalUsers: parseCount(row?.total_users),
      activeUsers: parseCount(row?.active_users),
      recentLoginUsers: parseCount(row?.recent_login_users),
      totalTrips: parseCount(row?.total_trips),
      recentLoginWindowDays: 7,
      timeZone: 'Asia/Seoul',
      generatedAt: new Date().toISOString(),
    };
  }

  public async mutateUser(
    actorUserId: string,
    targetUserId: string,
    mutation: AdminUserMutation,
    reasonCode?: 'abuse' | 'request' | 'other',
  ): Promise<AdminUserActionResponse | undefined> {
    return this.database.transaction(async (executor) => {
      const locked = await executor.query<LockedUserRow>(
        `SELECT id, role, suspended_at, deleted_at
         FROM trasolve.users
         WHERE id = ANY($1::uuid[])
         ORDER BY id
         FOR UPDATE`,
        [[actorUserId, targetUserId]],
      );
      const actor = locked.rows.find((row) => row.id === actorUserId);
      const target = locked.rows.find((row) => row.id === targetUserId);
      if (!actor || !isActiveAdmin(actor)) {
        throw new AdminActorNoLongerAuthorizedError();
      }
      const verified = await executor.query<CountRow>(
        `SELECT COUNT(*)::text AS count
         FROM trasolve.auth_identities
         WHERE user_id = $1 AND issuer = $2 AND email_verified = true`,
        [actorUserId, canonicalGoogleIssuer],
      );
      if (parseCount(verified.rows[0]?.count) === 0) {
        throw new AdminActorNoLongerAuthorizedError();
      }
      if (!target || target.deleted_at !== null) {
        return undefined;
      }

      if (mutation === 'suspend' && target.suspended_at !== null) {
        return actionResult(targetUserId, 'suspended', false, 0);
      }
      if (mutation === 'restore' && target.suspended_at === null) {
        return actionResult(targetUserId, 'active', false, 0);
      }

      let revokedSessionCount = 0;
      if (mutation === 'suspend') {
        await executor.query(
          `UPDATE trasolve.users SET suspended_at = clock_timestamp() WHERE id = $1`,
          [targetUserId],
        );
        revokedSessionCount = await revokeSessions(executor, targetUserId);
      } else if (mutation === 'restore') {
        await executor.query(
          `UPDATE trasolve.users SET suspended_at = NULL WHERE id = $1`,
          [targetUserId],
        );
      } else {
        revokedSessionCount = await revokeSessions(executor, targetUserId);
      }

      const metadata =
        mutation === 'suspend' && reasonCode
          ? { reasonCode, revokedSessionCount }
          : { revokedSessionCount };
      await executor.query(
        `INSERT INTO trasolve.admin_audit_events
           (actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, 'user', $3, $4::jsonb)`,
        [actorUserId, `user.${mutation}`, targetUserId, metadata],
      );
      const state =
        mutation === 'suspend' ||
        (mutation === 'revoke-sessions' && target.suspended_at !== null)
          ? 'suspended'
          : 'active';
      return actionResult(targetUserId, state, true, revokedSessionCount);
    });
  }

  public async listTrips(
    input: AdminTripListInput,
  ): Promise<AdminTripListResponse> {
    const parameters: unknown[] = [];
    const conditions = ['trips.deleted_at IS NULL'];
    if (input.query) {
      parameters.push(`%${escapeLike(input.query)}%`);
      conditions.push(`(
        trips.title ILIKE $${parameters.length} ESCAPE '\\'
        OR users.display_name ILIKE $${parameters.length} ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM trasolve.auth_identities AS owner_identity
          WHERE owner_identity.user_id = trips.owner_user_id
            AND owner_identity.email ILIKE $${parameters.length} ESCAPE '\\'
        )
      )`);
    }
    if (input.ownerUserId) {
      parameters.push(input.ownerUserId);
      conditions.push(`trips.owner_user_id = $${parameters.length}::uuid`);
    }
    if (input.shared !== null) {
      conditions.push(
        input.shared ? 'shares.trip_id IS NOT NULL' : 'shares.trip_id IS NULL',
      );
    }
    if (input.cursor) {
      parameters.push(input.cursor.at, input.cursor.id);
      conditions.push(
        `(trips.created_at, trips.id) < ($${parameters.length - 1}, $${parameters.length})`,
      );
    }
    const countParameters = parameters.slice(
      0,
      input.cursor ? parameters.length - 2 : parameters.length,
    );
    const countConditions = input.cursor
      ? conditions.slice(0, conditions.length - 1)
      : conditions;
    const countResult = await this.database.query<CountRow>(
      `SELECT COUNT(*)::text AS count
       FROM trasolve.trips AS trips
       JOIN trasolve.users AS users ON users.id = trips.owner_user_id
       LEFT JOIN trasolve.trip_shares AS shares ON shares.trip_id = trips.id
       WHERE ${countConditions.join(' AND ')}`,
      countParameters,
    );
    parameters.push(input.limit + 1);
    const result = await this.database.query<TripRow>(
      `SELECT ${tripProjectionSql}
       FROM trasolve.trips AS trips
       JOIN trasolve.users AS users ON users.id = trips.owner_user_id
       LEFT JOIN trasolve.trip_shares AS shares ON shares.trip_id = trips.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY trips.created_at DESC, trips.id DESC
       LIMIT $${parameters.length}`,
      parameters,
    );
    const hasNext = result.rows.length > input.limit;
    const rows = result.rows.slice(0, input.limit);
    return {
      trips: rows.map(mapTrip),
      nextCursor: hasNext ? encodeTripCursor(rows.at(-1)) : null,
      totalCount: parseCount(countResult.rows[0]?.count),
      appliedFilters: {
        query: input.query,
        ownerUserId: input.ownerUserId,
        shared: input.shared,
        limit: input.limit,
      },
    };
  }

  public async getTripMetadata(
    tripId: string,
  ): Promise<(AdminTripSummary & { schemaVersion: number }) | undefined> {
    const result = await this.database.query<TripRow>(
      `SELECT ${tripProjectionSql}
       FROM trasolve.trips AS trips
       JOIN trasolve.users AS users ON users.id = trips.owner_user_id
       LEFT JOIN trasolve.trip_shares AS shares ON shares.trip_id = trips.id
       WHERE trips.id = $1 AND trips.deleted_at IS NULL`,
      [tripId],
    );
    const row = result.rows[0];
    return row
      ? { ...mapTrip(row), schemaVersion: row.schema_version }
      : undefined;
  }

  public async getUsageSummary(
    input: AdminUsageInput,
  ): Promise<ExternalApiUsageSummaryResponse> {
    const { whereSql, values } = usageFilter(input);
    const [aggregate, services, buckets, actors, collected] = await Promise.all(
      [
        this.database.query<UsageAggregateRow>(
          `SELECT ${usageAggregateProjection()}
         FROM trasolve.external_api_call_events
         WHERE ${whereSql}`,
          values,
        ),
        this.database.query<UsageServiceRow>(
          `SELECT service, ${usageAggregateProjection()}, MAX(occurred_at) AS last_observed_at
         FROM trasolve.external_api_call_events
         WHERE ${whereSql}
         GROUP BY service
         ORDER BY service`,
          values,
        ),
        this.database.query<UsageBucketRow>(
          bucketQuery(input.bucket, whereSql),
          values,
        ),
        this.database.query<UsageActorRow>(
          `SELECT events.actor_user_id AS user_id,
                users.display_name,
                SUM(events.provider_request_count)::text AS actual_calls
         FROM trasolve.external_api_call_events AS events
         JOIN trasolve.users AS users ON users.id = events.actor_user_id
         WHERE ${prefixWhere(whereSql, 'events.')}
           AND events.outcome IN ${actualOutcomeSql}
         GROUP BY events.actor_user_id, users.display_name
         ORDER BY SUM(events.provider_request_count) DESC, events.actor_user_id
         LIMIT 20`,
          values,
        ),
        this.database.query<{ exists: boolean }>(
          `SELECT EXISTS(SELECT 1 FROM trasolve.external_api_call_events LIMIT 1) AS exists`,
        ),
      ],
    );
    const row = aggregate.rows[0];
    return {
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      bucket: input.bucket,
      timeZone: 'Asia/Seoul',
      hasCollectedData: collected.rows[0]?.exists === true,
      ...mapUsageAggregate(row),
      byService: services.rows.map((service) => ({
        service: service.service,
        actualCalls: parseCount(service.actual_calls),
        successCalls: parseCount(service.success_calls),
        failedCalls: parseCount(service.failed_calls),
        blockedCalls: parseCount(service.blocked_calls),
        mockCalls: parseCount(service.mock_calls),
        avgDurationMs: service.avg_duration_ms,
        p95DurationMs: service.p95_duration_ms,
        lastObservedAt: toNullableIso(service.last_observed_at),
      })),
      byBucket: fillUsageBuckets(input, buckets.rows),
      perUserTop: actors.rows.map((actor) => ({
        userId: actor.user_id,
        displayName: actor.display_name,
        actualCalls: parseCount(actor.actual_calls),
      })),
      coverage: {
        backendOutboundOnly: true,
        browserGoogleMapsExcluded: true,
        blockedAndMockExcludedFromActual: true,
      },
    };
  }

  public async getOperationsSummary(
    from: Date,
    to: Date,
  ): Promise<AdminOperationsSummaryResponse> {
    const result = await this.database.query<OperationRow>(
      `SELECT
         service,
         SUM(provider_request_count) FILTER (WHERE outcome IN ${actualOutcomeSql})::text
           AS actual_calls,
         COUNT(*) FILTER (WHERE outcome IN ('http_error', 'network_error'))::text
           AS failed_calls,
         ROUND(AVG(duration_ms) FILTER (WHERE outcome IN ${actualOutcomeSql}))::integer
           AS avg_duration_ms,
         MAX(occurred_at) AS last_observed_at,
         (ARRAY_AGG(DISTINCT error_code) FILTER (WHERE error_code IS NOT NULL))[1:10]
           AS recent_error_codes
       FROM trasolve.external_api_call_events
       WHERE occurred_at >= $1 AND occurred_at < $2
       GROUP BY service
       ORDER BY service`,
      [from, to],
    );
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      timeZone: 'Asia/Seoul',
      services: result.rows.map((row) => ({
        service: row.service,
        configured: null,
        actualCalls: parseCount(row.actual_calls),
        failedCalls: parseCount(row.failed_calls),
        avgDurationMs: row.avg_duration_ms,
        lastObservedAt: toNullableIso(row.last_observed_at),
        recentErrorCodes: row.recent_error_codes ?? [],
      })),
      jobMirrors: [],
    };
  }

  public async listAudit(
    input: AdminAuditInput,
  ): Promise<AdminAuditListResponse> {
    const parameters: unknown[] = [];
    const conditions = ['true'];
    if (input.from) {
      parameters.push(input.from);
      conditions.push(`events.created_at >= $${parameters.length}`);
    }
    if (input.to) {
      parameters.push(input.to);
      conditions.push(`events.created_at < $${parameters.length}`);
    }
    if (input.action) {
      parameters.push(input.action);
      conditions.push(`events.action = $${parameters.length}`);
    }
    if (input.actorUserId) {
      parameters.push(input.actorUserId);
      conditions.push(`events.actor_user_id = $${parameters.length}::uuid`);
    }
    if (input.cursor) {
      parameters.push(input.cursor.at, input.cursor.id);
      conditions.push(
        `(events.created_at, events.id) < ($${parameters.length - 1}, $${parameters.length}::uuid)`,
      );
    }
    parameters.push(input.limit + 1);
    const result = await this.database.query<AuditRow>(
      `SELECT events.id,
              events.actor_user_id,
              users.display_name AS actor_display_name,
              events.action,
              events.target_type,
              events.target_id,
              events.created_at,
              events.metadata
       FROM trasolve.admin_audit_events AS events
       JOIN trasolve.users AS users ON users.id = events.actor_user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY events.created_at DESC, events.id DESC
       LIMIT $${parameters.length}`,
      parameters,
    );
    const hasNext = result.rows.length > input.limit;
    const rows = result.rows.slice(0, input.limit);
    return {
      events: rows.map((row) => ({
        id: row.id,
        time: row.created_at.toISOString(),
        action: row.action,
        actor: { id: row.actor_user_id, displayName: row.actor_display_name },
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: safeMetadata(row.metadata),
      })),
      nextCursor: hasNext ? encodeAuditCursor(rows.at(-1)) : null,
      appliedFilters: {
        from: toNullableIso(input.from),
        to: toNullableIso(input.to),
        action: input.action,
        actorUserId: input.actorUserId,
        limit: input.limit,
      },
    };
  }

  public inspect(userId: string): Promise<BootstrapAdminRecord | undefined> {
    return this.readBootstrapRecord(this.database, userId, false);
  }

  public async grant(
    userId: string,
  ): Promise<BootstrapAdminRecord | undefined> {
    return this.database.transaction(async (executor) => {
      const record = await this.readBootstrapRecord(executor, userId, true);
      if (!record) {
        return undefined;
      }
      await executor.query(
        `UPDATE trasolve.users SET role = 'admin' WHERE id = $1`,
        [userId],
      );
      return { ...record, role: 'admin' };
    });
  }

  private async readBootstrapRecord(
    executor: DatabaseExecutor,
    userId: string,
    lock: boolean,
  ): Promise<BootstrapAdminRecord | undefined> {
    const result = await executor.query<BootstrapRow>(
      `SELECT users.id,
              users.display_name,
              identities.email,
              identities.issuer,
              users.role
       FROM trasolve.users AS users
       JOIN LATERAL (
         SELECT email, issuer
         FROM trasolve.auth_identities
         WHERE user_id = users.id
           AND issuer = $2
           AND email_verified = true
           AND email IS NOT NULL
         ORDER BY last_login_at DESC NULLS LAST, created_at DESC, id DESC
         LIMIT 1
       ) AS identities ON true
       WHERE users.id = $1
         AND users.deleted_at IS NULL
         AND users.suspended_at IS NULL
       ${lock ? 'FOR UPDATE OF users' : ''}`,
      [userId, canonicalGoogleIssuer],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          displayName: row.display_name,
          email: row.email,
          issuer: row.issuer,
          role: row.role,
        }
      : undefined;
  }
}

export class AdminActorNoLongerAuthorizedError extends Error {
  public constructor() {
    super('The administrator is no longer authorized.');
    this.name = 'AdminActorNoLongerAuthorizedError';
  }
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    email: row.email,
    emailVerified: row.email !== null,
    role: row.role,
    state:
      row.suspended_at === null ? ('active' as const) : ('suspended' as const),
    createdAt: row.created_at.toISOString(),
    lastLoginAt: toNullableIso(row.last_login_at),
    tripCount: parseCount(row.trip_count),
  };
}

function mapTrip(row: TripRow): AdminTripSummary {
  return {
    id: row.id,
    title: row.title,
    owner: { id: row.owner_user_id, displayName: row.owner_display_name },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    startDate: row.start_date,
    endDate: row.end_date,
    dayCount: row.day_count,
    placeCount: parseCount(row.place_count),
    shareEnabled: row.share_enabled,
    searchable: row.searchable,
    revision: row.revision,
  };
}

function actionResult(
  userId: string,
  state: 'active' | 'suspended',
  changed: boolean,
  revokedSessionCount: number,
): AdminUserActionResponse {
  return { userId, state, changed, revokedSessionCount };
}

async function revokeSessions(
  executor: DatabaseExecutor,
  userId: string,
): Promise<number> {
  const result = await executor.query(
    `UPDATE trasolve.auth_sessions
     SET revoked_at = clock_timestamp()
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND expires_at > clock_timestamp()`,
    [userId],
  );
  return result.rowCount ?? 0;
}

function isActiveAdmin(row: LockedUserRow): boolean {
  return (
    row.role === 'admin' && row.deleted_at === null && row.suspended_at === null
  );
}

function parseCount(value: string | undefined): number {
  const parsed = Number(value ?? '0');
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Database count is outside the safe integer range.');
  }
  return parsed;
}

function toNullableIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function maskIdentifier(value: string): string {
  if (value.length <= 6) {
    return `${value.slice(0, 1)}***`;
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function maskEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const separator = value.lastIndexOf('@');
  if (separator <= 0) {
    return maskIdentifier(value);
  }
  return `${value.slice(0, 1)}***${value.slice(separator)}`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function encodeCursor(row: UserRow | undefined): string | null {
  return row ? encodePageCursor({ at: row.created_at, id: row.id }) : null;
}

function encodeTripCursor(row: TripRow | undefined): string | null {
  return row ? encodePageCursor({ at: row.created_at, id: row.id }) : null;
}

function encodeAuditCursor(row: AuditRow | undefined): string | null {
  return row ? encodePageCursor({ at: row.created_at, id: row.id }) : null;
}

function encodePageCursor(cursor: AdminPageCursor): string {
  return Buffer.from(
    JSON.stringify({ at: cursor.at.toISOString(), id: cursor.id }),
    'utf8',
  ).toString('base64url');
}

function usageFilter(input: AdminUsageInput): {
  readonly whereSql: string;
  readonly values: readonly unknown[];
} {
  const values: unknown[] = [input.from, input.to];
  const conditions = ['occurred_at >= $1', 'occurred_at < $2'];
  if (input.service) {
    values.push(input.service);
    conditions.push(`service = $${values.length}`);
  }
  if (input.actorUserId) {
    values.push(input.actorUserId);
    conditions.push(`actor_user_id = $${values.length}::uuid`);
  }
  return { whereSql: conditions.join(' AND '), values };
}

function usageAggregateProjection(): string {
  return `
    COALESCE(SUM(provider_request_count) FILTER (WHERE outcome IN ${actualOutcomeSql}), 0)::text
      AS actual_calls,
    COUNT(*) FILTER (WHERE outcome = 'success')::text AS success_calls,
    COUNT(*) FILTER (WHERE outcome IN ('http_error', 'network_error'))::text
      AS failed_calls,
    COUNT(*) FILTER (WHERE outcome = 'blocked')::text AS blocked_calls,
    COUNT(*) FILTER (WHERE outcome = 'mock')::text AS mock_calls,
    ROUND(AVG(duration_ms) FILTER (WHERE outcome IN ${actualOutcomeSql}))::integer
      AS avg_duration_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)
      FILTER (WHERE outcome IN ${actualOutcomeSql}))::integer AS p95_duration_ms`;
}

function mapUsageAggregate(row: UsageAggregateRow | undefined) {
  return {
    totalActualCalls: parseCount(row?.actual_calls),
    successCalls: parseCount(row?.success_calls),
    failedCalls: parseCount(row?.failed_calls),
    blockedCalls: parseCount(row?.blocked_calls),
    mockCalls: parseCount(row?.mock_calls),
    avgDurationMs: row?.avg_duration_ms ?? null,
    p95DurationMs: row?.p95_duration_ms ?? null,
  };
}

function bucketQuery(bucket: 'hour' | 'day', whereSql: string): string {
  return `
    SELECT
      date_trunc('${bucket}', occurred_at AT TIME ZONE 'Asia/Seoul')
        AT TIME ZONE 'Asia/Seoul' AS bucket_start,
      COALESCE(SUM(provider_request_count) FILTER (WHERE outcome IN ${actualOutcomeSql}), 0)::text
        AS actual_calls,
      COUNT(*) FILTER (WHERE outcome IN ('http_error', 'network_error'))::text
        AS failed_calls,
      COUNT(*) FILTER (WHERE outcome = 'blocked')::text AS blocked_calls,
      COUNT(*) FILTER (WHERE outcome = 'mock')::text AS mock_calls
    FROM trasolve.external_api_call_events
    WHERE ${whereSql}
    GROUP BY bucket_start
    ORDER BY bucket_start`;
}

function prefixWhere(whereSql: string, prefix: string): string {
  return whereSql.replace(
    /\b(occurred_at|service|actor_user_id)\b/g,
    `${prefix}$1`,
  );
}

function safeMetadata(
  value: unknown,
): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string | number | boolean | null] =>
        entry[1] === null ||
        typeof entry[1] === 'string' ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean',
    ),
  );
}

function fillUsageBuckets(
  input: AdminUsageInput,
  rows: readonly UsageBucketRow[],
): ExternalApiUsageSummaryResponse['byBucket'] {
  const step = input.bucket === 'hour' ? 60 * 60 * 1_000 : 24 * 60 * 60 * 1_000;
  const seoulOffset = 9 * 60 * 60 * 1_000;
  const first =
    Math.floor((input.from.valueOf() + seoulOffset) / step) * step -
    seoulOffset;
  const byStart = new Map(
    rows.map((row) => [
      row.bucket_start.valueOf(),
      {
        start: row.bucket_start.toISOString(),
        actualCalls: parseCount(row.actual_calls),
        failedCalls: parseCount(row.failed_calls),
        blockedCalls: parseCount(row.blocked_calls),
        mockCalls: parseCount(row.mock_calls),
      },
    ]),
  );
  const result: ExternalApiUsageSummaryResponse['byBucket'] = [];
  for (let value = first; value < input.to.valueOf(); value += step) {
    result.push(
      byStart.get(value) ?? {
        start: new Date(value).toISOString(),
        actualCalls: 0,
        failedCalls: 0,
        blockedCalls: 0,
        mockCalls: 0,
      },
    );
  }
  return result;
}
