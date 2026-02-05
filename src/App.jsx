import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './components/Auth/Login'
import OnboardingFlow from './components/Onboarding/OnboardingFlow'
import ChatView from './components/Chat/ChatView'
import ListView from './components/List/ListView'
import CalendarView from './components/Calendar/CalendarView'
import SettingsView from './components/Settings/SettingsView'
import Header from './components/common/Header'
import BottomNav from './components/common/BottomNav'
import { useItems } from './hooks/useItems'

const MainApp = () => {
  const { user, loading, needsOnboarding, error } = useAuth()
  const { signals, syncing } = useItems()
  const [activeView, setActiveView] = useState('chat')
  const [itemToSchedule, setItemToSchedule] = useState(null)
  const [loadingTimeout, setLoadingTimeout] = useState(false)

  // Force timeout after 5 seconds
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.log('[App] Loading timeout reached')
        setLoadingTimeout(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [loading])

  // Show loading state (with timeout fallback)
  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl">⚡</span>
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  // If loading timed out or there's an error, show login
  if (loadingTimeout && !user) {
    console.log('[App] Loading timed out, showing login')
    return <Login />
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />
  }

  // Show onboarding if needed
  if (needsOnboarding) {
    return <OnboardingFlow />
  }

  // Handle scheduling an item from list view
  const handleScheduleItem = (item) => {
    setItemToSchedule(item)
    setActiveView('calendar')
  }

  // Main app layout
  return (
    <div className="min-h-screen bg-slate-900 text-white flex justify-center">
      <div className="w-full max-w-lg flex flex-col min-h-screen">
        <Header syncing={syncing} />
        
        <main className="flex-1 overflow-hidden pb-16">
          {activeView === 'chat' && <ChatView />}
          {activeView === 'list' && <ListView onScheduleItem={handleScheduleItem} />}
          {activeView === 'calendar' && (
            <CalendarView 
              itemToSchedule={itemToSchedule} 
              onClearScheduleItem={() => setItemToSchedule(null)} 
            />
          )}
          {activeView === 'settings' && <SettingsView />}
        </main>

        <BottomNav 
          activeView={activeView} 
          onViewChange={setActiveView}
          signalCount={signals.length}
        />
      </div>
    </div>
  )
}

const App = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}

export default App
