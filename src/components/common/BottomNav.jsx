import { MessageCircle, List, Calendar, Settings } from 'lucide-react'

const BottomNav = ({ activeView, onViewChange, signalCount = 0 }) => {
  const tabs = [
    { id: 'chat', icon: MessageCircle, label: 'Chat' },
    { id: 'list', icon: List, label: 'List', badge: signalCount },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex safe-area-bottom">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeView === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 relative ${
              isActive ? 'text-blue-400' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Icon size={22} />
              {tab.badge > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 bg-green-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </div>
            <span className="text-xs">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default BottomNav
