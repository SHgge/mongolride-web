import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Нууц үг доод тал нь 8 тэмдэгт байх ёстой')
  .regex(/[A-Z]/, 'Дор хаяж 1 том үсэг агуулсан байх ёстой')
  .regex(/[0-9]/, 'Дор хаяж 1 тоо агуулсан байх ёстой');

export const emailSchema = z.string().email('Имэйл хаяг буруу байна');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Нууц үг шаардлагатай'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().min(2, 'Нэр доод тал нь 2 тэмдэгт байх ёстой'),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
  message: 'Нууц үгүүд таарахгүй байна',
  path: ['confirm'],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
