import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export const useItems = () => {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  // Load items from Supabase
  const loadItems = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
      setError(null)
    } catch (err) {
      console.error('Error loading items:', err)
      setError('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Add new items (batch)
  const addItems = async (newItems) => {
    if (!user || !newItems.length) return

    const itemsToInsert = newItems.map(item => ({
      ...item,
      user_id: user.id,
      status: 'inbox',
      completed: false,
      created_at: new Date().toISOString()
    }))

    // Optimistic update
    const tempItems = itemsToInsert.map((item, i) => ({
      ...item,
      id: `temp-${Date.now()}-${i}`
    }))
    setItems(prev => [...tempItems, ...prev])

    try {
      setSyncing(true)
      const { data, error } = await supabase
        .from('items')
        .insert(itemsToInsert)
        .select()

      if (error) throw error

      // Replace temp items with real ones
      setItems(prev => [
        ...data,
        ...prev.filter(i => !i.id.toString().startsWith('temp-'))
      ])
    } catch (err) {
      console.error('Error adding items:', err)
      // Rollback on error
      setItems(prev => prev.filter(i => !i.id.toString().startsWith('temp-')))
      throw err
    } finally {
      setSyncing(false)
    }
  }

  // Update single item
  const updateItem = async (id, updates) => {
    if (!user) return

    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))

    try {
      setSyncing(true)
      const { error } = await supabase
        .from('items')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    } catch (err) {
      console.error('Error updating item:', err)
      loadItems() // Reload on error
      throw err
    } finally {
      setSyncing(false)
    }
  }

  // Toggle item completion
  const toggleComplete = async (id) => {
    const item = items.find(i => i.id === id)
    if (!item) return

    await updateItem(id, {
      completed: !item.completed,
      completed_at: !item.completed ? new Date().toISOString() : null
    })
  }

  // Delete item
  const deleteItem = async (id) => {
    if (!user) return

    // Optimistic update
    setItems(prev => prev.filter(item => item.id !== id))

    try {
      setSyncing(true)
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    } catch (err) {
      console.error('Error deleting item:', err)
      loadItems() // Reload on error
      throw err
    } finally {
      setSyncing(false)
    }
  }

  // Clear completed items
  const clearCompleted = async () => {
    if (!user) return

    const completedIds = items.filter(i => i.completed).map(i => i.id)
    if (!completedIds.length) return

    // Optimistic update
    setItems(prev => prev.filter(item => !item.completed))

    try {
      setSyncing(true)
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('user_id', user.id)
        .eq('completed', true)

      if (error) throw error
    } catch (err) {
      console.error('Error clearing completed:', err)
      loadItems()
      throw err
    } finally {
      setSyncing(false)
    }
  }

  // Get filtered items
  const signals = items.filter(i => i.classification === 'SIGNAL' && !i.completed)
  const necessary = items.filter(i => i.classification === 'NECESSARY' && !i.completed)
  const noise = items.filter(i => i.classification === 'NOISE' && !i.completed)
  const completed = items.filter(i => i.completed)

  return {
    items,
    signals,
    necessary,
    noise,
    completed,
    loading,
    syncing,
    error,
    addItems,
    updateItem,
    toggleComplete,
    deleteItem,
    clearCompleted,
    reload: loadItems
  }
}
