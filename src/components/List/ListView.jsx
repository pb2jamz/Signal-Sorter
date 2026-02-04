import { useState } from 'react'
import { Circle, CheckCircle, Trash2, RefreshCw, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { useItems } from '../../hooks/useItems'
import { useAuth } from '../../hooks/useAuth'
import { useMessages } from '../../hooks/useMessages'
import { analyzeWithAI } from '../../lib/ai'

const ListView = ({ onScheduleItem }) => {
  const { profile } = useAuth()
  const { items, signals, necessary, noise, completed, toggleComplete, deleteItem, clearCompleted, addItems } = useItems()
  const { addMessage } = useMessages()
  const [expandedId, setExpandedId] = useState(null)
  const [isReprioritizing, setIsReprioritizing] = useState(false)

  const handleReprioritize = async () => {
    if (isReprioritizing) return

    try {
      setIsReprioritizing(true)
      const userMessage = "What should be my top priority now?"
      await addMessage('user', userMessage)

      const result = await analyzeWithAI(userMessage, profile, items, true)
      await addMessage('assistant', result.response)

      if (result.items?.length > 0) {
        await addItems(result.items)
      }
    } catch (err) {
      console.error('Reprioritize error:', err)
    } finally {
      setIsReprioritizing(false)
    }
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this item?')) {
      deleteItem(id)
    }
  }

  const handleClearCompleted = () => {
    if (window.confirm('Clear all completed items?')) {
      clearCompleted()
    }
  }

  const ItemCard = ({ item, color }) => {
    const isExpanded = expandedId === item.id
    const colorClasses = {
      green: {
        bg: 'bg-green-900/30',
        border: 'border-green-800',
        text: 'text-green-400',
        expandBg: 'bg-green-950/50',
        expandBorder: 'border-green-800'
      },
      yellow: {
        bg: 'bg-yellow-900/30',
        border: 'border-yellow-800',
        text: 'text-yellow-400',
        expandBg: 'bg-yellow-950/50',
        expandBorder: 'border-yellow-800'
      },
      red: {
        bg: 'bg-red-900/30',
        border: 'border-red-800',
        text: 'text-red-400',
        expandBg: 'bg-red-950/50',
        expandBorder: 'border-red-800'
      }
    }
    const c = colorClasses[color]

    return (
      <div className={`${c.bg} border ${c.border} rounded-lg overflow-hidden`}>
        <div className="p-3 flex items-center gap-3">
          <button onClick={() => toggleComplete(item.id)}>
            {item.completed ? (
              <CheckCircle size={20} className="text-green-400" />
            ) : (
              <Circle size={20} className={c.text} />
            )}
          </button>
          
          <button
            onClick={() => setExpandedId(isExpanded ? null : item.id)}
            className={`flex-1 text-left text-sm ${color === 'red' ? 'opacity-60' : ''}`}
          >
            {item.name}
          </button>

          <div className="flex items-center gap-1">
            {color === 'green' && onScheduleItem && (
              <button
                onClick={() => onScheduleItem(item)}
                className="p-1 text-slate-500 hover:text-blue-400"
                title="Add to calendar"
              >
                <Calendar size={16} />
              </button>
            )}
            <button
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className="p-1 text-slate-500"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              className="p-1 text-slate-500 hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className={`px-4 pb-4 pt-1 border-t ${c.expandBorder} ${c.expandBg}`}>
            <div className="space-y-2 text-sm">
              <div>
                <span className={`${c.text} font-medium`}>WHAT:</span>
                <span className="text-slate-300 ml-2">{item.what || 'No details captured'}</span>
              </div>
              <div>
                <span className={`${c.text} font-medium`}>
                  {color === 'red' ? 'WHY NOISE:' : 'WHY:'}
                </span>
                <span className="text-slate-300 ml-2">
                  {item.why || (color === 'red' ? "Doesn't advance priorities" : 'Advances key priority')}
                </span>
              </div>
              <div>
                <span className={`${c.text} font-medium`}>
                  {color === 'red' ? 'ACTION:' : 'NEXT:'}
                </span>
                <span className="text-slate-300 ml-2">
                  {item.next_action || (color === 'red' ? 'Ignore or decline' : 'Define next action')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Reprioritize Button */}
      {items.filter(i => !i.completed).length > 0 && (
        <button
          onClick={handleReprioritize}
          disabled={isReprioritizing}
          className="w-full mb-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl flex items-center justify-center gap-2 font-medium"
        >
          <RefreshCw size={18} className={isReprioritizing ? 'animate-spin' : ''} />
          What's my top signal now?
        </button>
      )}

      {/* Signals */}
      {signals.length > 0 && (
        <div className="mb-6">
          <h3 className="text-green-400 font-bold mb-3">🟢 SIGNALS — Do These</h3>
          <div className="space-y-2">
            {signals.map(item => (
              <ItemCard key={item.id} item={item} color="green" />
            ))}
          </div>
        </div>
      )}

      {/* Necessary */}
      {necessary.length > 0 && (
        <div className="mb-6">
          <h3 className="text-yellow-400 font-bold mb-3">🟡 NECESSARY — Batch These</h3>
          <div className="space-y-2">
            {necessary.map(item => (
              <ItemCard key={item.id} item={item} color="yellow" />
            ))}
          </div>
        </div>
      )}

      {/* Noise */}
      {noise.length > 0 && (
        <div className="mb-6">
          <h3 className="text-red-400 font-bold mb-3">🔴 NOISE — Ignore These</h3>
          <div className="space-y-2">
            {noise.map(item => (
              <ItemCard key={item.id} item={item} color="red" />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-slate-400 font-bold">✓ Completed</h3>
            <button
              onClick={handleClearCompleted}
              className="text-xs text-slate-500 hover:text-white"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-2">
            {completed.map(item => (
              <div
                key={item.id}
                className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3 opacity-50"
              >
                <button onClick={() => toggleComplete(item.id)}>
                  <CheckCircle size={20} className="text-green-400" />
                </button>
                <span className="flex-1 text-sm line-through">{item.name}</span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No items yet</p>
          <p className="text-sm mt-2">Go to Chat and dump what's on your mind</p>
        </div>
      )}
    </div>
  )
}

export default ListView
