import { useState, useEffect, createContext, useContext } from 'react'
import { supabase, getUserProfile, hasCompletedOnboarding } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
          
          // Check if user has completed onboarding
          const completed = await hasCompletedOnboarding(session.user.id)
          setNeedsOnboarding(!completed)
          
          if (completed) {
            const userProfile = await getUserProfile(session.user.id)
            setProfile(userProfile)
          }
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        
        const completed = await hasCompletedOnboarding(session.user.id)
        setNeedsOnboarding(!completed)
        
        if (completed) {
          const userProfile = await getUserProfile(session.user.id)
          setProfile(userProfile)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setNeedsOnboarding(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
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
