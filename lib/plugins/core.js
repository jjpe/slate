
import Key from '../utils/key'
import Placeholder from '../components/placeholder'
import React from 'react'
import String from '../utils/string'
import keycode from 'keycode'
import { IS_WINDOWS, IS_MAC } from '../utils/environment'

/**
 * The default plugin.
 *
 * @param {Object} options
 *   @property {Element} placeholder
 *   @property {String} placeholderClassName
 *   @property {Object} placeholderStyle
 * @return {Object}
 */

function Plugin(options = {}) {
  const {
    placeholder,
    placeholderClassName,
    placeholderStyle
  } = options

  /**
   * Define a default block renderer.
   *
   * @type {Component}
   */

  class DEFAULT_BLOCK extends React.Component {

    static propTypes = {
      attributes: React.PropTypes.object.isRequired,
      children: React.PropTypes.any.isRequired,
      node: React.PropTypes.object.isRequired,
      state: React.PropTypes.object.isRequired
    };

    shouldComponentUpdate = (props, state) => {
      return (
        props.node != this.props.node ||
        props.state.selection.hasEdgeIn(props.node)
      )
    }

    render = () => {
      const { attributes, children } = this.props
      return (
        <div {...attributes}>
          {this.renderPlaceholder()}
          {children}
        </div>
      )
    }

    renderPlaceholder = () => {
      if (!placeholder) return null
      const { node, state } = this.props
      return (
        <Placeholder
          className={placeholderClassName}
          node={node}
          parent={state.document}
          state={state}
          style={placeholderStyle}
        >
          {placeholder}
        </Placeholder>
      )
    }
  }

  /**
   * Define a default inline renderer.
   *
   * @type {Component}
   */

  class DEFAULT_INLINE extends React.Component {

    static propTypes = {
      attributes: React.PropTypes.object.isRequired,
      children: React.PropTypes.any.isRequired,
      node: React.PropTypes.object.isRequired,
      state: React.PropTypes.object.isRequired
    };

    shouldComponentUpdate = (props, state) => {
      return (
        props.node != this.props.node ||
        props.state.selection.hasEdgeIn(props.node)
      )
    }

    render = () => {
      const { attributes, children } = this.props
      return <span {...attributes}>{children}</span>
    }

  }

  /**
   * Return the plugin.
   */

  return {

    /**
     * The core `onBeforeInput` handler.
     *
     *
     *
     *
     *
     * Otherwise, we can allow the default, native text insertion, avoiding a
     * re-render for improved performance.
     *
     * @param {Event} e
     * @param {State} state
     * @param {Editor} editor
     * @return {State or Null} newState
     */

    onBeforeInput(e, state, editor) {
      const transform = state.transform().insertText(e.data)
      const synthetic = transform.apply()
      const resolved = editor.resolveState(synthetic)
      let isNative = true

      // If the current selection is expanded, we have to re-render.
      if (state.isExpanded) {
        isNative = false
      }

      // If the current node was empty, we have to re-render so that any empty
      // placeholder logic will be updated.
      if (state.startText.text == '') {
        isNative = false
      }

      // If the next state resolves a new list of decorations for any of its
      // text nodes, we have to re-render.
      else if (!resolved.equals(synthetic)) {
        isNative = false
      }

      // Update the state with the proper `isNative`.
      state = isNative
        ? transform.apply({ isNative })
        : synthetic

      if (!isNative) e.preventDefault()
      return state
    },

    /**
     * The core `onKeyDown` handler.
     *
     * @param {Event} e
     * @param {State} state
     * @param {Editor} editor
     * @return {State or Null} newState
     */

    onKeyDown(e, state, editor) {
      const key = keycode(e.which)
      let transform = state.transform()

      switch (key) {
        case 'enter': {
          const { startBlock } = state
          if (startBlock && !startBlock.isVoid) return transform.splitBlock().apply()

          const { document, startKey } = state
          const text = document.getNextText(startKey)
          if (!text) return

          return transform.collapseToStartOf(text).apply()
        }

        case 'backspace': {
          if (state.isExpanded) return transform.delete().apply()
          const { startOffset, startBlock } = state
          const text = startBlock.text
          let n

          if (Key.isWord(e)) {
            n = String.getWordOffsetBackward(text, startOffset)
          } else if (Key.isLine(e)) {
            n = startOffset
          } else {
            n = String.getCharOffsetBackward(text, startOffset)
          }

          return transform.deleteBackward(n).apply()
        }

        case 'delete': {
          if (state.isExpanded) return transform.delete().apply()
          const { startOffset, startBlock } = state
          const text = startBlock.text
          let n

          if (Key.isWord(e)) {
            n = String.getWordOffsetForward(text, startOffset)
          } else if (Key.isLine(e)) {
            n = text.length - startOffset
          } else {
            n = String.getCharOffsetForward(text, startOffset)
          }

          return transform.deleteForward(n).apply()
        }

        case 'up': {
          if (state.isExpanded) return
          const first = state.blocks.first()
          if (!first || !first.isVoid) return
          e.preventDefault()
          return transform.collapseToEndOfPreviousBlock().apply()
        }

        case 'down': {
          if (state.isExpanded) return
          const first = state.blocks.first()
          if (!first || !first.isVoid) return
          e.preventDefault()
          return transform.collapseToStartOfNextBlock().apply()
        }

        case 'left': {
          if (state.isExpanded) return
          const node = state.blocks.first() || state.inlines.first()
          if (!node || !node.isVoid) return
          e.preventDefault()
          return transform.collapseToEndOfPreviousText().apply()
        }

        case 'right': {
          if (state.isExpanded) return
          const node = state.blocks.first() || state.inlines.first()
          if (!node || !node.isVoid) return
          e.preventDefault()
          return transform.collapseToStartOfNextText().apply()
        }

        case 'y': {
          if (!Key.isWindowsCommand(e)) return
          return transform.redo()
        }

        case 'z': {
          if (!Key.isCommand(e)) return
          return IS_MAC && Key.isShift(e)
            ? transform.redo()
            : transform.undo()
        }
      }
    },

    /**
     * The core `onPaste` handler, which treats everything as plain text.
     *
     * @param {Event} e
     * @param {Object} paste
     * @param {State} state
     * @param {Editor} editor
     * @return {State or Null} newState
     */

    onPaste(e, paste, state, editor) {
      if (paste.type == 'files') return

      let transform = state.transform()

      paste.text
        .split('\n')
        .forEach((line, i) => {
          if (i > 0) transform = transform.splitBlock()
          transform = transform.insertText(line)
        })

      return transform.apply()
    },

    /**
     * The core `node` renderer, which uses plain `<div>` or `<span>` depending on
     * what kind of node it is.
     *
     * @param {Node} node
     * @return {Component} component
     */

    renderNode(node) {
      return node.kind == 'block'
        ? DEFAULT_BLOCK
        : DEFAULT_INLINE
    }
  }
}


/**
 * Export.
 */

export default Plugin
