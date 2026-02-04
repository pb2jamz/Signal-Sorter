import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export const useFeedback = () => {
  const { user } = useAuth()

  const submitFeedback = async (type, message, metadata = {}) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id || null,
          type, // 'bug', 'feature', 'general'
          message,
          metadata: {
            ...metadata,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        })

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error submitting feedback:', err)
      throw err
    }
  }

  return { submitFeedback }
}
