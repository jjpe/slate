
import assert from 'assert'

export default function (state) {
  const { document, selection } = state
  const texts = document.getTexts()
  const first = texts.first()
  const range = selection.merge({
    anchorKey: first.key,
    anchorOffset: 1,
    focusKey: first.key,
    focusOffset: 1
  })

  const next = state
    .transform()
    .moveTo(range)
    .insertText(' a few words ')
    .apply()

  assert.deepEqual(
    next.selection.toJS(),
    range.moveForward(13).toJS()
  )

  return next
}
