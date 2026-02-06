import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  userCountry: string | null;
  userRole: string | null;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  profileLoading: true,
  signOut: async () => {},
  userCountry: null,
  userRole: null
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfileLoading(false);
      setUserCountry(null);
      setUserRole(null);
      localStorage.removeItem('userRole');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('country, role')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }
      
      setUserCountry(data?.country || 'france');
      setUserRole(data?.role || null);
      
      // Stocker le rôle dans localStorage pour y accéder facilement
      if (data?.role) {
        localStorage.setItem('userRole', data.role);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        // Don't log "Auth session missing!" as an error since it's a normal state
        if (error.message !== 'Auth session missing!') {
          // Provide more detailed error logging
          console.error('Auth error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            url: import.meta.env.VITE_SUPABASE_URL
          });
          console.error('Auth error:', error);
        }
        
        if (error.message === 'User from sub claim in JWT does not exist' || 
            error.message.includes('User from sub claim in JWT does not exist')) {
          // Clear the invalid session
          supabase.auth.signOut();
          setUser(null);
          setUserCountry(null);
          setUserRole(null);
          localStorage.removeItem('userRole');
        } else {
          setUser(null);
          setUserCountry(null);
          setUserRole(null);
          localStorage.removeItem('userRole');
        }
      } else {
        setUser(user);
        if (user) {
          fetchUserProfile(user.id);
        } else {
          setProfileLoading(false);
        }
      }
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to get user:', error);
      // Explicitly sign out on any authentication error
      signOut();
      setLoading(false);
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUserCountry(null);
        setUserRole(null);
        localStorage.removeItem('userRole');
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Global error handler for Supabase requests
  useEffect(() => {
    const handleSupabaseError = (error: any) => {
      if (error?.message === 'User from sub claim in JWT does not exist' ||
          error?.message?.includes('User from sub claim in JWT does not exist') ||
          error?.message?.includes('Invalid Refresh Token') ||
          error?.message?.includes('refresh_token_not_found')) {
        console.log('Detected invalid JWT, signing out user');
        signOut();
      }
    };

    // Add a global error listener for unhandled Supabase errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok && args[0]?.toString().includes('supabase.co')) {
          const errorText = await response.clone().text();
          console.error('Supabase fetch error:', {
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            errorText
          });
          
          // Handle 401 Unauthorized or specific error messages
          if (response.status === 401 || 
              errorText.includes('User from sub claim in JWT does not exist') ||
              errorText.includes('Invalid Refresh Token') ||
              errorText.includes('refresh_token_not_found')) {
            handleSupabaseError({ message: 'User from sub claim in JWT does not exist' });
          }
        }
        return response;
      } catch (error) {
        if (args[0]?.toString().includes('supabase.co')) {
          console.error('Network error connecting to Supabase:', {
            url: args[0],
            error: error.message
          });
          handleSupabaseError(error);
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, profileLoading, signOut, userCountry, userRole }}>
      {children}
    </AuthContext.Provider>
  );
};