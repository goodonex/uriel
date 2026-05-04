import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { NodeGraph } from '../three/NodeGraph'

export function NodeGraphPage() {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between"
        style={{ paddingBottom: 12 }}
      >
        <Link
          to="/"
          className="font-display"
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.3px',
            color: 'var(--text-primary)',
          }}
        >
          Brand OS
        </Link>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          Universe
        </span>
      </motion.div>

      <NodeGraph />
    </div>
  )
}
