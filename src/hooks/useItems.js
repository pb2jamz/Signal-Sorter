/**
 * Signal Sorter Items Hook
 * 
 * World-class implementation with:
 * - Optimistic updates with rollback
 * - Real-time sync across devices
 * - Proper error boundaries
 * - Deduplication and cleanup utilities
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Normalize name for comparison
const normalizeName = (name) => {
  return name
    .toLowerCase()
    .replace(/^(signal|necessary|noise)[:\s]*/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const useItems = () => {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  
  // Track pending operations for conflict resolution
  const pendingOps = useRef(new Set())
  const channelRef = useRef(null)

  // Load items from Supabase
  const loadItems = useCallback(async (silent = false) => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }

    if (!silent) {
      console.log('[Items] Loading...')
      setLoading(true)
    }

    try {
      setError(null)
      
      const { data, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      
      console.log('[Items] Loaded', data?.length || 0, 'items')
      setItems(data || [])
      setLastSync(new Date())
    } catch (err) {
      console.error('[Items] Load failed:', err)
      setError(err.message || 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return

    loadItems()

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    console.log('[Items] Setting up real-time sync')
    
    const channel = supabase
      .channel(`items-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Skip if this is from our own pending operation
          if (pendingOps.current.has(payload.new?.id || payload.old?.id)) {
            return
          }

          console.log('[Items] Real-time:', payload.eventType)
          
          if (payload.eventType === 'INSERT') {
            setItems(prev => {
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
          
          setLastSync(new Date())
        }
      )
      .subscribe((status) => {
        console.log('[Items] Subscription:', status)
      })

    channelRef.current = channel

    return () => {
      console.log('[Items] Cleaning up subscription')
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user, loadItems])

  // Add new items (batch)
  const addItems = useCallback(async (newItems) => {
    if (!user) throw new Error('Not authenticated')
    if (!newItems?.length) return []

    console.log('[Items] Adding', newItems.length, 'items')

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

    // Optimistic update
    const tempIds = itemsToInsert.map((_, i) => `temp-${Date.now()}-${i}`)
    const tempItems = itemsToInsert.map((item, i) => ({ ...item, id: tempIds[i] }))
    setItems(prev => [...tempItems, ...prev])

    try {
      setSyncing(true)
      
      const { data, error: insertError } = await supabase
        .from('items')
        .insert(itemsToInsert)
        .select()

      if (insertError) throw insertError

      // Mark as pending to avoid real-time duplicate
      data?.forEach(item => pendingOps.current.add(item.id))
      setTimeout(() => {
        data?.forEach(item => pendingOps.current.delete(item.id))
      }, 2000)

      // Replace temp items with real ones
      setItems(prev => [
        ...(data || []),
        ...prev.filter(i => !String(i.id).startsWith('temp-'))
      ])

      console.log('[Items] Added', data?.length || 0, 'items')
      return data || []
    } catch (err) {
      console.error('[Items] Add failed:', err)
      // Rollback
      setItems(prev => prev.filter(i => !tempIds.includes(i.id)))
      throw err
    } finally {
      setSyncing(false)
    }
  }, [user])

  // Update multiple items (batch)
  const updateItems = useCallback(async (updates) => {
    if (!user || !updates?.length) return

    console.log('[Items] Batch updating', updates.length, 'items')

    // Optimistic update
    const previousItems = [...items]
    setItems(prev => prev.map(item => {
      const update = updates.find(u => u.id === item.id)
      return update ? { ...item, ...update } : item
    }))

    try {
      setSyncing(true)
      
      // Batch update using Promise.all
      const results = await Promise.all(
        updates.map(async ({ id, ...changes }) => {
          pendingOps.current.add(id)
          
          const { error } = await supabase
            .from('items')
            .update({ ...changes, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id)

          setTimeout(() => pendingOps.current.delete(id), 2000)
          
          if (error) {
            console.error('[Items] Update failed for', id, error)
            return { id, error }
          }
          return { id, success: true }
        })
      )

      const failed = results.filter(r => r.error)
      if (failed.length > 0) {
        console.warn('[Items]', failed.length, 'updates failed')
      }
    } catch (err) {
      console.error('[Items] Batch update failed:', err)
      setItems(previousItems)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [user, items])

  // Update single item
  const updateItem = useCallback(async (id, updates) => {
    if (!user) throw new Error('Not authenticated')

    console.log('[Items] Updating', id)

    const previousItems = [...items]
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))

    try {
      setSyncing(true)
      pendingOps.current.add(id)

      const { error: updateError } = await supabase
        .from('items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      setTimeout(() => pendingOps.current.delete(id), 2000)

      if (updateError) throw updateError
    } catch (err) {
      console.error('[Items] Update failed:', err)
      setItems(previousItems)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [user, items])

  // Toggle completion
  const toggleComplete = useCallback(async (id) => {
    const item = items.find(i => i.id === id)
    if (!item) return

    await updateItem(id, {
      completed: !item.completed,
      completed_at: !item.completed ? new Date().toISOString() : null
    })
  }, [items, updateItem])

  // Delete item
  const deleteItem = useCallback(async (id) => {
    if (!user) throw new Error('Not authenticated')

    console.log('[Items] Deleting', id)

    const previousItems = [...items]
    setItems(prev => prev.filter(item => item.id !== id))

    try {
      setSyncing(true)
      pendingOps.current.add(id)

      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      setTimeout(() => pendingOps.current.delete(id), 2000)

      if (deleteError) throw deleteError
    } catch (err) {
      console.error('[Items] Delete failed:', err)
      setItems(previousItems)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [user, items])

  // Clear completed items
  const clearCompleted = useCallback(async () => {
    if (!user) throw new Error('Not authenticated')

    const completedItems = items.filter(i => i.completed)
    if (!completedItems.length) return

    console.log('[Items] Clearing', completedItems.length, 'completed')

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
    } catch (err) {
      console.error('[Items] Clear failed:', err)
      setItems(previousItems)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [user, items])

  // Clean up duplicates
  const cleanupDuplicates = useCallback(async () => {
    if (!user) return { removed: 0, renamed: 0 }

    console.log('[Items] Starting cleanup...')

    try {
      setSyncing(true)

      // Group by normalized name
      const groups = new Map()
      items.forEach(item => {
        const normalized = normalizeName(item.name)
        if (!groups.has(normalized)) {
          groups.set(normalized, [])
        }
        groups.get(normalized).push(item)
      })

      const toDelete = []
      const toUpdate = []

      groups.forEach((group) => {
        if (group.length > 1) {
          // Sort by created_at, keep oldest
          group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          
          const keeper = group[0]
          const duplicates = group.slice(1)

          // Clean keeper's name if needed
          const cleanedName = keeper.name.replace(/^(signal|necessary|noise)[:\s]*/i, '').trim()
          if (cleanedName !== keeper.name) {
            toUpdate.push({ id: keeper.id, name: cleanedName })
          }

          duplicates.forEach(dup => toDelete.push(dup.id))
        } else if (group.length === 1) {
          const item = group[0]
          const cleanedName = item.name.replace(/^(signal|necessary|noise)[:\s]*/i, '').trim()
          if (cleanedName !== item.name) {
            toUpdate.push({ id: item.id, name: cleanedName })
          }
        }
      })

      // Delete duplicates
      if (toDelete.length > 0) {
        console.log('[Items] Deleting', toDelete.length, 'duplicates')
        await supabase
          .from('items')
          .delete()
          .in('id', toDelete)
      }

      // Update names
      for (const { id, name } of toUpdate) {
        await supabase
          .from('items')
          .update({ name, updated_at: new Date().toISOString() })
          .eq('id', id)
      }

      // Reload
      await loadItems()

      console.log('[Items] Cleanup done:', toDelete.length, 'removed,', toUpdate.length, 'renamed')
      return { removed: toDelete.length, renamed: toUpdate.length }
    } catch (err) {
      console.error('[Items] Cleanup failed:', err)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [user, items, loadItems])

  // Computed views
  const signals = items.filter(i => i.classification === 'SIGNAL' && !i.completed)
  const necessary = items.filter(i => i.classification === 'NECESSARY' && !i.completed)
  const noise = items.filter(i => i.classification === 'NOISE' && !i.completed)
  const completed = items.filter(i => i.completed)

  return {
    // Data
    items,
    signals,
    necessary,
    noise,
    completed,
    
    // State
    loading,
    syncing,
    error,
    lastSync,
    
    // Actions
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
