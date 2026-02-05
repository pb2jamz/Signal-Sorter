import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [error, setError] = useState(null)

  // Ensure user exists in public.users table
  const ensureUserExists = async (authUser) => {
    if (!authUser) return null
    
    try {
      // First try to get existing profile
      const { data: existing, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (existing) {
        console.log('[Auth] Found existing user profile')
        return existing
      }
      
      // If not found, create it
      if (fetchError?.code === 'PGRST116') { // Row not found
        console.log('[Auth] Creating new user profile')
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email,
            onboarding_completed: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single()
        
        if (insertError) {
          console.error('[Auth] Failed to create user:', insertError)
          return null
        }
        return newUser
      }
      
      console.error('[Auth] Error fetching user:', fetchError)
      return null
    } catch (err) {
      console.error('[Auth] ensureUserExists error:', err)
      return null
    }
  }

  useEffect(() => {
    let mounted = true
    
    const initAuth = async () => {
      console.log('[Auth] Initializing...')
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[Auth] Session error:', sessionError)
          setError(sessionError.message)
          if (mounted) setLoading(false)
          return
        }
        
        if (session?.user) {
          console.log('[Auth] Session found for:', session.user.email)
          if (mounted) setUser(session.user)
          
          const userProfile = await ensureUserExists(session.user)
          
          if (mounted && userProfile) {
            setProfile(userProfile)
            setNeedsOnboarding(!userProfile.onboarding_completed)
            console.log('[Auth] Profile loaded, onboarding:', !userProfile.onboarding_completed)
          } else if (mounted) {
            setNeedsOnboarding(true)
          }
        } else {
          console.log('[Auth] No session found')
        }
      } catch (err) {
        console.error('[Auth] Init error:', err)
        setError(err.message)
      }
      
      if (mounted) setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event)
      
      if (!mounted) return
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        setError(null)
        
        const userProfile = await ensureUserExists(session.user)
        if (mounted && userProfile) {
          setProfile(userProfile)
          setNeedsOnboarding(!userProfile.onboarding_completed)
        } else if (mounted) {
          setNeedsOnboarding(true)
        }
        
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setNeedsOnboarding(false)
        
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email, password) => {
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
  }

  const signIn = async (email, password) => {
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
  }

  const signOut = async () => {
    console.log('[Auth] Signing out')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[Auth] Signout error:', error)
    }
  }

  const completeOnboarding = async (profileData) => {
    if (!user) throw new Error('No user logged in')
    
    console.log('[Auth] Completing onboarding:', profileData)
    
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
    
    console.log('[Auth] Onboarding complete:', data)
    setProfile(data)
    setNeedsOnboarding(false)
    return data
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('No user logged in')
    
    console.log('[Auth] Updating profile:', updates)
    
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
    
    console.log('[Auth] Profile updated:', data)
    setProfile(data)
    return data
  }

  return (
    <AuthContext.Provider value={{
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
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
