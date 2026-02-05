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
    if (!user) {
      console.log('[Items] No user, skipping load')
      setLoading(false)
      return
    }

    console.log('[Items] Loading items for user:', user.id)

    try {
      setLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('[Items] Load error:', fetchError)
        setError(fetchError.message)
        throw fetchError
      }
      
      console.log('[Items] Loaded', data?.length || 0, 'items')
      setItems(data || [])
    } catch (err) {
      console.error('[Items] Load failed:', err)
      setError(err.message || 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Add new items (batch)
  const addItems = async (newItems) => {
    if (!user) {
      console.error('[Items] Cannot add - no user')
      throw new Error('No user logged in')
    }
    
    if (!newItems?.length) {
      console.log('[Items] No items to add')
      return
    }

    console.log('[Items] Adding', newItems.length, 'items')

    const itemsToInsert = newItems.map(item => ({
      ...item,
      user_id: user.id,
      status: 'inbox',
      completed: false,
      created_at: new Date().toISOString()
    }))

    // Optimistic update with temp IDs
    const tempItems = itemsToInsert.map((item, i) => ({
      ...item,
      id: `temp-${Date.now()}-${i}`
    }))
    setItems(prev => [...tempItems, ...prev])

    try {
      setSyncing(true)
      setError(null)
      
      const { data, error: insertError } = await supabase
        .from('items')
        .insert(itemsToInsert)
        .select()

      if (insertError) {
        console.error('[Items] Insert error:', insertError)
        throw insertError
      }

      console.log('[Items] Inserted', data?.length || 0, 'items')
      
      // Replace temp items with real ones
      setItems(prev => [
        ...(data || []),
        ...prev.filter(i => !String(i.id).startsWith('temp-'))
      ])
    } catch (err) {
      console.error('[Items] Add failed:', err)
      setError(err.message || 'Failed to add items')
      // Rollback optimistic update
      setItems(prev => prev.filter(i => !String(i.id).startsWith('temp-')))
      throw err
    } finally {
      setSyncing(false)
    }
  }

  // Update single item
  const updateItem = async (id, updates) => {
    if (!user) throw new Error('No user')

    console.log('[Items] Updating item:', id, updates)

    // Optimistic update
    const previousItems = [...items]
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))

    try {
      setSyncing(true)
      const { error: updateError } = await supabase
        .from('items')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('[Items] Update error:', updateError)
        throw updateError
      }
      
      console.log('[Items] Updated successfully')
    } catch (err) {
      console.error('[Items] Update failed:', err)
      setItems(previousItems) // Rollback
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
    if (!user) throw new Error('No user')

    console.log('[Items] Deleting item:', id)

    const previousItems = [...items]
    setItems(prev => prev.filter(item => item.id !== id))

    try {
      setSyncing(true)
      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('[Items] Delete error:', deleteError)
        throw deleteError
      }
      
      console.log('[Items] Deleted successfully')
    } catch (err) {
      console.error('[Items] Delete failed:', err)
      setItems(previousItems)
      throw err
    } finally {
      setSyncing(false)
    }
  }

  // Clear completed items
  const clearCompleted = async () => {
    if (!user) throw new Error('No user')

    const completedCount = items.filter(i => i.completed).length
    if (!completedCount) return

    console.log('[Items] Clearing', completedCount, 'completed items')

    const previousItems = [...items]
    setItems(prev => prev.filter(item => !item.completed))

    try {
      setSyncing(true)
      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .eq('user_id', user.id)
        .eq('completed', true)

      if (deleteError) throw deleteError
      
      console.log('[Items] Cleared completed')
    } catch (err) {
      console.error('[Items] Clear failed:', err)
      setItems(previousItems)
      throw err
    } finally {
      setSyncing(false)
    }
  }

  // Filtered views
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
