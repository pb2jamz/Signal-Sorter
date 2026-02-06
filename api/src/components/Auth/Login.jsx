import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Zap, Mail, Lock, Loader, AlertCircle } from 'lucide-react'

const Login = () => {
  const { signIn, signUp } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    try {
      setLoading(true)
      if (isSignUp) {
        await signUp(email, password)
        setMessage('Check your email to confirm your account!')
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center">
          <Zap className="text-slate-900" size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Signal Sorter</h1>
          <p className="text-slate-400 text-sm">Separate signal from noise</p>
        </div>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm">
        <div className="bg-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2 text-sm text-red-300">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-sm text-green-300">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm text-slate-400 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-medium text-white flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader className="animate-spin" size={20} />
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
                setMessage('')
              }}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Features preview */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p className="mb-4">AI-powered productivity based on the Steve Jobs method</p>
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-green-400">🟢</span> Signal
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">🟡</span> Necessary
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400">🔴</span> Noise
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
