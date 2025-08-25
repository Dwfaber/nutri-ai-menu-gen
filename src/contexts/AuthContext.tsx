import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { signInAsDemo } from '@/services/demoAuth';

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'nutritionist' | 'viewer';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRoles: UserRole[];
  loading: boolean;
  isDemoMode: boolean;
  hasRole: (role: 'admin' | 'nutritionist' | 'viewer') => boolean;
  isAdmin: boolean;
  isNutritionist: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  enableDemoMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const hasRole = (role: 'admin' | 'nutritionist' | 'viewer') => {
    return userRoles.some(userRole => userRole.role === role);
  };

  const isAdmin = hasRole('admin');
  const isNutritionist = hasRole('nutritionist') || hasRole('admin');

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        return;
      }

      setProfile(profileData);

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        return;
      }

      setUserRoles(rolesData || []);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
    setIsDemoMode(false);
  };

  const enableDemoMode = async () => {
    try {
      setLoading(true);
      const result = await signInAsDemo();
      if (result.success) {
        setIsDemoMode(true);
        console.log('Demo mode enabled successfully');
      } else {
        console.error('Failed to enable demo mode:', result.error);
      }
    } catch (error) {
      console.error('Error enabling demo mode:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
        // Check if this is the demo user
        if (session.user.email === 'demo@nutris.app') {
          setIsDemoMode(true);
        }
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Small delay to ensure profile is created by trigger
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 100);
          // Check if this is the demo user
          if (session.user.email === 'demo@nutris.app') {
            setIsDemoMode(true);
          }
        } else {
          setProfile(null);
          setUserRoles([]);
          setIsDemoMode(false);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    session,
    profile,
    userRoles,
    loading,
    isDemoMode,
    hasRole,
    isAdmin,
    isNutritionist,
    signOut,
    refreshProfile,
    enableDemoMode,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};