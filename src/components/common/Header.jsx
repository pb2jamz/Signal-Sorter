import { Zap, Wifi, WifiOff, Loader } from 'lucide-react'

const Header = ({ syncing = false, offline = false }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
          <Zap className="text-slate-900" size={20} />
        </div>
        <span className="font-bold text-lg">Signal Sorter</span>
      </div>

      <div className="flex items-center gap-2">
        {syncing && (
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <Loader className="animate-spin" size={14} />
            <span>Saving...</span>
          </div>
        )}
        {offline && (
          <div className="flex items-center gap-1 text-yellow-400 text-xs">
            <WifiOff size={14} />
            <span>Offline</span>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
