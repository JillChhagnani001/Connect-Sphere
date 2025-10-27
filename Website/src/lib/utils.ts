import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Storage configuration
export const STORAGE_BUCKETS = {
  avatars: process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars',
  media: process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || 'media',
};

export function getBucketOrThrow(kind: keyof typeof STORAGE_BUCKETS): string {
  const bucket = STORAGE_BUCKETS[kind];
  if (!bucket) {
    throw new Error(`Storage bucket for ${kind} is not configured`);
  }
  return bucket;
}