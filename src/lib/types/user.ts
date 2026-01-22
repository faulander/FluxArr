export type UserRole = 'admin' | 'user' | 'restricted';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface UserRestriction {
  id: number;
  user_id: number;
  restriction_type: 'genre' | 'rating_max' | 'language';
  restriction_value: string;
  created_at: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}
