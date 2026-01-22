import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query } from './db';
import type { User, UserWithPassword, Session, CreateUserInput, UserRole } from '$lib/types';

const SALT_ROUNDS = 12;
const SESSION_EXPIRY_DAYS = 30;

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// User management
export async function createUser(input: CreateUserInput): Promise<User> {
  const passwordHash = await hashPassword(input.password);

  const result = query.run(
    `INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)`,
    [input.email.toLowerCase(), passwordHash, input.name, input.role || 'user']
  );

  const user = query.get<User>(
    `SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?`,
    [result.lastInsertRowid]
  );

  if (!user) throw new Error('Failed to create user');
  return user;
}

export function getUserById(id: number): User | undefined {
  return query.get<User>(
    `SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?`,
    [id]
  );
}

export function getUserByEmail(email: string): UserWithPassword | undefined {
  return query.get<UserWithPassword>(
    `SELECT id, email, password_hash, name, role, created_at, updated_at FROM users WHERE email = ?`,
    [email.toLowerCase()]
  );
}

export function getAllUsers(): User[] {
  return query.all<User>(
    `SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC`
  );
}

export function updateUser(
  id: number,
  updates: Partial<Pick<User, 'name' | 'email' | 'role'>>
): User | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.email !== undefined) {
    fields.push('email = ?');
    values.push(updates.email.toLowerCase());
  }
  if (updates.role !== undefined) {
    fields.push('role = ?');
    values.push(updates.role);
  }

  if (fields.length === 0) return getUserById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  query.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

  return getUserById(id);
}

export async function updatePassword(id: number, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  query.run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, [
    passwordHash,
    id
  ]);
}

export function deleteUser(id: number): boolean {
  const result = query.run(`DELETE FROM users WHERE id = ?`, [id]);
  return result.changes > 0;
}

// Session management
export function createSession(userId: number): Session {
  const id = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  query.run(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`, [
    id,
    userId,
    expiresAt.toISOString()
  ]);

  return {
    id,
    user_id: userId,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString()
  };
}

interface SessionQueryResult {
  id: string;
  user_id: number;
  expires_at: string;
  session_created_at: string;
  email: string;
  name: string;
  role: string;
  user_created_at: string;
  updated_at: string;
}

export function getSession(sessionId: string): (Session & { user: User }) | undefined {
  const result = query.get<SessionQueryResult>(
    `SELECT s.id, s.user_id, s.expires_at, s.created_at as session_created_at,
            u.email, u.name, u.role, u.created_at as user_created_at, u.updated_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > datetime('now')`,
    [sessionId]
  );

  if (!result) return undefined;

  return {
    id: result.id,
    user_id: result.user_id,
    expires_at: result.expires_at,
    created_at: result.session_created_at,
    user: {
      id: result.user_id,
      email: result.email,
      name: result.name,
      role: result.role as UserRole,
      created_at: result.user_created_at,
      updated_at: result.updated_at
    }
  };
}

export function deleteSession(sessionId: string): boolean {
  const result = query.run(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  return result.changes > 0;
}

export function deleteUserSessions(userId: number): void {
  query.run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
}

export function cleanExpiredSessions(): number {
  const result = query.run(`DELETE FROM sessions WHERE expires_at <= datetime('now')`);
  return result.changes;
}

// Login helper
export async function login(
  email: string,
  password: string
): Promise<{ user: User; session: Session } | null> {
  const user = getUserByEmail(email);
  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const session = createSession(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    },
    session
  };
}

// Check if any users exist (for initial setup)
export function hasUsers(): boolean {
  const result = query.get<{ count: number }>(`SELECT COUNT(*) as count FROM users`);
  return (result?.count || 0) > 0;
}

// Create first admin user if none exist
export async function ensureAdminExists(
  email: string,
  password: string,
  name: string
): Promise<User | null> {
  if (hasUsers()) return null;

  return createUser({
    email,
    password,
    name,
    role: 'admin'
  });
}
