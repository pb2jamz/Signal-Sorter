import { useState, useEffect, createContext, useContext } from 'react'
import { supabase, getUserProfile, hasCompletedOnboarding } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let isMounted = true
    
    // Timeout failsafe - don't hang forever
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth initialization timed out')
        setLoading(false)
      }
    }, 5000) // 5 second max wait

    const initAuth = async () => {
      try {
        console.log('Initializing auth...')
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setAuthError(sessionError.message)
          if (isMounted) setLoading(false)
          return
        }
        
        console.log('Session:', session ? 'exists' : 'none')
        
        if (session?.user) {
          if (isMounted) setUser(session.user)
          
          try {
            const completed = await hasCompletedOnboarding(session.user.id)
            console.log('Onboarding completed:', completed)
            
            if (isMounted) setNeedsOnboarding(!completed)
            
            if (completed) {
              const userProfile = await getUserProfile(session.user.id)
              console.log('Profile loaded:', userProfile?.name)
              if (isMounted) setProfile(userProfile)
            }
          } catch (profileError) {
            console.error('Profile error:', profileError)
            if (isMounted) setNeedsOnboarding(true)
          }
        }
        
        if (isMounted) setLoading(false)
        
      } catch (error) {
        console.error('Auth init error:', error)
        setAuthError(error.message)
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)
      
      if (event === 'SIGNED_IN' && session?.user) {
        if (isMounted) {
          setUser(session.user)
          setAuthError(null)
        }
        
        try {
          const completed = await hasCompletedOnboarding(session.user.id)
          if (isMounted) setNeedsOnboarding(!completed)
          
          if (completed) {
            const userProfile = await getUserProfile(session.user.id)
            if (isMounted) setProfile(userProfile)
          }
        } catch (err) {
          console.error('Profile load error:', err)
          if (isMounted) setNeedsOnboarding(true)
        }
        
        if (isMounted) setLoading(false)
        
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(null)
          setProfile(null)
          setNeedsOnboarding(false)
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email, password) => {
    setAuthError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    if (error) {
      setAuthError(error.message)
      throw error
    }
    return data
  }

  const signIn = async (email, password) => {
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) {
      setAuthError(error.message)
      throw error
    }
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
      throw error
    }
  }

  const completeOnboarding = async (profileData) => {
    if (!user) throw new Error('No user logged in')

    const { error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        ...profileData,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })

    if (error) throw error

    setProfile({ id: user.id, email: user.email, ...profileData })
    setNeedsOnboarding(false)
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('No user logged in')

    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error
    setProfile(data)
    return data
  }

  const value = {
    user,
    profile,
    loading,
    needsOnboarding,
    authError,
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
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
