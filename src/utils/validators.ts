import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('И-мэйл хаяг буруу байна'),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт'),
});

export const registerSchema = z.object({
  email: z.string().email('И-мэйл хаяг буруу байна'),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт'),
  username: z.string().min(3, 'Хэрэглэгчийн нэр хамгийн багадаа 3 тэмдэгт'),
  full_name: z.string().min(2, 'Нэр хамгийн багадаа 2 тэмдэгт'),
});

export const routeSchema = z.object({
  title: z.string().min(3, 'Гарчиг хамгийн багадаа 3 тэмдэгт'),
  description: z.string().optional(),
  distance_km: z.number().positive('Зай эерэг тоо байх ёстой'),
  elevation_gain: z.number().optional(),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'expert']),
  surface: z.enum(['paved', 'gravel', 'dirt', 'mixed']),
});

export const listingSchema = z.object({
  title: z.string().min(3, 'Гарчиг хамгийн багадаа 3 тэмдэгт'),
  description: z.string().optional(),
  price: z.number().positive('Үнэ эерэг тоо байх ёстой'),
  category: z.enum(['bike', 'parts', 'accessories', 'clothing', 'other']),
  condition: z.enum(['new', 'like_new', 'good', 'fair']),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RouteInput = z.infer<typeof routeSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
