import { useState } from 'react'
import { User, Download, Upload, MessageSquare, LogOut, ChevronRight, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useItems } from '../../hooks/useItems'
import { useMessages } from '../../hooks/useMessages'
import { useFeedback } from '../../hooks/useFeedback'
import { exportJSON, exportCSV, importJSON } from '../../lib/export'

const SettingsView = () => {
  const { user, profile, signOut, updateProfile } = useAuth()
  const { items } = useItems()
  const { messages } = useMessages()
  const { submitFeedback } = useFeedback()
  
  const [activeSection, setActiveSection] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: profile?.name || '',
    role: profile?.role || '',
    workday_start: profile?.workday_start || '08:00'
  })
  
  // Feedback state
  const [feedbackType, setFeedbackType] = useState('bug')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const handleExportJSON = () => {
    exportJSON({ items, messages, profile })
    setMessage({ type: 'success', text: 'Backup exported!' })
  }

  const handleExportCSV = () => {
    exportCSV(items)
    setMessage({ type: 'success', text: 'Items exported to CSV!' })
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setLoading(true)
      const data = await importJSON(file)
      setMessage({ type: 'success', text: `Imported ${data.items?.length || 0} items. Refresh to see changes.` })
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to import file' })
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleUpdateProfile = async () => {
    setMessage({ type: '', text: '' })
    try {
      setLoading(true)
      console.log('Saving profile:', profileForm)
      await updateProfile(profileForm)
      console.log('Profile saved successfully')
      setEditingProfile(false)
      setActiveSection(null)
      setMessage({ type: 'success', text: 'Profile updated!' })
    } catch (err) {
      console.error('Profile update error:', err)
      setMessage({ type: 'error', text: `Error: ${err.message || JSON.stringify(err)}` })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) return

    try {
      setLoading(true)
      await submitFeedback(feedbackType, feedbackMessage)
      setFeedbackMessage('')
      setActiveSection(null)
      setMessage({ type: 'success', text: 'Feedback submitted. Thank you!' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to submit feedback' })
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    if (window.confirm('Sign out?')) {
      try {
        console.log('[Settings] Signing out...')
        await signOut()
        console.log('[Settings] Signed out, reloading...')
        // Force reload to clear all state
        window.location.reload()
      } catch (err) {
        console.error('[Settings] Sign out error:', err)
        setMessage({ type: 'error', text: 'Failed to sign out' })
      }
    }
  }

  const MenuItem = ({ icon: Icon, label, onClick, danger = false }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 hover:bg-slate-800 rounded-xl ${danger ? 'text-red-400' : ''}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} />
        <span>{label}</span>
      </div>
      <ChevronRight size={18} className="text-slate-500" />
    </button>
  )

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Status message */}
      {message.text && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success' 
            ? 'bg-green-900/50 border border-green-700 text-green-300' 
            : 'bg-red-900/50 border border-red-700 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
          <button 
            onClick={() => setMessage({ type: '', text: '' })}
            className="ml-auto"
          >
            ×
          </button>
        </div>
      )}

      {/* User info */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-xl font-bold">
              {profile?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <p className="font-medium">{profile?.name || 'User'}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Menu sections */}
      {!activeSection && (
        <div className="space-y-2">
          <MenuItem 
            icon={User} 
            label="Edit Profile" 
            onClick={() => {
              setProfileForm({
                name: profile?.name || '',
                role: profile?.role || '',
                workday_start: profile?.workday_start || '08:00'
              })
              setEditingProfile(true)
              setActiveSection('profile')
            }} 
          />
          <MenuItem 
            icon={Download} 
            label="Export Data" 
            onClick={() => setActiveSection('export')} 
          />
          <MenuItem 
            icon={Upload} 
            label="Import Backup" 
            onClick={() => document.getElementById('import-file').click()} 
          />
          <input
            id="import-file"
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <MenuItem 
            icon={MessageSquare} 
            label="Report a Problem" 
            onClick={() => setActiveSection('feedback')} 
          />
          <div className="pt-4 border-t border-slate-700 mt-4">
            <MenuItem 
              icon={LogOut} 
              label="Sign Out" 
              onClick={handleSignOut}
              danger 
            />
          </div>
        </div>
      )}

      {/* Profile editing */}
      {activeSection === 'profile' && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Edit Profile</h3>
            <button 
              onClick={() => setActiveSection(null)}
              className="text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Name</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Role</label>
              <input
                type="text"
                value={profileForm.role}
                onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                className="w-full p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Workday Start</label>
              <input
                type="time"
                value={profileForm.workday_start}
                onChange={(e) => setProfileForm({ ...profileForm, workday_start: e.target.value })}
                className="w-full p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleUpdateProfile}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="animate-spin" size={18} /> : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Export options */}
      {activeSection === 'export' && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Export Data</h3>
            <button 
              onClick={() => setActiveSection(null)}
              className="text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleExportJSON}
              className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-left"
            >
              <p className="font-medium">Full Backup (JSON)</p>
              <p className="text-sm text-slate-400">All items, messages, and settings</p>
            </button>
            <button
              onClick={handleExportCSV}
              className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-left"
            >
              <p className="font-medium">Items Only (CSV)</p>
              <p className="text-sm text-slate-400">Open in Excel or Google Sheets</p>
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-4 text-center">
            {items.length} items • {messages.length} messages
          </p>
        </div>
      )}

      {/* Feedback form */}
      {activeSection === 'feedback' && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Report a Problem</h3>
            <button 
              onClick={() => setActiveSection(null)}
              className="text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Type</label>
              <div className="flex gap-2">
                {['bug', 'feature', 'general'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFeedbackType(type)}
                    className={`flex-1 py-2 rounded-lg text-sm capitalize ${
                      feedbackType === type ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Description</label>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Describe the issue or suggestion..."
                rows={4}
                className="w-full p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              onClick={handleSubmitFeedback}
              disabled={loading || !feedbackMessage.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="animate-spin" size={18} /> : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}

      {/* App info */}
      <div className="mt-8 text-center text-slate-500 text-xs">
        <p>Signal Sorter v1.0</p>
        <p className="mt-1">Based on the Steve Jobs Method</p>
      </div>
    </div>
  )
}

export default SettingsView
