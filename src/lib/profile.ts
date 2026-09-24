export function buildProfileImageUrl(imagePath: string | null | undefined): string | null {
  const path = (imagePath ?? '').trim();
  if (!path) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkbpvgyisrmwooecgyzr.supabase.co';
  return `${supabaseUrl}/storage/v1/object/public/profile-pictures/${path}`;
}
