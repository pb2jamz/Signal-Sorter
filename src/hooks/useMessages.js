import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hey! Just dump everything on your mind — work stuff, personal stuff, whatever's competing for your attention. I'll sort out what's signal and what's noise for you.\n\nNo scoring, no decisions. Just tell me what's going on."
}

export const useMessages = () => {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  // Load messages from Supabase
  const loadMessages = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error

      if (data && data.length > 0) {
        setMessages(data.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content
        })))
      } else {
        // Personalize initial message if we have profile
        const initialMsg = profile?.name 
          ? { ...INITIAL_MESSAGE, content: `Hey ${profile.name}! ${INITIAL_MESSAGE.content.substring(4)}` }
          : INITIAL_MESSAGE
        setMessages([initialMsg])
      }
    } catch (err) {
      console.error('Error loading messages:', err)
      setMessages([INITIAL_MESSAGE])
    } finally {
      setLoading(false)
    }
  }, [user, profile])

  // Load messages and set up real-time subscription
  useEffect(() => {
    loadMessages()

    // Set up real-time subscription for cross-device sync
    if (!user) return

    console.log('[Messages] Setting up real-time subscription')
    
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[Messages] Real-time insert')
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, {
              id: payload.new.id,
              role: payload.new.role,
              content: payload.new.content
            }]
          })
        }
      )
      .subscribe((status) => {
        console.log('[Messages] Subscription status:', status)
      })

    return () => {
      console.log('[Messages] Cleaning up subscription')
      supabase.removeChannel(channel)
    }
  }, [user, loadMessages])

  // Add a message
  const addMessage = async (role, content) => {
    if (!user) return

    const newMessage = { role, content }
    
    // Optimistic update
    setMessages(prev => [...prev, newMessage])

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          role,
          content,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      // Update with real ID
      setMessages(prev => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        if (updated[lastIndex].content === content) {
          updated[lastIndex] = { id: data.id, role, content }
        }
        return updated
      })
    } catch (err) {
      console.error('Error saving message:', err)
      // Keep the message in UI even if save fails
    }
  }

  // Clear chat history
  const clearMessages = async () => {
    if (!user) return

    try {
      await supabase
        .from('messages')
        .delete()
        .eq('user_id', user.id)

      const initialMsg = profile?.name 
        ? { role: 'assistant', content: `Fresh start, ${profile.name}. What's on your mind?` }
        : { role: 'assistant', content: "Fresh start. What's on your mind?" }
      
      setMessages([initialMsg])
    } catch (err) {
      console.error('Error clearing messages:', err)
    }
  }

  return {
    messages,
    loading,
    addMessage,
    clearMessages
  }
}
