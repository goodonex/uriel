import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

interface CameraRigProps {
  parallaxStrength?: number
  damping?: number
  tunnelTarget: THREE.Vector3 | null
  onTunnelComplete?: () => void
}

const REST_POSITION = new THREE.Vector3(0, 0, 11)
const REST_FOV = 35
const TUNNEL_FOV = 80
const TUNNEL_DISTANCE = 1.4

// CameraRig:
// - dampened parallax follow of mouse pointer in rest mode
// - on tunnelTarget, lerps the camera toward node and widens FOV;
//   fires onTunnelComplete once the camera is close enough.
export function CameraRig({
  parallaxStrength = 0.6,
  damping = 0.06,
  tunnelTarget,
  onTunnelComplete,
}: CameraRigProps) {
  const { camera, pointer } = useThree()
  const completed = useRef(false)
  const desired = useRef(new THREE.Vector3())
  const desiredFov = useRef(REST_FOV)

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return

    if (tunnelTarget) {
      const dir = tunnelTarget.clone().normalize()
      desired.current.copy(tunnelTarget).addScaledVector(dir, -TUNNEL_DISTANCE)
      desiredFov.current = TUNNEL_FOV
    } else {
      completed.current = false
      desired.current.set(
        REST_POSITION.x + pointer.x * parallaxStrength,
        REST_POSITION.y + pointer.y * parallaxStrength,
        REST_POSITION.z,
      )
      desiredFov.current = REST_FOV
    }

    camera.position.lerp(desired.current, damping)
    const fovDelta = desiredFov.current - camera.fov
    if (Math.abs(fovDelta) > 0.05) {
      camera.fov += fovDelta * damping
      camera.updateProjectionMatrix()
    }

    if (tunnelTarget) {
      camera.lookAt(tunnelTarget)
      const dist = camera.position.distanceTo(tunnelTarget)
      if (!completed.current && dist < TUNNEL_DISTANCE + 0.15) {
        completed.current = true
        onTunnelComplete?.()
      }
    } else {
      camera.lookAt(0, 0, 0)
    }
  })

  return null
}
