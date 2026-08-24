import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ApiError } from "../lib/api-error.js";
import {
  createDefaultDriverProfile,
  createDefaultPreferences
} from "../domain/user-constants.js";

const { Pool } = pg;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const schemaFilePath = path.resolve(currentDirectory, "../../sql/schema.sql");

export async function createPostgresUserRepository(postgresConfig) {
  const pool = new Pool(buildPoolConfig(postgresConfig));
  await pool.query("SELECT 1");
  await ensureSchema(pool);

  return {
    kind: "postgresql",
    async close() {
      await pool.end();
    },
    async getUserById(userId) {
      const result = await pool.query(
        `SELECT user_id, role, account_status, full_name, display_name, phone, email, avatar_url, bio,
                default_payment_method, created_at, updated_at
         FROM users
         WHERE user_id = $1`,
        [userId]
      );

      return result.rows[0] ? mapUserRow(result.rows[0]) : null;
    },
    async upsertUserProfile(userId, payload) {
      const existing = await this.getUserById(userId);

      await ensureUniqueProfile(pool, userId, payload, existing);

      const nextUser = {
        userId,
        role: payload.role ?? existing?.role ?? "CUSTOMER",
        accountStatus: payload.accountStatus ?? existing?.accountStatus ?? "ACTIVE",
        fullName: payload.fullName ?? existing?.fullName ?? "",
        displayName: payload.displayName ?? existing?.displayName ?? "",
        phone: payload.phone ?? existing?.phone ?? "",
        email: payload.email ?? existing?.email ?? "",
        avatarUrl: payload.avatarUrl ?? existing?.avatarUrl ?? "",
        bio: payload.bio ?? existing?.bio ?? "",
        defaultPaymentMethod: payload.defaultPaymentMethod ?? existing?.defaultPaymentMethod ?? "cash"
      };

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        if (!existing) {
          const now = new Date();
          await client.query(
            `INSERT INTO users (user_id, role, account_status, full_name, display_name, phone, email, avatar_url, bio,
                                default_payment_method, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
            [
              nextUser.userId,
              nextUser.role,
              nextUser.accountStatus,
              nextUser.fullName,
              nextUser.displayName,
              nextUser.phone,
              nextUser.email,
              nextUser.avatarUrl,
              nextUser.bio,
              nextUser.defaultPaymentMethod,
              now
            ]
          );

          await client.query(
            `INSERT INTO wallet_accounts (wallet_account_id, user_id, balance, currency, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $6)`,
            [randomUUID(), userId, 0, "VND", "ACTIVE", now]
          );
        } else {
          await client.query(
            `UPDATE users
             SET role = $2,
                 account_status = $3,
                 full_name = $4,
                 display_name = $5,
                 phone = $6,
                 email = $7,
                 avatar_url = $8,
                 bio = $9,
                 default_payment_method = $10,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [
              userId,
              nextUser.role,
              nextUser.accountStatus,
              nextUser.fullName,
              nextUser.displayName,
              nextUser.phone,
              nextUser.email,
              nextUser.avatarUrl,
              nextUser.bio,
              nextUser.defaultPaymentMethod
            ]
          );
        }

        await ensurePreferencesRecord(client, userId);

        if (nextUser.role === "DRIVER") {
          await ensureDriverProfileRecord(client, userId);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      return {
        user: await this.getUserById(userId),
        created: existing == null
      };
    },
    async getDriverProfileByUserId(userId) {
      const user = await this.getUserById(userId);
      if (!user || user.role !== "DRIVER") {
        return null;
      }

      await ensureDriverProfileRecord(pool, userId);
      const result = await pool.query(
        `SELECT user_id, kyc_status, approval_status, approval_notes, vehicle_type, license_number, created_at, updated_at
         FROM driver_profiles
         WHERE user_id = $1`,
        [userId]
      );

      return result.rows[0] ? mapDriverProfileRow(result.rows[0]) : null;
    },
    async upsertDriverProfile(userId, payload) {
      await ensureDriverProfileRecord(pool, userId);
      const existing = await this.getDriverProfileByUserId(userId);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE driver_profiles
           SET kyc_status = $2,
               approval_status = $3,
               approval_notes = $4,
               vehicle_type = $5,
               license_number = $6,
               updated_at = NOW()
           WHERE user_id = $1`,
          [
            userId,
            payload.kycStatus ?? existing?.kycStatus ?? "NOT_SUBMITTED",
            payload.approvalStatus ?? existing?.approvalStatus ?? "PENDING",
            payload.approvalNotes ?? existing?.approvalNotes ?? "",
            payload.vehicleType ?? existing?.vehicleType ?? "",
            payload.licenseNumber ?? existing?.licenseNumber ?? ""
          ]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      return this.getDriverProfileByUserId(userId);
    },
    async getUserPreferencesByUserId(userId) {
      await ensurePreferencesRecord(pool, userId);
      const result = await pool.query(
        `SELECT user_id, language, push_notifications, email_notifications, marketing_opt_in, created_at, updated_at
         FROM user_preferences
         WHERE user_id = $1`,
        [userId]
      );

      return result.rows[0] ? mapPreferenceRow(result.rows[0]) : null;
    },
    async upsertUserPreferences(userId, payload) {
      const existing = await this.getUserPreferencesByUserId(userId);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE user_preferences
           SET language = $2,
               push_notifications = $3,
               email_notifications = $4,
               marketing_opt_in = $5,
               updated_at = NOW()
           WHERE user_id = $1`,
          [
            userId,
            payload.language ?? existing?.language ?? "vi",
            payload.pushNotifications ?? existing?.pushNotifications ?? true,
            payload.emailNotifications ?? existing?.emailNotifications ?? true,
            payload.marketingOptIn ?? existing?.marketingOptIn ?? false
          ]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      return this.getUserPreferencesByUserId(userId);
    },
    async listSavedLocationsByUserId(userId) {
      const result = await pool.query(
        `SELECT location_id, user_id, label, title, address_line, latitude, longitude, note, created_at, updated_at
         FROM saved_locations
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [userId]
      );

      return result.rows.map(mapSavedLocationRow);
    },
    async createSavedLocation(userId, payload) {
      const result = await pool.query(
        `INSERT INTO saved_locations (location_id, user_id, label, title, address_line, latitude, longitude, note, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING location_id, user_id, label, title, address_line, latitude, longitude, note, created_at, updated_at`,
        [
          randomUUID(),
          userId,
          payload.label,
          payload.title,
          payload.addressLine,
          payload.latitude,
          payload.longitude,
          payload.note ?? ""
        ]
      );

      return mapSavedLocationRow(result.rows[0]);
    },
    async updateSavedLocation(userId, locationId, payload) {
      const existingLocations = await this.listSavedLocationsByUserId(userId);
      const existing = existingLocations.find((location) => location.locationId === locationId);

      if (!existing) {
        throw new ApiError(404, "Saved location not found");
      }

      const result = await pool.query(
        `UPDATE saved_locations
         SET label = $3,
             title = $4,
             address_line = $5,
             latitude = $6,
             longitude = $7,
             note = $8,
             updated_at = NOW()
         WHERE user_id = $1 AND location_id = $2
         RETURNING location_id, user_id, label, title, address_line, latitude, longitude, note, created_at, updated_at`,
        [
          userId,
          locationId,
          payload.label ?? existing.label,
          payload.title ?? existing.title,
          payload.addressLine ?? existing.addressLine,
          payload.latitude ?? existing.latitude,
          payload.longitude ?? existing.longitude,
          payload.note ?? existing.note
        ]
      );

      return result.rows[0] ? mapSavedLocationRow(result.rows[0]) : null;
    },
    async deleteSavedLocation(userId, locationId) {
      const result = await pool.query(
        `DELETE FROM saved_locations
         WHERE user_id = $1 AND location_id = $2
         RETURNING location_id`,
        [userId, locationId]
      );

      if (!result.rows[0]) {
        throw new ApiError(404, "Saved location not found");
      }

      return {
        locationId: result.rows[0].location_id,
        deleted: true
      };
    },
    async listUsers(filters) {
      return queryUsers(pool, filters);
    },
    async listEligibleDrivers(filters) {
      return queryUsers(pool, {
        ...filters,
        role: "DRIVER"
      });
    },
    async listPaymentMethods(userId) {
      const result = await pool.query(
        `SELECT payment_method_id, user_id, type, provider, masked_value, is_default, status, created_at, updated_at
         FROM payment_methods
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [userId]
      );

      return result.rows.map(mapPaymentMethodRow);
    },
    async createPaymentMethod(userId, payload) {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      const existingMethods = await this.listPaymentMethods(userId);
      const isDefault = payload.isDefault === true || existingMethods.length === 0;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        if (isDefault) {
          await client.query(
            `UPDATE payment_methods
             SET is_default = FALSE, updated_at = NOW()
             WHERE user_id = $1 AND is_default = TRUE`,
            [userId]
          );
        }

        const result = await client.query(
          `INSERT INTO payment_methods (payment_method_id, user_id, type, provider, masked_value, is_default, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           RETURNING payment_method_id, user_id, type, provider, masked_value, is_default, status, created_at, updated_at`,
          [
            randomUUID(),
            userId,
            payload.type,
            payload.provider ?? defaultProvider(payload.type),
            payload.maskedValue ?? defaultMaskedValue(payload.type),
            isDefault,
            payload.status ?? "ACTIVE"
          ]
        );

        if (isDefault) {
          await client.query(
            `UPDATE users
             SET default_payment_method = $2, updated_at = NOW()
             WHERE user_id = $1`,
            [userId, payload.type]
          );
        }

        await client.query("COMMIT");
        return mapPaymentMethodRow(result.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async getWalletByUserId(userId) {
      const result = await pool.query(
        `SELECT wallet_account_id, user_id, balance, currency, status, created_at, updated_at
         FROM wallet_accounts
         WHERE user_id = $1`,
        [userId]
      );

      return result.rows[0] ? mapWalletRow(result.rows[0]) : null;
    }
  };
}

function buildPoolConfig(postgresConfig) {
  if (postgresConfig.connectionString) {
    return {
      connectionString: postgresConfig.connectionString,
      ssl: postgresConfig.ssl ? { rejectUnauthorized: false } : false
    };
  }

  return {
    host: postgresConfig.host,
    port: postgresConfig.port,
    database: postgresConfig.database,
    user: postgresConfig.user,
    password: postgresConfig.password,
    ssl: postgresConfig.ssl ? { rejectUnauthorized: false } : false
  };
}

async function ensureSchema(pool) {
  const schemaSql = await readFile(schemaFilePath, "utf-8");
  await pool.query(schemaSql);
}

async function ensureUniqueProfile(pool, userId, payload, existing) {
  const nextPhone = payload.phone ?? existing?.phone ?? null;
  const nextEmail = payload.email ?? existing?.email ?? null;

  if (nextPhone) {
    const phoneResult = await pool.query(
      "SELECT 1 FROM users WHERE phone = $1 AND user_id <> $2 LIMIT 1",
      [nextPhone, userId]
    );
    if (phoneResult.rowCount > 0) {
      throw new ApiError(409, "Phone number already exists");
    }
  }

  if (nextEmail) {
    const emailResult = await pool.query(
      "SELECT 1 FROM users WHERE email = $1 AND user_id <> $2 LIMIT 1",
      [nextEmail, userId]
    );
    if (emailResult.rowCount > 0) {
      throw new ApiError(409, "Email already exists");
    }
  }
}

async function ensurePreferencesRecord(queryable, userId) {
  const timestamp = new Date();
  const defaults = createDefaultPreferences(userId, timestamp.toISOString());
  await queryable.query(
    `INSERT INTO user_preferences (user_id, language, push_notifications, email_notifications, marketing_opt_in, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (user_id) DO NOTHING`,
    [
      userId,
      defaults.language,
      defaults.pushNotifications,
      defaults.emailNotifications,
      defaults.marketingOptIn,
      timestamp
    ]
  );
}

async function ensureDriverProfileRecord(queryable, userId) {
  const timestamp = new Date();
  const defaults = createDefaultDriverProfile(userId, timestamp.toISOString());
  await queryable.query(
    `INSERT INTO driver_profiles (user_id, kyc_status, approval_status, approval_notes, vehicle_type, license_number, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (user_id) DO NOTHING`,
    [
      userId,
      defaults.kycStatus,
      defaults.approvalStatus,
      defaults.approvalNotes,
      defaults.vehicleType,
      defaults.licenseNumber,
      timestamp
    ]
  );
}

async function queryUsers(pool, filters) {
  const { whereClause, values } = buildUserFilterQuery(filters);
  const countSql = `
    SELECT COUNT(*) AS total
    FROM users u
    LEFT JOIN driver_profiles dp ON dp.user_id = u.user_id
    ${whereClause}
  `;
  const countResult = await pool.query(countSql, values);
  const total = Number(countResult.rows[0]?.total || 0);

  const paginationValues = [...values, filters.limit, (filters.page - 1) * filters.limit];
  const dataSql = `
    SELECT u.user_id, u.role, u.account_status, u.full_name, u.display_name, u.phone, u.email, u.avatar_url, u.created_at, u.updated_at,
           dp.kyc_status, dp.approval_status, dp.vehicle_type
    FROM users u
    LEFT JOIN driver_profiles dp ON dp.user_id = u.user_id
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT $${paginationValues.length - 1}
    OFFSET $${paginationValues.length}
  `;

  const result = await pool.query(dataSql, paginationValues);

  return {
    items: result.rows.map(mapUserSummaryRow),
    pagination: buildPagination(filters.page, filters.limit, total)
  };
}

function buildUserFilterQuery(filters) {
  const conditions = [];
  const values = [];

  if (filters.role) {
    values.push(filters.role);
    conditions.push(`u.role = $${values.length}`);
  }

  if (filters.accountStatus) {
    values.push(filters.accountStatus);
    conditions.push(`u.account_status = $${values.length}`);
  }

  if (filters.approvalStatus) {
    values.push(filters.approvalStatus);
    conditions.push(`dp.approval_status = $${values.length}`);
  }

  if (filters.kycStatus) {
    values.push(filters.kycStatus);
    conditions.push(`dp.kyc_status = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(
      u.full_name ILIKE $${values.length}
      OR u.display_name ILIKE $${values.length}
      OR u.phone ILIKE $${values.length}
      OR u.email ILIKE $${values.length}
    )`);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

function mapUserRow(row) {
  return {
    userId: row.user_id,
    role: row.role,
    accountStatus: row.account_status,
    fullName: row.full_name,
    displayName: row.display_name,
    phone: row.phone,
    email: row.email,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    defaultPaymentMethod: row.default_payment_method,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapDriverProfileRow(row) {
  return {
    userId: row.user_id,
    kycStatus: row.kyc_status,
    approvalStatus: row.approval_status,
    approvalNotes: row.approval_notes,
    vehicleType: row.vehicle_type,
    licenseNumber: row.license_number,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapPreferenceRow(row) {
  return {
    userId: row.user_id,
    language: row.language,
    pushNotifications: row.push_notifications,
    emailNotifications: row.email_notifications,
    marketingOptIn: row.marketing_opt_in,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapSavedLocationRow(row) {
  return {
    locationId: row.location_id,
    userId: row.user_id,
    label: row.label,
    title: row.title,
    addressLine: row.address_line,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    note: row.note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapUserSummaryRow(row) {
  return {
    userId: row.user_id,
    role: row.role,
    accountStatus: row.account_status,
    fullName: row.full_name,
    displayName: row.display_name,
    phone: row.phone,
    email: row.email,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    driverProfile: row.kyc_status ? {
      kycStatus: row.kyc_status,
      approvalStatus: row.approval_status,
      vehicleType: row.vehicle_type
    } : null
  };
}

function mapPaymentMethodRow(row) {
  return {
    paymentMethodId: row.payment_method_id,
    userId: row.user_id,
    type: row.type,
    provider: row.provider,
    maskedValue: row.masked_value,
    isDefault: row.is_default,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapWalletRow(row) {
  return {
    walletAccountId: row.wallet_account_id,
    userId: row.user_id,
    balance: Number(row.balance),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

function defaultProvider(type) {
  return type === "wallet" ? "cab-wallet" : "unknown-provider";
}

function defaultMaskedValue(type) {
  return type === "wallet" ? "CAB Wallet" : "";
}
