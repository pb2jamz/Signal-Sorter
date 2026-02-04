import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, Download } from 'lucide-react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  setHours,
  setMinutes
} from 'date-fns'
import { useCalendar } from '../../hooks/useCalendar'
import { exportICS } from '../../lib/export'

const CalendarView = ({ itemToSchedule, onClearScheduleItem }) => {
  const { 
    events, 
    currentMonth, 
    setCurrentMonth, 
    addEvent, 
    createEventFromItem,
    deleteEvent,
    getEventsForDate 
  } = useCalendar()
  
  const [selectedDate, setSelectedDate] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
    allDay: false
  })

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const handleDateClick = (date) => {
    setSelectedDate(date)
    
    if (itemToSchedule) {
      setNewEvent({
        title: itemToSchedule.name,
        description: itemToSchedule.what || itemToSchedule.next_action || '',
        startTime: '09:00',
        endTime: '10:00',
        allDay: false
      })
      setShowEventModal(true)
    }
  }

  const handleOpenNewEvent = () => {
    if (!selectedDate) return
    setNewEvent({ title: '', description: '', startTime: '09:00', endTime: '10:00', allDay: false })
    setShowEventModal(true)
  }

  const handleAddEvent = async () => {
    if (!selectedDate || !newEvent.title.trim()) return

    const startDateTime = setMinutes(
      setHours(selectedDate, parseInt(newEvent.startTime.split(':')[0])),
      parseInt(newEvent.startTime.split(':')[1])
    )
    const endDateTime = setMinutes(
      setHours(selectedDate, parseInt(newEvent.endTime.split(':')[0])),
      parseInt(newEvent.endTime.split(':')[1])
    )

    try {
      if (itemToSchedule) {
        await createEventFromItem(itemToSchedule, startDateTime, endDateTime)
        onClearScheduleItem?.()
      } else {
        await addEvent({
          title: newEvent.title,
          description: newEvent.description,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          all_day: newEvent.allDay
        })
      }

      setShowEventModal(false)
      setNewEvent({ title: '', description: '', startTime: '09:00', endTime: '10:00', allDay: false })
    } catch (err) {
      console.error('Error adding event:', err)
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Delete this event?')) {
      await deleteEvent(eventId)
    }
  }

  const handleExportCalendar = () => {
    if (events.length === 0) {
      alert('No events to export')
      return
    }
    exportICS(events, 'signal-sorter-calendar')
  }

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : []

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-800 rounded-lg">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCalendar}
            className="p-2 hover:bg-slate-800 rounded-lg"
            title="Export to .ics"
          >
            <Download size={18} />
          </button>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-800 rounded-lg">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Scheduling item indicator */}
      {itemToSchedule && (
        <div className="mb-4 p-3 bg-blue-900/50 border border-blue-700 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-300">Scheduling:</p>
            <p className="text-white font-medium">{itemToSchedule.name}</p>
          </div>
          <button onClick={onClearScheduleItem} className="p-1 hover:bg-blue-800 rounded">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs text-slate-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayEvents = getEventsForDate(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const dayIsToday = isToday(day)

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={`
                min-h-[50px] p-1 rounded-lg text-sm flex flex-col items-center
                ${isCurrentMonth ? 'text-white' : 'text-slate-600'}
                ${isSelected ? 'bg-blue-600' : 'hover:bg-slate-800'}
                ${dayIsToday && !isSelected ? 'ring-2 ring-yellow-400' : ''}
              `}
            >
              <span className={`
                w-6 h-6 flex items-center justify-center rounded-full text-xs
                ${dayIsToday ? 'bg-yellow-400 text-slate-900 font-bold' : ''}
              `}>
                {format(day, 'd')}
              </span>
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dayEvents.slice(0, 3).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected date events */}
      {selectedDate && (
        <div className="mt-4 border-t border-slate-700 pt-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{format(selectedDate, 'EEEE, MMM d')}</h3>
            <button
              onClick={handleOpenNewEvent}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <Plus size={18} />
            </button>
          </div>

          {selectedDateEvents.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              No events scheduled
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDateEvents.map(event => (
                <div
                  key={event.id}
                  className="bg-slate-800 rounded-lg p-3 flex items-start justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                      <Clock size={12} />
                      {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                    </div>
                    {event.description && (
                      <p className="text-xs text-slate-500 mt-1">{event.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {itemToSchedule ? 'Schedule Signal' : 'New Event'}
              </h3>
              <button onClick={() => setShowEventModal(false)} className="p-1 hover:bg-slate-700 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Event title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Start</label>
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    className="w-full p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">End</label>
                  <input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="w-full p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Description (optional)</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Add details..."
                />
              </div>

              <button
                onClick={handleAddEvent}
                disabled={!newEvent.title.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-medium"
              >
                {itemToSchedule ? 'Schedule It' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarView
