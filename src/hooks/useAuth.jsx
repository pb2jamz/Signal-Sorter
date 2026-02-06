/**
 * Signal Sorter Auth Hook
 * 
 * World-class implementation with:
 * - Robust session persistence
 * - Automatic token refresh
 * - Profile sync with database
 * - Proper error handling
 */

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [error, setError] = useState(null)

  // Ensure user profile exists in database
  const ensureProfile = useCallback(async (authUser) => {
    if (!authUser) return null

    try {
      // Try to fetch existing profile
      const { data: existing, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (existing) {
        console.log('[Auth] Profile found')
        return existing
      }

      // Create new profile if not found (PGRST116 = not found)
      if (fetchError?.code === 'PGRST116') {
        console.log('[Auth] Creating profile')
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email,
            onboarding_completed: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) {
          console.error('[Auth] Profile creation failed:', createError)
          return null
        }
        return newProfile
      }

      console.error('[Auth] Profile fetch error:', fetchError)
      return null
    } catch (err) {
      console.error('[Auth] ensureProfile error:', err)
      return null
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const init = async () => {
      console.log('[Auth] Initializing...')

      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('[Auth] Session error:', sessionError)
          setError(sessionError.message)
          if (mounted) setLoading(false)
          return
        }

        if (session?.user) {
          console.log('[Auth] Session found:', session.user.email)
          if (mounted) setUser(session.user)

          const userProfile = await ensureProfile(session.user)
          
          if (mounted && userProfile) {
            setProfile(userProfile)
            setNeedsOnboarding(!userProfile.onboarding_completed)
          } else if (mounted) {
            setNeedsOnboarding(true)
          }
        } else {
          console.log('[Auth] No session')
        }
      } catch (err) {
        console.error('[Auth] Init error:', err)
        setError(err.message)
      }

      if (mounted) {
        console.log('[Auth] Init complete')
        setLoading(false)
      }
    }

    // Timeout safety net
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] Init timeout, forcing completion')
        setLoading(false)
      }
    }, 5000)

    init()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Event:', event)

      if (!mounted) return

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        setError(null)

        const userProfile = await ensureProfile(session.user)
        if (mounted) {
          setProfile(userProfile)
          setNeedsOnboarding(!userProfile?.onboarding_completed)
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setNeedsOnboarding(false)
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed')
      } else if (event === 'USER_UPDATED') {
        if (session?.user) setUser(session.user)
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [ensureProfile])

  // Sign up
  const signUp = useCallback(async (email, password) => {
    console.log('[Auth] Signing up:', email)
    setError(null)

    const { data, error } = await supabase.auth.signUp({ email, password })
    
    if (error) {
      console.error('[Auth] Signup error:', error)
      setError(error.message)
      throw error
    }

    console.log('[Auth] Signup successful')
    return data
  }, [])

  // Sign in
  const signIn = useCallback(async (email, password) => {
    console.log('[Auth] Signing in:', email)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      console.error('[Auth] Signin error:', error)
      setError(error.message)
      throw error
    }

    console.log('[Auth] Signin successful')
    return data
  }, [])

  // Sign out
  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out')
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('[Auth] Signout error:', error)
      throw error
    }

    // Clear local state immediately
    setUser(null)
    setProfile(null)
    setNeedsOnboarding(false)
  }, [])

  // Complete onboarding
  const completeOnboarding = useCallback(async (profileData) => {
    if (!user) throw new Error('Not authenticated')

    console.log('[Auth] Completing onboarding')

    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        ...profileData,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[Auth] Onboarding error:', error)
      throw error
    }

    console.log('[Auth] Onboarding complete')
    setProfile(data)
    setNeedsOnboarding(false)
    return data
  }, [user])

  // Update profile
  const updateProfile = useCallback(async (updates) => {
    if (!user) throw new Error('Not authenticated')

    console.log('[Auth] Updating profile')

    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[Auth] Update error:', error)
      throw error
    }

    console.log('[Auth] Profile updated')
    setProfile(data)
    return data
  }, [user])

  const value = {
    user,
    profile,
    loading,
    needsOnboarding,
    error,
    signUp,
    signIn,
    signOut,
    completeOnboarding,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
