import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Zap, ArrowRight, ArrowLeft, Loader, User, Briefcase, Target, Clock, Brain, CheckCircle } from 'lucide-react'

const STEPS = [
  {
    id: 'name',
    title: "Let's get started",
    subtitle: "What should I call you?",
    icon: User,
    field: 'name',
    type: 'text',
    placeholder: 'Your name'
  },
  {
    id: 'role',
    title: "What do you do?",
    subtitle: "Your role or job title",
    icon: Briefcase,
    field: 'role',
    type: 'text',
    placeholder: 'e.g., Project Manager, Engineer, Business Owner'
  },
  {
    id: 'work_priorities',
    title: "Top 3 work priorities",
    subtitle: "What matters most at work right now?",
    icon: Target,
    field: 'work_priorities',
    type: 'list',
    placeholder: 'Add a priority...',
    maxItems: 3
  },
  {
    id: 'personal_priorities',
    title: "Top 3 personal priorities",
    subtitle: "Outside of work, what's important?",
    icon: Target,
    field: 'personal_priorities',
    type: 'list',
    placeholder: 'Add a priority...',
    maxItems: 3
  },
  {
    id: 'goals',
    title: "What are your goals?",
    subtitle: "What are you working toward this year?",
    icon: Target,
    field: 'goals',
    type: 'list',
    placeholder: 'Add a goal...',
    maxItems: 5
  },
  {
    id: 'workday_start',
    title: "When does your day start?",
    subtitle: "This helps me understand your signal window",
    icon: Clock,
    field: 'workday_start',
    type: 'time',
    placeholder: '08:00'
  },
  {
    id: 'focus_challenge',
    title: "Biggest focus challenge?",
    subtitle: "What gets in the way of getting things done?",
    icon: Brain,
    field: 'focus_challenge',
    type: 'textarea',
    placeholder: 'e.g., Too many meetings, constant interruptions, hard to prioritize...'
  }
]

const OnboardingFlow = () => {
  const { completeOnboarding } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    work_priorities: [],
    personal_priorities: [],
    goals: [],
    workday_start: '08:00',
    focus_challenge: ''
  })
  const [listInput, setListInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const step = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1
  const progress = ((currentStep + 1) / STEPS.length) * 100

  const handleNext = async () => {
    // Validate current step
    const value = formData[step.field]
    if (step.type === 'list') {
      if (!value || value.length === 0) {
        setError('Please add at least one item')
        return
      }
    } else if (!value || (typeof value === 'string' && !value.trim())) {
      setError('Please fill in this field')
      return
    }

    setError('')

    if (isLastStep) {
      try {
        setLoading(true)
        await completeOnboarding(formData)
      } catch (err) {
        setError(err.message || 'Failed to save profile')
        setLoading(false)
      }
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      setError('')
    }
  }

  const handleInputChange = (value) => {
    setFormData(prev => ({
      ...prev,
      [step.field]: value
    }))
    setError('')
  }

  const handleAddListItem = () => {
    if (!listInput.trim()) return
    if (formData[step.field].length >= step.maxItems) return

    setFormData(prev => ({
      ...prev,
      [step.field]: [...prev[step.field], listInput.trim()]
    }))
    setListInput('')
  }

  const handleRemoveListItem = (index) => {
    setFormData(prev => ({
      ...prev,
      [step.field]: prev[step.field].filter((_, i) => i !== index)
    }))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (step.type === 'list') {
        handleAddListItem()
      } else {
        handleNext()
      }
    }
  }

  const Icon = step.icon

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-slate-800">
        <div 
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
              <Zap className="text-slate-900" size={24} />
            </div>
            <span className="text-xl font-bold text-white">Signal Sorter</span>
          </div>

          {/* Step content */}
          <div className="bg-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                <Icon className="text-blue-400" size={20} />
              </div>
              <div className="text-sm text-slate-400">
                Step {currentStep + 1} of {STEPS.length}
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-1">{step.title}</h2>
            <p className="text-slate-400 text-sm mb-6">{step.subtitle}</p>

            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Input based on type */}
            {step.type === 'text' && (
              <input
                type="text"
                value={formData[step.field]}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={step.placeholder}
                className="w-full p-4 bg-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            )}

            {step.type === 'time' && (
              <input
                type="time"
                value={formData[step.field]}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full p-4 bg-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {step.type === 'textarea' && (
              <textarea
                value={formData[step.field]}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={step.placeholder}
                rows={4}
                className="w-full p-4 bg-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                autoFocus
              />
            )}

            {step.type === 'list' && (
              <div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={listInput}
                    onChange={(e) => setListInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={step.placeholder}
                    disabled={formData[step.field].length >= step.maxItems}
                    className="flex-1 p-3 bg-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    autoFocus
                  />
                  <button
                    onClick={handleAddListItem}
                    disabled={!listInput.trim() || formData[step.field].length >= step.maxItems}
                    className="px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2">
                  {formData[step.field].map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-700 rounded-lg">
                      <CheckCircle size={18} className="text-green-400" />
                      <span className="flex-1 text-white">{item}</span>
                      <button
                        onClick={() => handleRemoveListItem(index)}
                        className="text-slate-400 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-slate-500 mt-2">
                  {formData[step.field].length} / {step.maxItems} items
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader className="animate-spin" size={20} />
                ) : isLastStep ? (
                  'Get Started'
                ) : (
                  <>
                    Next
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Skip for now (optional fields) */}
          {!['name'].includes(step.id) && !isLastStep && (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="w-full mt-4 text-slate-500 hover:text-slate-300 text-sm"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingFlow
