import {
  Edges,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
} from '@react-three/drei'
import {
  Canvas,
  useThree,
} from '@react-three/fiber'
import {
  useEffect,
  useMemo,
  useRef,
} from 'react'
import type {
  OrbitControls as OrbitControlsInstance,
} from 'three-stdlib'
import * as THREE from 'three'

import type {
  CadRenderPart,
  ImportedCadBody,
} from '../cad/cadClient'

import {
  defaultDisplaySettings,
  type DisplaySettings,
} from './displaySettings'

export type ViewCommandType =
  | 'fit'
  | 'isometric'

export interface ViewCommand {
  id: number
  type: ViewCommandType
}

interface CadViewportProps {
  model: ImportedCadBody | null
  settings?: DisplaySettings
  viewCommand?: ViewCommand | null
  hiddenPartIds?: ReadonlySet<string>
  selectedPartIds?: ReadonlySet<string>
  partColors?: ReadonlyMap<string, string>
  partOpacities?: ReadonlyMap<string, number>
}

interface ViewMetrics {
  target: [number, number, number]
  radius: number
}

function convertZUpToYUp(
  source: number[] | Float32Array,
): Float32Array {
  const input = Float32Array.from(source)
  const output = new Float32Array(input.length)

  for (
    let index = 0;
    index < input.length;
    index += 3
  ) {
    const x = input[index]
    const y = input[index + 1]
    const z = input[index + 2]

    output[index] = x
    output[index + 1] = z
    output[index + 2] = -y
  }

  return output
}

function calculateViewMetrics(
  model: ImportedCadBody | null,
): ViewMetrics {
  if (!model) {
    return {
      target: [0, 0.8, 0],
      radius: 1.75,
    }
  }

  const vertices =
    convertZUpToYUp(
      model.faces.vertices,
    )

  if (vertices.length < 3) {
    return {
      target: [0, 0.8, 0],
      radius: 1.75,
    }
  }

  const bounds = new THREE.Box3()
  const point = new THREE.Vector3()

  for (
    let index = 0;
    index < vertices.length;
    index += 3
  ) {
    point.set(
      vertices[index],
      vertices[index + 1],
      vertices[index + 2],
    )

    bounds.expandByPoint(point)
  }

  const size =
    bounds.getSize(
      new THREE.Vector3(),
    )

  const radius = Math.max(
    size.length() / 2,
    0.5,
  )

  /*
   * ImportedModel centers X and Z and places
   * the bottom of the model on Y = 0.
   */
  return {
    target: [
      0,
      Math.max(size.y / 2, 0.01),
      0,
    ],
    radius,
  }
}

function TestModel({
  settings,
}: {
  settings: DisplaySettings
}) {
  const isWireframe =
    settings.displayStyle ===
    'wireframe'

  const isGhosted =
    settings.displayStyle ===
    'ghosted'

  const showEdges =
    settings.displayStyle ===
      'shaded-edges' ||
    settings.displayStyle ===
      'ghosted'

  const modelOpacity = isGhosted
    ? Math.min(
        settings.modelOpacity,
        0.28,
      )
    : settings.modelOpacity

  return (
    <mesh position={[0, 0.8, 0]}>
      <boxGeometry
        args={[2.6, 1.6, 1.2]}
      />

      <meshStandardMaterial
        color={settings.modelColor}
        metalness={0.05}
        roughness={0.55}
        wireframe={isWireframe}
        transparent={modelOpacity < 1}
        opacity={modelOpacity}
        depthWrite={modelOpacity >= 1}
        side={THREE.DoubleSide}
      />

      {showEdges && !isWireframe && (
        <Edges
          color={settings.edgeColor}
          threshold={15}
        />
      )}
    </mesh>
  )
}

