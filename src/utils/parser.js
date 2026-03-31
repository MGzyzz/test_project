export function parseQuestions(raw) {
  return raw.trim().split(/\n\s*\n/).reduce((acc, block) => {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return acc
    const question = lines[0]
    const answers = lines.slice(1)
      .filter(l => l[0] === '+' || l[0] === '-')
      .map(l => {
        let text = l.slice(1).trim()
        text = text.replace(/[.;]+$/, '')
        text = text.charAt(0).toUpperCase() + text.slice(1)
        return { text, correct: l[0] === '+' }
      })
    if (answers.length && answers.some(a => a.correct)) {
      acc.push({ question, answers })
    }
    return acc
  }, [])
}
