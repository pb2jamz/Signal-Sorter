import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper to get user profile
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) return null
  return data
}

// Helper to check if user has completed onboarding
export const hasCompletedOnboarding = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', userId)
    .single()
  
  if (error) return false
  return data?.onboarding_completed || false
}
