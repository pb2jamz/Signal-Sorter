import { useState, useEffect, createContext, useContext } from 'react'
import { supabase, getUserProfile, hasCompletedOnboarding } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    // Force loading to false after 3 seconds no matter what
    const forceTimeout = setTimeout(() => setLoading(false), 3000)

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
          
          const completed = await hasCompletedOnboarding(session.user.id)
          setNeedsOnboarding(!completed)
          
          if (completed) {
            const userProfile = await getUserProfile(session.user.id)
            if (userProfile) setProfile(userProfile)
          }
        }
      } catch (error) {
        console.error('Auth error:', error)
      }
      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        const completed = await hasCompletedOnboarding(session.user.id)
        setNeedsOnboarding(!completed)
        if (completed) {
          const userProfile = await getUserProfile(session.user.id)
          if (userProfile) setProfile(userProfile)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setNeedsOnboarding(false)
      }
    })

    return () => {
      clearTimeout(forceTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const completeOnboarding = async (profileData) => {
    if (!user) throw new Error('No user')
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      ...profileData,
      onboarding_completed: true
    })
    setProfile({ id: user.id, email: user.email, ...profileData })
    setNeedsOnboarding(false)
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('No user')
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    if (data) setProfile(data)
    return data
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      needsOnboarding,
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
