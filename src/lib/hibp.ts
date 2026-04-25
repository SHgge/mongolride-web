/**
 * HaveIBeenPwned k-anonymity API ашиглан нууц үг алдагдсан эсэхийг шалгах.
 * Зөвхөн SHA-1 hash-ийн эхний 5 тэмдэгт сервер рүү илгээгдэнэ.
 *
 * Fail open: API уналт болоход signup-г блоклохгүй (false буцаана).
 *
 * @returns true if password found in breach database
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return false;

    const text = await res.text();
    return text.split('\n').some((line) => line.split(':')[0].trim() === suffix);
  } catch {
    return false;
  }
}
