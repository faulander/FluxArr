import { query } from './db';

export interface UserSettings {
  id: number;
  user_id: number;
  primary_color_light: string;
  primary_color_dark: string;
  created_at: string;
  updated_at: string;
}

export function getUserSettings(userId: number): UserSettings | undefined {
  return query.get<UserSettings>('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
}

export function saveUserSettings(
  userId: number,
  settings: { primaryColorLight?: string; primaryColorDark?: string }
): UserSettings {
  const existing = getUserSettings(userId);

  if (existing) {
    // Update existing settings
    const fields: string[] = ["updated_at = datetime('now')"];
    const values: unknown[] = [];

    if (settings.primaryColorLight !== undefined) {
      fields.push('primary_color_light = ?');
      values.push(settings.primaryColorLight);
    }
    if (settings.primaryColorDark !== undefined) {
      fields.push('primary_color_dark = ?');
      values.push(settings.primaryColorDark);
    }

    values.push(userId);
    query.run(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`, values);
  } else {
    // Create new settings
    query.run(
      `INSERT INTO user_settings (user_id, primary_color_light, primary_color_dark) VALUES (?, ?, ?)`,
      [userId, settings.primaryColorLight || '#000000', settings.primaryColorDark || '#ffffff']
    );
  }

  return getUserSettings(userId)!;
}
