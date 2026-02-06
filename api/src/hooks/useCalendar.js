import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths } from 'date-fns'

export const useCalendar = () => {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Load events for visible range
  const loadEvents = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Get range: current month plus buffer
      const start = startOfWeek(startOfMonth(addMonths(currentMonth, -1)))
      const end = endOfWeek(endOfMonth(addMonths(currentMonth, 1)))

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (err) {
      console.error('Error loading events:', err)
    } finally {
      setLoading(false)
    }
  }, [user, currentMonth])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // Add event
  const addEvent = async (eventData) => {
    if (!user) return

    const newEvent = {
      ...eventData,
      user_id: user.id,
      created_at: new Date().toISOString()
    }

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert(newEvent)
        .select()
        .single()

      if (error) throw error
      setEvents(prev => [...prev, data].sort((a, b) => 
        new Date(a.start_time) - new Date(b.start_time)
      ))
      return data
    } catch (err) {
      console.error('Error adding event:', err)
      throw err
    }
  }

  // Create event from item (signal → time block)
  const createEventFromItem = async (item, startTime, endTime) => {
    return addEvent({
      item_id: item.id,
      title: item.name,
      description: item.what || item.next_action || '',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      all_day: false
    })
  }

  // Update event
  const updateEvent = async (id, updates) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setEvents(prev => prev.map(e => e.id === id ? data : e))
      return data
    } catch (err) {
      console.error('Error updating event:', err)
      throw err
    }
  }

  // Delete event
  const deleteEvent = async (id) => {
    if (!user) return

    setEvents(prev => prev.filter(e => e.id !== id))

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    } catch (err) {
      console.error('Error deleting event:', err)
      loadEvents()
      throw err
    }
  }

  // Get events for a specific date
  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return events.filter(e => e.start_time.startsWith(dateStr))
  }

  return {
    events,
    loading,
    currentMonth,
    setCurrentMonth,
    addEvent,
    createEventFromItem,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    reload: loadEvents
  }
}