function ImportedPart({
  part,
  settings,
  modelPosition,
  color,
  selected,
  opacity,
}: {
  part: CadRenderPart
  settings: DisplaySettings
  modelPosition: THREE.Vector3
  color: string
  selected: boolean
  opacity: number
}) {
  const faceGeometry =
    useMemo(() => {
      const geometry =
        new THREE.BufferGeometry()

      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          convertZUpToYUp(
            part.faces.vertices,
          ),
          3,
        ),
      )

      if (
        part.faces.normals.length >
        0
      ) {
        geometry.setAttribute(
          'normal',
          new THREE.BufferAttribute(
            convertZUpToYUp(
              part.faces.normals,
            ),
            3,
          ),
        )
      } else {
        geometry.computeVertexNormals()
      }

      geometry.setIndex(
        new THREE.BufferAttribute(
          Uint32Array.from(
            part.faces.triangles,
          ),
          1,
        ),
      )

      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()

      return geometry
    }, [part])

  const edgeGeometry =
    useMemo(() => {
      const geometry =
        new THREE.BufferGeometry()

      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          convertZUpToYUp(
            part.edges.lines,
          ),
          3,
        ),
      )

      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()

      return geometry
    }, [part])

  useEffect(() => {
    return () => {
      faceGeometry.dispose()
      edgeGeometry.dispose()
    }
  }, [
    faceGeometry,
    edgeGeometry,
  ])

  const isWireframe =
    settings.displayStyle ===
    'wireframe'

  const isGhosted =
    settings.displayStyle ===
    'ghosted'

  const showEdges =
    settings.displayStyle ===
      'shaded-edges' ||
    settings.displayStyle ===
      'ghosted'

  const configuredOpacity = settings.modelOpacity * opacity
  const modelOpacity = isGhosted
    ? Math.min(
        configuredOpacity,
        0.28,
      )
    : configuredOpacity

  return (
    <group position={modelPosition}>
      <mesh geometry={faceGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={selected ? '#b86b00' : '#000000'}
          emissiveIntensity={selected ? 0.28 : 0}
          metalness={0.02}
          roughness={0.68}
          wireframe={isWireframe}
          transparent={modelOpacity < 1}
          opacity={modelOpacity}
          depthWrite={
            modelOpacity >= 1
          }
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {showEdges && !isWireframe && (
        <lineSegments
          geometry={edgeGeometry}
        >
          <lineBasicMaterial
            color={settings.edgeColor}
            transparent={
              settings.edgeOpacity < 1
            }
            opacity={
              settings.edgeOpacity
            }
          />
        </lineSegments>
      )}

      {selected && (
        <lineSegments geometry={edgeGeometry} renderOrder={10}>
          <lineBasicMaterial
            color="#ffad24"
            depthTest={false}
            transparent
            opacity={0.95}
          />
        </lineSegments>
      )}
    </group>
  )
}

function ImportedModel({
  model,
  settings,
  hiddenPartIds,
  selectedPartIds,
  partColors,
  partOpacities,
}: {
  model: ImportedCadBody
  settings: DisplaySettings
  hiddenPartIds: ReadonlySet<string>
  selectedPartIds: ReadonlySet<string>
  partColors: ReadonlyMap<string, string>
  partOpacities: ReadonlyMap<string, number>
}) {
  const modelPosition = useMemo(() => {
    const positions = convertZUpToYUp(model.faces.vertices)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox
    geometry.dispose()

    if (!bounds) return new THREE.Vector3()
    const center = bounds.getCenter(new THREE.Vector3())
    return new THREE.Vector3(-center.x, -bounds.min.y, -center.z)
  }, [model])

  return (
    <group>
      {model.renderParts.map((part) => (
        hiddenPartIds.has(part.id) ? null : (
          <ImportedPart
            key={part.id}
            part={part}
            settings={settings}
            modelPosition={modelPosition}
            color={partColors.get(part.id) ?? settings.modelColor}
            selected={selectedPartIds.has(part.id)}
            opacity={partOpacities.get(part.id) ?? 1}
          />
        )
      ))}
    </group>
  )
}

