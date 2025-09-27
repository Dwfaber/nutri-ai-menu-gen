import { supabase } from '../integrations/supabase/client';

const DEMO_USER_EMAIL = 'demo@nutris.app';
const DEMO_USER_PASSWORD = 'demo123456';

export const createDemoUserIfNotExists = async () => {
  try {
    // Try to sign in with demo credentials first
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
    });

    if (signInData.user) {
      console.log('Demo user already exists and signed in');
      return { success: true, user: signInData.user };
    }

    // If sign in failed, try to create the demo user
    if (signInError?.message?.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: 'Demo',
            last_name: 'User',
          }
        }
      });

      if (signUpError) {
        console.error('Failed to create demo user:', signUpError);
        return { success: false, error: signUpError };
      }

      console.log('Demo user created successfully');
      return { success: true, user: signUpData.user };
    }

    return { success: false, error: signInError };
  } catch (error) {
    console.error('Error in createDemoUserIfNotExists:', error);
    return { success: false, error };
  }
};

export const signInAsDemo = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
    });

    if (error) {
      // Try to create demo user if it doesn't exist
      const createResult = await createDemoUserIfNotExists();
      if (!createResult.success) {
        throw createResult.error;
      }
      return createResult;
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Error signing in as demo:', error);
    return { success: false, error };
  }
};