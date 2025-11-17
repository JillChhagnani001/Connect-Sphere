'use server';

import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function createCommunity(formData: FormData) {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be logged in to create a community' };
  }

  // Only allow verified creators to create communities
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('is_verified')
    .eq('id', user.id)
    .single();

  if (!userProfile?.is_verified) {
    return { error: 'Only verified creators can create communities. Apply for verification to continue.' };
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const membershipType = formData.get('membership_type') as 'free' | 'paid';
  // Price is stored in rupees (no conversion needed)
  const price = formData.get('price') ? parseFloat(formData.get('price') as string) : null;
  const avatarUrl = formData.get('avatar_url') as string | null;
  const coverImageUrl = formData.get('cover_image_url') as string | null;

  if (!name || name.trim().length === 0) {
    return { error: 'Community name is required' };
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) {
    return { error: 'Invalid community name' };
  }

  // Check if slug already exists
  const { data: existing } = await supabase
    .from('communities')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    return { error: 'A community with this name already exists' };
  }

  // Validate price for paid communities
  if (membershipType === 'paid' && (!price || price <= 0)) {
    return { error: 'Price is required for paid communities' };
  }

  const { data, error } = await supabase
    .from('communities')
    .insert({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      membership_type: membershipType,
      price: membershipType === 'paid' ? price : null,
      currency: membershipType === 'paid' ? 'INR' : null,
      owner_id: user.id,
      avatar_url: avatarUrl || null,
      cover_image_url: coverImageUrl || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Add creator as owner member
  await supabase
    .from('community_members')
    .insert({
      community_id: data.id,
      user_id: user.id,
      role: 'owner',
      status: 'active',
    });

  revalidatePath('/communities');
  revalidatePath(`/communities/${slug}`);

  return { data, error: null };
}

export async function joinCommunity(communityId: number) {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be logged in to join a community' };
  }

  // Check if community exists
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('*')
    .eq('id', communityId)
    .single();

  if (communityError || !community) {
    return { error: 'Community not found' };
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('community_members')
    .select('*')
    .eq('community_id', communityId)
    .eq('user_id', user.id)
    .single();

  if (existingMember) {
    if (existingMember.status === 'active') {
      return { error: 'You are already a member of this community' };
    }
    // Rejoin if previously left
    const { error: updateError } = await supabase
      .from('community_members')
      .update({
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .eq('id', existingMember.id);

    if (updateError) {
      return { error: updateError.message };
    }

    revalidatePath('/communities');
    revalidatePath(`/communities/${community.slug}`);
    return { data: { joined: true }, error: null };
  }

  // For paid communities, set status to pending until payment is processed
  // For now, we'll set it to active (payment integration can be added later)
  const status = community.membership_type === 'paid' ? 'pending' : 'active';

  const { data, error } = await supabase
    .from('community_members')
    .insert({
      community_id: communityId,
      user_id: user.id,
      role: 'member',
      status,
      payment_status: community.membership_type === 'paid' ? 'pending' : null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/communities');
  revalidatePath(`/communities/${community.slug}`);

  return { data, error: null };
}

export async function leaveCommunity(communityId: number) {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be logged in to leave a community' };
  }

  // Check if user is the owner
  const { data: community } = await supabase
    .from('communities')
    .select('owner_id, slug')
    .eq('id', communityId)
    .single();

  if (community?.owner_id === user.id) {
    return { error: 'Community owners cannot leave their community' };
  }

  const { error } = await supabase
    .from('community_members')
    .update({ status: 'left' })
    .eq('community_id', communityId)
    .eq('user_id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/communities');
  if (community?.slug) {
    revalidatePath(`/communities/${community.slug}`);
  }

  return { data: { left: true }, error: null };
}

export async function deleteCommunity(communityId: number) {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be logged in' };
  }

  // Check if user is the owner
  const { data: community, error: checkError } = await supabase
    .from('communities')
    .select('owner_id, slug')
    .eq('id', communityId)
    .single();

  if (checkError || !community) {
    return { error: 'Community not found' };
  }

  if (community.owner_id !== user.id) {
    return { error: 'Only the community owner can delete the community' };
  }

  const { error } = await supabase
    .from('communities')
    .delete()
    .eq('id', communityId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/communities');
  return { data: { deleted: true }, error: null };
}

export async function updateMemberRole(
  communityId: number,
  targetUserId: string,
  role: 'member' | 'co_owner'
) {
  const supabase = createServerClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in' };
  }

  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('owner_id, slug')
    .eq('id', communityId)
    .single();

  if (communityError || !community) {
    return { error: 'Community not found' };
  }

  if (community.owner_id !== user.id) {
    return { error: 'Only the community owner can manage member roles' };
  }

  if (targetUserId === user.id) {
    return { error: 'Owner role cannot be changed' };
  }

  const { data: member, error: memberError } = await supabase
    .from('community_members')
    .select('id, role, status')
    .eq('community_id', communityId)
    .eq('user_id', targetUserId)
    .single();

  if (memberError || !member) {
    return { error: 'Member not found' };
  }

  if (member.role === 'owner') {
    return { error: 'Cannot change the owner role via promotion' };
  }

  if (member.status !== 'active') {
    return { error: 'Only active members can be promoted' };
  }

  const { error } = await admin
    .from('community_members')
    .update({ role })
    .eq('id', member.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/communities/${community.slug}`);
  return { data: { updated: true }, error: null };
}

