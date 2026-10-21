import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useParams } from 'react-router'
import { ease } from '@/ui/motion'
import { ChatView } from './ChatView'

/**
 * Plan §6 #9, the "expediente" transition: the outgoing file slides out to the left and tilts a degree,
 * the next one comes in from the right. `ChatView` takes `id` as a prop (not `useParams`) so the exiting
 * copy keeps showing ITS chat while the router already points at the next one.
 * Reduced motion: 120 ms crossfade, no x/rotate at all (MotionConfig would still apply the end value instantly).
 */
export function ChatRoute() {
  const { id = '' } = useParams()
  const calm = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        style={{ height: '100%', transformOrigin: '0% 100%' }}
        initial={calm ? { opacity: 0 } : { opacity: 0, x: 24, rotate: 0.8 }}
        animate={{ opacity: 1, x: 0, rotate: 0, transition: { duration: calm ? 0.12 : 0.28, ease } }}
        exit={calm ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, x: -24, rotate: -1, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
      >
        <ChatView id={id} />
      </motion.div>
    </AnimatePresence>
  )
}
