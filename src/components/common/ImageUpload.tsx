import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ImageUploadProps {
  bucket: 'avatars' | 'routes' | 'listings';
  folder: string;
  onUpload: (url: string) => void;
  currentUrl?: string | null;
  shape?: 'square' | 'circle';
  size?: 'sm' | 'md' | 'lg';
  multiple?: boolean;
  onMultiUpload?: (urls: string[]) => void;
  existingUrls?: string[];
}

const SIZES = {
  sm: { container: 'w-20 h-20', icon: 'w-5 h-5' },
  md: { container: 'w-32 h-32', icon: 'w-8 h-8' },
  lg: { container: 'w-full h-48', icon: 'w-10 h-10' },
};

export default function ImageUpload({
  bucket,
  folder,
  onUpload,
  currentUrl,
  shape = 'square',
  size = 'md',
  multiple = false,
  onMultiUpload,
  existingUrls = [],
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [multiPreviews, setMultiPreviews] = useState<string[]>(existingUrls);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      if (multiple) {
        const urls: string[] = [];
        for (const file of Array.from(files)) {
          const url = await uploadFile(file);
          if (url) urls.push(url);
        }
        const all = [...multiPreviews, ...urls];
        setMultiPreviews(all);
        onMultiUpload?.(all);
      } else {
        const file = files[0];
        const url = await uploadFile(file);
        if (url) {
          setPreview(url);
          onUpload(url);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    // Validate
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Файлын хэмжээ 5MB-ээс хэтэрч байна');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Зөвхөн зураг upload хийнэ');
    }

    const ext = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  };

  const removeImage = (url: string) => {
    if (multiple) {
      const updated = multiPreviews.filter((u) => u !== url);
      setMultiPreviews(updated);
      onMultiUpload?.(updated);
    } else {
      setPreview(null);
      onUpload('');
    }
  };

  const s = SIZES[size];
  const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  // Multi upload mode
  if (multiple) {
    return (
      <div>
        <div className="flex flex-wrap gap-3">
          {multiPreviews.map((url) => (
            <div key={url} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-[10px]">Нэмэх</span>
              </>
            )}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>
    );
  }

  // Single upload mode
  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`${s.container} ${roundedClass} border-2 border-dashed border-gray-200 hover:border-primary-300 cursor-pointer overflow-hidden flex items-center justify-center relative transition-colors ${
          preview ? 'border-solid border-gray-100' : ''
        }`}
      >
        {uploading ? (
          <Loader2 className={`${s.icon} text-primary-500 animate-spin`} />
        ) : preview ? (
          <>
            <img src={preview} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
              <Upload className="w-5 h-5 text-white opacity-0 hover:opacity-100" />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeImage(preview); }}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <ImageIcon className={s.icon} />
            <span className="text-xs mt-1">Зураг оруулах</span>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
