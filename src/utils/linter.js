/**
 * Analyzes raw question text and returns block-level diagnostics.
 * Each "block" is a chunk of text separated by one or more blank lines.
 */
export function analyzeText(rawText) {
  if (!rawText.trim()) return []

  const rawBlocks = rawText.split(/\n\n+/)
  let qNum = 0

  return rawBlocks
    .map((raw, i) => {
      const trimmedLines = raw.split('\n').map(l => l.trim()).filter(Boolean)
      if (!trimmedLines.length) return null

      const issues = []

      // Leading whitespace before + or - (common cause of parse failure)
      if (raw.split('\n').some(l => /^\s+[+\-]/.test(l))) {
        issues.push({
          type: 'leading_space',
          msg: 'Answer lines have leading spaces — the parser requires + or - at the very start of the line',
          autofix: 'trim',
        })
      }

      const first = trimmedLines[0]
      const startsWithAnswer = first[0] === '+' || first[0] === '-'
      const answerLines = trimmedLines.filter(l => l[0] === '+' || l[0] === '-')
      const hasCorrect = answerLines.some(l => l[0] === '+')

      if (startsWithAnswer) {
        issues.push({
          type: 'no_question',
          msg: 'Block starts with an answer line — the question text is likely in a separate block above (blank line in the middle of a question)',
        })
      } else if (!answerLines.length) {
        issues.push({
          type: 'no_answers',
          msg: 'No answer lines found — the answers are likely in a separate block below (blank line in the middle of a question)',
        })
      } else if (!hasCorrect) {
        issues.push({
          type: 'no_correct',
          msg: 'No correct answer marked with +',
        })
      }

      const valid = issues.length === 0
      if (valid) qNum++

      return {
        blockIndex: i,
        raw,
        trimmedLines,
        issues,
        valid,
        questionText: !startsWithAnswer ? first : null,
        questionNumber: valid ? qNum : null,
      }
    })
    .filter(Boolean)
}

/**
 * Attempts to auto-fix all detectable issues:
 * 1. Trims leading whitespace from answer lines
 * 2. Merges consecutive "question only" + "answers only" block pairs
 */
export function autoFixText(rawText) {
  // Step 1: trim leading spaces on answer lines
  let fixed = rawText
    .split('\n')
    .map(line => (/^\s+[+\-]/.test(line) ? line.trimStart() : line))
    .join('\n')

  // Step 2: merge "no_answers" block followed by "no_question" block
  const parts = fixed.split(/\n\n+/)
  const result = []
  let i = 0

  while (i < parts.length) {
    const lines = parts[i].split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) { i++; continue }

    const first = lines[0]
    const isPlainQuestion = first[0] !== '+' && first[0] !== '-'
    const hasAnswers = lines.some(l => l[0] === '+' || l[0] === '-')

    if (isPlainQuestion && !hasAnswers && i + 1 < parts.length) {
      const nextLines = parts[i + 1].split('\n').map(l => l.trim()).filter(Boolean)
      const nextStartsWithAnswer =
        nextLines.length > 0 && (nextLines[0][0] === '+' || nextLines[0][0] === '-')

      if (nextStartsWithAnswer) {
        result.push(parts[i].trimEnd() + '\n' + parts[i + 1].trimStart())
        i += 2
        continue
      }
    }

    result.push(parts[i])
    i++
  }

  return result.join('\n\n')
}

/**
 * Replaces a specific block (by blockIndex) in rawText with newBlockText.
 */
export function replaceBlock(rawText, blockIndex, newBlockText) {
  const parts = rawText.split(/\n\n+/)
  parts[blockIndex] = newBlockText
  return parts.join('\n\n')
}

/**
 * Merges two consecutive blocks (by their blockIndex values) into one.
 */
export function mergeBlocksAt(rawText, firstBlockIndex, secondBlockIndex) {
  const parts = rawText.split(/\n\n+/)
  const merged = parts[firstBlockIndex].trimEnd() + '\n' + parts[secondBlockIndex].trimStart()
  // Replace the range [firstBlockIndex .. secondBlockIndex] with the merged block
  parts.splice(firstBlockIndex, secondBlockIndex - firstBlockIndex + 1, merged)
  return parts.join('\n\n')
}
