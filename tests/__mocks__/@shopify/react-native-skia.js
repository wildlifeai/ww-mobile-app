/**
 * Jest mock for @shopify/react-native-skia
 *
 * Provides stub implementations of Canvas, Rect, and Group
 * components so tests can import SkiaGrid without native bindings.
 */
const React = require('react')

const Canvas = ({ children, ...props }) =>
    React.createElement('Canvas', props, children)

const Rect = (props) =>
    React.createElement('Rect', props)

const Group = ({ children, ...props }) =>
    React.createElement('Group', props, children)

module.exports = {
    Canvas,
    Rect,
    Group,
}
