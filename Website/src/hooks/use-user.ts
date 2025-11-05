"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/types';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const hasInitializedFromCacheRef = useRef(false);

  const CACHE_KEY = 'useUser:profile:v1';

  const fetchProfile = useCallback(async (authUser: User, retries = 5, delay = 500) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "exact-single-row-not-found"
        throw error;
      }
      
      if (data) {
        setProfile(data);
        // Cache for faster subsequent page loads
        try {
          const payload = { profile: data, cachedAt: Date.now() };
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch (_) {
          // Ignore cache write errors (e.g., storage full or SSR)
        }
        setLoading(false); // Found profile, stop loading.
        return true;
      }
      
      if (retries > 0) {
        // If profile is not found, it might be due to replication lag after signup trigger.
        // We'll retry a few times.
        setTimeout(() => fetchProfile(authUser, retries - 1, delay), delay);
        return false; // Not yet successful, but retrying
      }

      // If still no data after retries, it's a real "not found" situation.
      setError(new Error("Profile not found after multiple retries."));
      setLoading(false); // Stop loading after retries are exhausted.
      return false; 

    } catch (e) {
      setError(e);
      setLoading(false);
      return false; 
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const fetchUserAndProfile = async () => {
      // 1) Try fast path from cache to avoid UI flicker
      if (!hasInitializedFromCacheRef.current) {
        hasInitializedFromCacheRef.current = true;
        try {
          const raw = sessionStorage.getItem(CACHE_KEY);
          if (raw) {
            const { profile: cachedProfile, cachedAt } = JSON.parse(raw);
            // Use cache immediately
            if (cachedProfile) {
              setProfile(cachedProfile);
              setLoading(false);
            }
            // Optionally refresh if cache is older than 5 minutes
            const isStale = !cachedAt || (Date.now() - cachedAt) > 5 * 60 * 1000;
            if (isStale) {
              // We'll still continue to refresh below once we know the user
            }
          }
        } catch (_) {
          // Ignore cache read errors
        }
      }

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (authError) {
        setError(authError);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (authUser) {
        setUser(authUser);
        // If we already have a cached profile for this user, keep UI responsive
        // but still refresh in background to get latest data.
        fetchProfile(authUser);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    fetchUserAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      const newAuthUser = session?.user ?? null;
      setUser(newAuthUser);
      
      if (newAuthUser) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || !profile) {
            setLoading(true);
            fetchProfile(newAuthUser);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return { user, profile, loading, error };
}