function CameraController({
  command,
  metrics,
}: {
  command: ViewCommand | null
  metrics: ViewMetrics
}) {
  const controlsRef =
    useRef<OrbitControlsInstance>(
      null,
    )

  const getThreeState =
    useThree((state) => state.get)

  const invalidate =
    useThree(
      (state) => state.invalidate,
    )

  useEffect(() => {
    const { camera } =
      getThreeState()

    const target =
      new THREE.Vector3(
        ...metrics.target,
      )

    const direction =
      camera.position
        .clone()
        .sub(target)

    const commandType =
      command?.type ?? 'isometric'

    if (
      commandType ===
      'isometric'
    ) {
      direction.set(1, 0.8, 1)
    }

    if (
      direction.lengthSq() <
      0.000001
    ) {
      direction.set(1, 0.8, 1)
    }

    direction.normalize()

    camera.up.set(0, 1, 0)

    if (
      camera instanceof
      THREE.PerspectiveCamera
    ) {
      const verticalHalfAngle =
        THREE.MathUtils.degToRad(
          camera.fov / 2,
        )

      const horizontalHalfAngle =
        Math.atan(
          Math.tan(
            verticalHalfAngle,
          ) * camera.aspect,
        )

      const limitingHalfAngle =
        Math.min(
          verticalHalfAngle,
          horizontalHalfAngle,
        )

      const distance =
        (
          metrics.radius /
          Math.sin(
            Math.max(
              limitingHalfAngle,
              0.01,
            ),
          )
        ) * 1.2

      camera.position
        .copy(target)
        .addScaledVector(
          direction,
          distance,
        )

      camera.near = Math.max(
        0.01,
        distance -
          metrics.radius * 3,
      )

      camera.far = Math.max(
        1000,
        distance +
          metrics.radius * 20,
      )
    }

    if (
      camera instanceof
      THREE.OrthographicCamera
    ) {
      const desiredHeight =
        Math.max(
          metrics.radius * 2.5,
          1,
        )

      const baseHeight =
        Math.abs(
          camera.top -
            camera.bottom,
        )

      camera.zoom =
        baseHeight /
        desiredHeight

      const distance =
        Math.max(
          metrics.radius * 4,
          10,
        )

      camera.position
        .copy(target)
        .addScaledVector(
          direction,
          distance,
        )

      camera.near = 0.01
      camera.far = Math.max(
        1000,
        distance +
          metrics.radius * 20,
      )
    }

    camera.lookAt(target)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    const controls =
      controlsRef.current

    if (controls) {
      controls.target.copy(target)
      controls.update()
    }

    invalidate()
  }, [
    command,
    getThreeState,
    invalidate,
    metrics.radius,
    metrics.target,
  ])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.01}
      maxDistance={100000}
    />
  )
}

export function CadViewport({
  model,
  settings =
    defaultDisplaySettings,
  viewCommand = null,
  hiddenPartIds = new Set<string>(),
  selectedPartIds = new Set<string>(),
  partColors = new Map<string, string>(),
  partOpacities = new Map<string, number>(),
}: CadViewportProps) {
  const lightStrength =
    settings.brightness

  const isOrthographic =
    settings.projection ===
    'orthographic'

  const viewMetrics =
    useMemo(
      () =>
        calculateViewMetrics(
          model,
        ),
      [model],
    )

  const gridCellSize = Math.max(viewMetrics.radius / 8, 0.1)
  const gridSectionSize = gridCellSize * 5

  return (
    <Canvas
      key={settings.projection}
      orthographic={
        isOrthographic
      }
      camera={{
        position: [5, 4, 6],
        fov: 42,
        zoom: 1,
        near: 0.01,
        far: 100000,
      }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer:
          true,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      <color
        attach="background"
        args={[
          settings.backgroundColor,
        ]}
      />

      <ambientLight
        intensity={
          0.72 * lightStrength
        }
      />

      <hemisphereLight
        intensity={
          0.82 * lightStrength
        }
        color="#d8ecff"
        groundColor="#182430"
      />

      <directionalLight
        intensity={
          2.5 * lightStrength
        }
        position={[7, 10, 8]}
      />

      <directionalLight
        intensity={
          0.42 * lightStrength
        }
        position={[-5, 3, -6]}
      />

      {settings.showGrid && (
        <Grid
          position={[
            0,
            -0.002,
            0,
          ]}
          infiniteGrid
          followCamera
          frustumCulled={false}
          side={THREE.DoubleSide}
          cellSize={gridCellSize}
          cellThickness={0.45}
          cellColor={
            settings.gridColor
          }
          sectionSize={gridSectionSize}
          sectionThickness={0.9}
          sectionColor={
            settings.gridColor
          }
          fadeDistance={Math.max(viewMetrics.radius * 8, 20)}
          fadeStrength={1.4}
          fadeFrom={1}
        />
      )}

      {settings.showAxes && (
        <axesHelper
          args={[3]}
          position={[
            0,
            0.005,
            0,
          ]}
        />
      )}

      {model ? (
        <ImportedModel
          model={model}
          settings={settings}
          hiddenPartIds={hiddenPartIds}
          selectedPartIds={selectedPartIds}
          partColors={partColors}
          partOpacities={partOpacities}
        />
      ) : (
        <TestModel
          settings={settings}
        />
      )}

      <CameraController
        command={viewCommand}
        metrics={viewMetrics}
      />

      {settings.showViewCube && (
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
      )}
    </Canvas>
  )
}
