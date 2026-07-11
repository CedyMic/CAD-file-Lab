import {
  Edges,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

function TestModel() {
  return (
    <mesh
      castShadow
      receiveShadow
      position={[0, 0.8, 0]}
    >
      <boxGeometry args={[2.6, 1.6, 1.2]} />

      <meshStandardMaterial
        color="#91b9db"
        metalness={0.08}
        roughness={0.52}
      />

      <Edges
        color="#30495e"
        threshold={15}
      />
    </mesh>
  )
}

export function CadViewport() {
  return (
    <Canvas
      shadows
      camera={{
        position: [5, 4, 6],
        fov: 42,
        near: 0.01,
        far: 10000,
      }}
    >
      <color attach="background" args={['#10171f']} />

      <ambientLight intensity={1.4} />

      <directionalLight
        castShadow
        intensity={2.8}
        position={[6, 10, 8]}
      />

      <directionalLight
        intensity={0.7}
        position={[-5, 2, -4]}
      />

      <Grid
        position={[0, 0, 0]}
        infiniteGrid
        cellSize={0.5}
        sectionSize={5}
        cellColor="#263746"
        sectionColor="#45627a"
        fadeDistance={45}
        fadeStrength={1.5}
      />

      <axesHelper
        args={[3]}
        position={[0, 0.01, 0]}
      />

      <TestModel />

      <OrbitControls
        makeDefault
        target={[0, 0.8, 0]}
        enableDamping
        dampingFactor={0.08}
      />

      <GizmoHelper
        alignment="bottom-right"
        margin={[72, 72]}
      >
        <GizmoViewport
          axisColors={[
            '#ef5350',
            '#66bb6a',
            '#42a5f5',
          ]}
          labelColor="#ffffff"
        />
      </GizmoHelper>
    </Canvas>
  )
}