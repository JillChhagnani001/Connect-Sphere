// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function CollabInvites() {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch pending invites for current user, include inviter profile and basic post info
        const { data, error } = await supabase
          .from('collaboration_invites')
          .select('id, post_id, inviter_id, invitee_id, role, status, invited_at, inviter:profiles(id,username,display_name,avatar_url), post:posts(id, text)')
          .eq('invitee_id', user.id)
          .eq('status', 'pending')
          .order('invited_at', { ascending: false });

        if (error) {
          console.warn('Error loading invites', error);
          setInvites([]);
        } else {
          setInvites(data || []);
        }
      } catch (e) {
        console.error('load invites error', e);
        setInvites([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const accept = async (invite: any) => {
    try {
      const supabase = createClient();

      // Fetch existing collaborators from post
      const { data: postData, error: postErr } = await supabase
        .from('posts')
        .select('collaborators')
        .eq('id', invite.post_id)
        .single();

      if (postErr) {
        throw postErr;
      }

      const existing = postData?.collaborators || [];
      const now = new Date().toISOString();
      const newEntry = {
        user_id: invite.invitee_id,
        role: invite.role || 'coauthor',
        accepted: true,
        invited_at: invite.invited_at || now,
        accepted_at: now,
      };

      const updated = [...existing, newEntry];

      // Update post collaborators
      const { error: updErr } = await supabase
        .from('posts')
        .update({ collaborators: updated })
        .eq('id', invite.post_id);

      if (updErr) throw updErr;

      // Mark invite accepted
      const { error: inviteErr } = await supabase
        .from('collaboration_invites')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', invite.id);

      if (inviteErr) throw inviteErr;

      setInvites(prev => prev.filter(i => i.id !== invite.id));
      toast({ title: 'Invite accepted', description: 'You are now a collaborator on the post.' });
    } catch (e) {
      console.error('accept invite error', e);
      toast({ title: 'Could not accept', description: 'Accepting invite failed. Ensure database tables exist.', variant: 'destructive' });
    }
  };

  const decline = async (invite: any) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('collaboration_invites')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', invite.id);

      if (error) throw error;
      setInvites(prev => prev.filter(i => i.id !== invite.id));
      toast({ title: 'Invite declined', description: 'You declined the collaboration invite.' });
    } catch (e) {
      console.error('decline invite error', e);
      toast({ title: 'Could not decline', description: 'Decline failed. Ensure database tables exist.', variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading invites…</div>;
  }

  if (!invites || invites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {invites.map((invite) => (
        <Card key={invite.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm">Invite from {invite.inviter?.display_name || invite.inviter?.username || invite.inviter_id}</span>
              <div className="text-xs text-muted-foreground">{new Date(invite.invited_at).toLocaleString()}</div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">Post: {invite.post?.text ? invite.post.text.slice(0, 120) : `#${invite.post_id}`}</p>
            <div className="flex gap-2">
              <Button onClick={() => accept(invite)}>Accept</Button>
              <Button variant="outline" onClick={() => decline(invite)}>Decline</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
