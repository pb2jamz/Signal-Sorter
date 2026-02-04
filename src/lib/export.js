import { format } from 'date-fns'

// Export items as JSON
export const exportJSON = (data, filename = 'signal-sorter-backup') => {
  const exportData = {
    ...data,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  }
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.json`)
}

// Export items as CSV
export const exportCSV = (items, filename = 'signal-sorter-items') => {
  const headers = ['Name', 'Classification', 'What', 'Why', 'Next Action', 'Status', 'Completed', 'Created At']
  const rows = items.map(item => [
    escapeCsv(item.name),
    item.classification,
    escapeCsv(item.what || ''),
    escapeCsv(item.why || ''),
    escapeCsv(item.next_action || ''),
    item.status || 'inbox',
    item.completed ? 'Yes' : 'No',
    item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm') : ''
  ])

  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  downloadBlob(blob, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`)
}

// Export calendar events as ICS
export const exportICS = (events, filename = 'signal-sorter-calendar') => {
  const icsEvents = events.map(event => {
    const start = formatICSDate(new Date(event.start_time))
    const end = formatICSDate(new Date(event.end_time))
    
    return `BEGIN:VEVENT
UID:${event.id}@signalsorter
DTSTART:${start}
DTEND:${end}
SUMMARY:${escapeICS(event.title)}
DESCRIPTION:${escapeICS(event.description || '')}
END:VEVENT`
  }).join('\n')

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Signal Sorter//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${icsEvents}
END:VCALENDAR`

  const blob = new Blob([ics], { type: 'text/calendar' })
  downloadBlob(blob, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.ics`)
}

// Export weekly summary as PDF-ready HTML
export const exportWeeklySummary = (items, startDate, endDate) => {
  const completed = items.filter(i => i.completed)
  const signals = items.filter(i => i.classification === 'SIGNAL' && !i.completed)
  const necessary = items.filter(i => i.classification === 'NECESSARY' && !i.completed)
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Weekly Summary - Signal Sorter</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #0f172a; }
    h2 { color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .signal { color: #22c55e; }
    .necessary { color: #eab308; }
    .completed { color: #64748b; text-decoration: line-through; }
    ul { list-style: none; padding: 0; }
    li { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .stats { display: flex; gap: 20px; margin: 20px 0; }
    .stat { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>📊 Weekly Summary</h1>
  <p>${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}</p>
  
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${completed.length}</div>
      <div>Completed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${signals.length}</div>
      <div>Active Signals</div>
    </div>
    <div class="stat">
      <div class="stat-value">${Math.round((completed.filter(i => i.classification === 'SIGNAL').length / Math.max(completed.length, 1)) * 100)}%</div>
      <div>Signal Ratio</div>
    </div>
  </div>

  <h2>✅ Completed This Week</h2>
  <ul>
    ${completed.map(i => `<li class="completed">${i.name}</li>`).join('')}
  </ul>

  <h2 class="signal">🟢 Active Signals</h2>
  <ul>
    ${signals.map(i => `<li>${i.name}</li>`).join('')}
  </ul>

  <h2 class="necessary">🟡 Necessary Tasks</h2>
  <ul>
    ${necessary.map(i => `<li>${i.name}</li>`).join('')}
  </ul>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  downloadBlob(blob, `weekly-summary-${format(new Date(), 'yyyy-MM-dd')}.html`)
}

// Helper functions
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const escapeCsv = (str) => {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const escapeICS = (str) => {
  return str.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n')
}

const formatICSDate = (date) => {
  return format(date, "yyyyMMdd'T'HHmmss")
}

// Import from JSON backup
export const importJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        resolve(data)
      } catch (err) {
        reject(new Error('Invalid backup file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
