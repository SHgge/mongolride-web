interface SupabaseAuthError {
  message: string;
  status?: number;
  code?: string;
  name?: string;
}

/**
 * Supabase auth алдааг enumeration attack-аас хамгаалсан generic мессеж болгох.
 * Жинхэнэ алдааг console-д debug-д хэвлэнэ.
 *
 * @example
 * if (error) toast.error(genericAuthError(error));
 */
export function genericAuthError(error: SupabaseAuthError): string {
  // Internal: жинхэнэ шалтгааныг debug-д хадгалах
  console.error('[auth]', error.code ?? error.status, error.message);

  // Network / server алдаа enumerable биш — жинхэнээр харуулах
  if ((error.status && error.status >= 500) || /network|fetch|failed to fetch/i.test(error.message)) {
    return 'Сүлжээний алдаа. Дахин оролдоно уу.';
  }

  // Rate limit алдаа
  if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
    return 'Хэт олон оролдлого. Хэсэг хүлээгээд дахин оролдоно уу.';
  }

  // Бусад бүгд → generic
  return 'Имэйл эсвэл нууц үг буруу байна.';
}

/**
 * Email confirm шаардсан алдаа эсэхийг шалгах
 * (verify-email-needed page руу redirect хийхэд ашиглана)
 */
export function isEmailNotConfirmed(error: SupabaseAuthError): boolean {
  return /email not confirmed|email_not_confirmed/i.test(error.message);
}
