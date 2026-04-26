import { supabase } from './supabase';

/**
 * Audit log helper — admin үйлдлийг log-д бичих
 * Edge Function `log-audit-event`-д хүсэлт илгээнэ.
 * Зөвхөн нэвтэрсэн admin user-ийн хувьд ажиллана.
 *
 * @example
 * await logAudit('role.changed', targetUserId, { from: 'member', to: 'admin' });
 * await logAudit('password.changed', userId);
 */
export async function logAudit(
  action: string,
  target_id?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-audit-event`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, target_id, details }),
    });
  } catch (err) {
    // Audit log алдаа нь хэрэглэгчийн үйлдэлд саад болохгүй
    console.error('[audit]', err);
  }
}

/** Common audit action strings (constants for type safety) */
export const AuditActions = {
  ROLE_CHANGED: 'role.changed',
  PASSWORD_CHANGED: 'password.changed',
  USER_DEACTIVATED: 'user.deactivated',
  USER_ACTIVATED: 'user.activated',
} as const;
