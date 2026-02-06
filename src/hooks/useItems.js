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

  // Load items and set up real-time subscription
  useEffect(() => {
    loadItems()

    // Set up real-time subscription for cross-device sync
    if (!user) return

    console.log('[Items] Setting up real-time subscription')
    
    const channel = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[Items] Real-time update:', payload.eventType)
          
          if (payload.eventType === 'INSERT') {
            setItems(prev => {
              // Avoid duplicates
              if (prev.some(i => i.id === payload.new.id)) return prev
              return [payload.new, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(item => 
              item.id === payload.new.id ? payload.new : item
            ))
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(item => item.id !== payload.old.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('[Items] Subscription status:', status)
      })

    return () => {
      console.log('[Items] Cleaning up subscription')
      supabase.removeChannel(channel)
    }
  }, [user, loadItems])

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

    console.log('[Items] Adding', newItems.length, 'items:')
    newItems.forEach(item => {
      console.log(`  - ${item.name} | classification: ${item.classification}`)
    })

    const itemsToInsert = newItems.map(item => ({
      name: item.name,
      classification: item.classification,
      what: item.what || null,
      why: item.why || null,
      next_action: item.next_action || null,
      user_id: user.id,
      status: 'inbox',
      completed: false,
      created_at: new Date().toISOString()
    }))
    
    console.log('[Items] Prepared for insert:', JSON.stringify(itemsToInsert, null, 2))

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

  // Update multiple items at once (for reclassification)
  const updateItems = async (updates) => {
    if (!user || !updates?.length) return

    console.log('[Items] Updating', updates.length, 'items')

    // Optimistic update
    const previousItems = [...items]
    setItems(prev => prev.map(item => {
      const update = updates.find(u => u.id === item.id)
      return update ? { ...item, ...update } : item
    }))

    try {
      setSyncing(true)
      
      // Update each item
      for (const update of updates) {
        const { id, ...changes } = update
        const { error } = await supabase
          .from('items')
          .update({
            ...changes,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id)

        if (error) {
          console.error('[Items] Update error for', id, error)
        } else {
          console.log('[Items] Updated', id)
        }
      }
    } catch (err) {
      console.error('[Items] Batch update failed:', err)
      setItems(previousItems)
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

  // Clean up duplicate items
  const cleanupDuplicates = async () => {
    if (!user) return { removed: 0 }

    console.log('[Items] Starting duplicate cleanup...')
    
    try {
      setSyncing(true)
      
      // Group items by normalized name
      const groups = new Map()
      items.forEach(item => {
        const normalized = item.name
          .toLowerCase()
          .replace(/^(signal|necessary|noise)[:\s]*/i, '')
          .replace(/[^\w\s]/g, '')
          .trim()
        
        if (!groups.has(normalized)) {
          groups.set(normalized, [])
        }
        groups.get(normalized).push(item)
      })

      // Find duplicates to delete
      const toDelete = []
      const toUpdate = []
      
      groups.forEach((group, normalizedName) => {
        if (group.length > 1) {
          // Sort by created_at, keep the oldest one
          group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          
          const keeper = group[0]
          const duplicates = group.slice(1)
          
          console.log(`[Items] "${normalizedName}": keeping 1, removing ${duplicates.length}`)
          
          // Check if keeper name needs cleaning
          const cleanName = keeper.name.replace(/^(signal|necessary|noise)[:\s]*/i, '').trim()
          if (cleanName !== keeper.name) {
            toUpdate.push({ id: keeper.id, name: cleanName })
          }
          
          duplicates.forEach(dup => toDelete.push(dup.id))
        } else if (group.length === 1) {
          // Check if single item name needs cleaning
          const item = group[0]
          const cleanName = item.name.replace(/^(signal|necessary|noise)[:\s]*/i, '').trim()
          if (cleanName !== item.name) {
            toUpdate.push({ id: item.id, name: cleanName })
          }
        }
      })

      // Delete duplicates
      if (toDelete.length > 0) {
        console.log('[Items] Deleting', toDelete.length, 'duplicates')
        const { error: deleteError } = await supabase
          .from('items')
          .delete()
          .in('id', toDelete)
        
        if (deleteError) {
          console.error('[Items] Delete error:', deleteError)
        }
      }

      // Update names that need cleaning
      for (const update of toUpdate) {
        console.log('[Items] Cleaning name:', update.id)
        await supabase
          .from('items')
          .update({ name: update.name })
          .eq('id', update.id)
      }

      // Reload items
      await loadItems()
      
      console.log('[Items] Cleanup complete. Removed:', toDelete.length, 'Renamed:', toUpdate.length)
      return { removed: toDelete.length, renamed: toUpdate.length }
      
    } catch (err) {
      console.error('[Items] Cleanup failed:', err)
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
    updateItems,
    updateItem,
    toggleComplete,
    deleteItem,
    clearCompleted,
    cleanupDuplicates,
    reload: loadItems
  }
}
