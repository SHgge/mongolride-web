import { supabase } from '../lib/supabase';

export const storageService = {
  async uploadFile(bucket: string, path: string, file: File) {
    return supabase.storage.from(bucket).upload(path, file);
  },
  getPublicUrl(bucket: string, path: string) {
    return supabase.storage.from(bucket).getPublicUrl(path);
  },
  async deleteFile(bucket: string, path: string) {
    return supabase.storage.from(bucket).remove([path]);
  },
};
