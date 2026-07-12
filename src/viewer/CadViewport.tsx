import {
  ContactShadows,
  Edges,
  GizmoHelper,
  GizmoViewport,
  Grid,
  Html,
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
  useState,
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

import {
  addDistancePoint,
  coordinateDeltas,
  emptyDistanceMeasurement,
  faceAngleDegrees,
  formatDistanceMillimetres,
  getDistanceMillimetres,
  parallelFaceDistance,
  type FaceSample,
  type MeasurementPoint,
} from './measurement'

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
  onSelectPart?: (partId: string, additive: boolean) => void
  onClearSelection?: () => void
  measurementEnabled?: boolean
  onMeasurementChange?: (summary: MeasurementSummary) => void
}

export interface MeasurementSummary {
  selections: string[]
  distance?: number
  deltaX?: number
  deltaY?: number
  deltaZ?: number
  faceGap?: number
  faceAngle?: number
  lineLength?: number
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
  onSelect,
  onMeasurePoint,
  onMeasureLine,
}: {
  part: CadRenderPart
  settings: DisplaySettings
  modelPosition: THREE.Vector3
  color: string
  selected: boolean
  opacity: number
  onSelect: (additive: boolean) => void
  onMeasurePoint?: (sample: FaceSample) => void
  onMeasureLine?: (first: MeasurementPoint, second: MeasurementPoint) => void
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
      <mesh
        geometry={faceGeometry}
        onClick={(event) => {
          event.stopPropagation()
          if (onMeasurePoint) {
            const normal = event.face?.normal.clone()
            if (!normal) return
            normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(event.object.matrixWorld))
            const triangle = event.face
              ? ([event.face.a, event.face.b, event.face.c].map((index) => {
                  const vertex = new THREE.Vector3().fromBufferAttribute(faceGeometry.getAttribute('position'), index)
                  vertex.applyMatrix4(event.object.matrixWorld)
                  return [vertex.x, vertex.y, vertex.z] as MeasurementPoint
                }) as [MeasurementPoint, MeasurementPoint, MeasurementPoint])
              : undefined
            onMeasurePoint({
              point: [event.point.x, event.point.y, event.point.z],
              normal: [normal.x, normal.y, normal.z],
              triangle,
            })
            return
          }
          const nativeEvent = event.nativeEvent
          onSelect(nativeEvent.ctrlKey || nativeEvent.metaKey || nativeEvent.shiftKey)
        }}
      >
        <meshStandardMaterial
          color={color}
          emissive="#000000"
          emissiveIntensity={0}
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

      {(showEdges || onMeasureLine) && !isWireframe && (
        <lineSegments
          geometry={edgeGeometry}
          onClick={(event) => {
            if (!onMeasureLine) return
            event.stopPropagation()
            const position = edgeGeometry.getAttribute('position')
            const startIndex = Math.max(0, Math.min(event.index ?? 0, position.count - 2))
            const first = new THREE.Vector3().fromBufferAttribute(position, startIndex).applyMatrix4(event.object.matrixWorld)
            const second = new THREE.Vector3().fromBufferAttribute(position, startIndex + 1).applyMatrix4(event.object.matrixWorld)
            onMeasureLine([first.x, first.y, first.z], [second.x, second.y, second.z])
          }}
        >
          <lineBasicMaterial
            color={settings.edgeColor}
            transparent={
              settings.edgeOpacity < 1
            }
            opacity={showEdges ? settings.edgeOpacity : 0}
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
  onSelectPart,
  onMeasurePoint,
  onMeasureLine,
}: {
  model: ImportedCadBody
  settings: DisplaySettings
  hiddenPartIds: ReadonlySet<string>
  selectedPartIds: ReadonlySet<string>
  partColors: ReadonlyMap<string, string>
  partOpacities: ReadonlyMap<string, number>
  onSelectPart: (partId: string, additive: boolean) => void
  onMeasurePoint?: (sample: FaceSample) => void
  onMeasureLine?: (first: MeasurementPoint, second: MeasurementPoint) => void
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
            onSelect={(additive) => onSelectPart(part.id, additive)}
            onMeasurePoint={onMeasurePoint}
            onMeasureLine={onMeasureLine}
          />
        )
      ))}
    </group>
  )
}

function DistanceAnnotation({
  points,
  faces,
  kind,
  onReset,
}: {
  points: readonly MeasurementPoint[]
  faces: readonly FaceSample[]
  kind: 'points' | 'line'
  onReset: () => void
}) {
  if (points.length === 0) return null

  const first = new THREE.Vector3(...points[0])
  const second = points.length === 2 ? new THREE.Vector3(...points[1]) : null
  const positions = second
    ? new Float32Array([...first.toArray(), ...second.toArray()])
    : null
  const distance = points.length === 2
    ? getDistanceMillimetres({ points })
    : null
  const faceDistance = faces.length === 2
    ? parallelFaceDistance(faces[0], faces[1])
    : null
  const faceAngle = faces.length === 2
    ? faceAngleDegrees(faces[0], faces[1])
    : null
  const labelPosition = second
    ? first.clone().add(second).multiplyScalar(0.5)
    : first
  const worldDeltas = second ? coordinateDeltas(points[0], points[1]) : null
  const modelDeltas = worldDeltas
    ? [worldDeltas[0], -worldDeltas[2], worldDeltas[1]] as const
    : null

  return (
    <group>
      {faces.map((face, index) => face.triangle && (
        <mesh key={`face-${index}`} renderOrder={19}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(face.triangle.flat()), 3]}
            />
          </bufferGeometry>
          <meshBasicMaterial color="#ffad24" transparent opacity={0.42} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={first} renderOrder={20}>
        <sphereGeometry args={[0.055, 16, 12]} />
        <meshBasicMaterial color="#21a7ff" depthTest={false} />
      </mesh>
      {second && positions && (
        <>
          <mesh position={second} renderOrder={20}>
            <sphereGeometry args={[0.055, 16, 12]} />
            <meshBasicMaterial color="#21a7ff" depthTest={false} />
          </mesh>
          <lineSegments renderOrder={20}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#21a7ff" depthTest={false} />
          </lineSegments>
        </>
      )}
      <Html position={labelPosition} center zIndexRange={[40, 0]}>
        <div style={{ background: '#102331ee', border: '1px solid #4380a3', borderRadius: 4, color: '#eef8ff', font: '600 12px system-ui', padding: '5px 7px', whiteSpace: 'nowrap', pointerEvents: 'auto' }}>
          <span style={{ display: 'block', marginBottom: 3, color: '#86bddd', fontSize: 10, fontWeight: 600 }}>
            Selected: {kind === 'line' ? 'Line' : faces.map((_, index) => `Face ${index + 1}`).join(' · ') || `Point ${points.length}`}
          </span>
          {distance === null ? 'Select second point' : `${kind === 'line' ? 'Line length' : 'Minimum'} ${formatDistanceMillimetres(distance)}`}
          {distance !== null && (
            <span style={{ marginLeft: 7, color: faceDistance === null ? '#f0c68c' : '#9de0b4' }}>
              {faceDistance === null
                ? `Face angle ${faceAngle?.toFixed(1)}°`
                : `Face gap ${formatDistanceMillimetres(faceDistance)}`}
            </span>
          )}
          {modelDeltas && (
            <span style={{ display: 'block', marginTop: 3, color: '#b9d2e2', fontWeight: 500 }}>
              ΔX {formatDistanceMillimetres(Math.abs(modelDeltas[0]))} · ΔY {formatDistanceMillimetres(Math.abs(modelDeltas[1]))} · ΔZ {formatDistanceMillimetres(Math.abs(modelDeltas[2]))}
            </span>
          )}
          <button type="button" onClick={onReset} aria-label="Clear measurement" style={{ background: 'transparent', border: 0, color: '#9dc8df', cursor: 'pointer', marginLeft: 7, padding: 0 }}>×</button>
        </div>
      </Html>
    </group>
  )
}

function MeasurableImportedModel({
  model,
  settings,
  hiddenPartIds,
  selectedPartIds,
  partColors,
  partOpacities,
  onSelectPart,
  onMeasurementChange,
}: {
  model: ImportedCadBody
  settings: DisplaySettings
  hiddenPartIds: ReadonlySet<string>
  selectedPartIds: ReadonlySet<string>
  partColors: ReadonlyMap<string, string>
  partOpacities: ReadonlyMap<string, number>
  onSelectPart: (partId: string, additive: boolean) => void
  onMeasurementChange?: (summary: MeasurementSummary) => void
}) {
  const [measurement, setMeasurement] = useState({
    distance: emptyDistanceMeasurement,
    faces: [] as FaceSample[],
    kind: 'points' as 'points' | 'line',
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMeasurement({ distance: emptyDistanceMeasurement, faces: [], kind: 'points' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const points = measurement.distance.points
    if (points.length !== 2) {
      onMeasurementChange?.({
        selections: measurement.kind === 'line' ? ['Line'] : measurement.faces.map((_, index) => `Face ${index + 1}`),
      })
      return
    }
    const world = coordinateDeltas(points[0], points[1])
    const faceGap = measurement.faces.length === 2
      ? parallelFaceDistance(measurement.faces[0], measurement.faces[1])
      : null
    onMeasurementChange?.({
      selections: measurement.kind === 'line' ? ['Line'] : measurement.faces.map((_, index) => `Face ${index + 1}`),
      distance: getDistanceMillimetres(measurement.distance) ?? undefined,
      deltaX: world[0],
      deltaY: -world[2],
      deltaZ: world[1],
      faceGap: faceGap ?? undefined,
      faceAngle: measurement.faces.length === 2 && faceGap === null
        ? faceAngleDegrees(measurement.faces[0], measurement.faces[1])
        : undefined,
      lineLength: measurement.kind === 'line' ? getDistanceMillimetres(measurement.distance) ?? undefined : undefined,
    })
  }, [measurement, onMeasurementChange])

  return (
    <>
      <ImportedModel
        model={model}
        settings={settings}
        hiddenPartIds={hiddenPartIds}
        selectedPartIds={selectedPartIds}
        partColors={partColors}
        partOpacities={partOpacities}
        onSelectPart={onSelectPart}
        onMeasurePoint={(sample) => {
          setMeasurement((current) => {
            const existing = current.faces.length === 1 ? current.faces[0] : null
            const sameFace = existing?.triangle && sample.triangle && existing.triangle.every(
              (point, pointIndex) => point.every(
                (value, axis) => Math.abs(value - sample.triangle![pointIndex][axis]) < 1e-7,
              ),
            )
            if (sameFace) return { distance: emptyDistanceMeasurement, faces: [], kind: 'points' }
            const restart = current.distance.points.length >= 2
            return {
              distance: addDistancePoint(current.distance, sample.point),
              faces: restart ? [sample] : [...current.faces, sample],
              kind: 'points',
            }
          })
        }}
        onMeasureLine={(first, second) => {
          setMeasurement({ distance: { points: [first, second] }, faces: [], kind: 'line' })
        }}
      />
      <DistanceAnnotation
        points={measurement.distance.points}
        faces={measurement.faces}
        kind={measurement.kind}
        onReset={() => setMeasurement({ distance: emptyDistanceMeasurement, faces: [], kind: 'points' })}
      />
    </>
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
  onSelectPart = () => undefined,
  onClearSelection = () => undefined,
  measurementEnabled = false,
  onMeasurementChange,
}: CadViewportProps) {
  const [measurementResetId, setMeasurementResetId] = useState(0)
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
      onPointerMissed={() => {
        onClearSelection()
        if (measurementEnabled) setMeasurementResetId((current) => current + 1)
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

      <directionalLight
        intensity={0.7 * lightStrength}
        color="#8fc9ff"
        position={[-8, 7, 10]}
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
        <>
          {measurementEnabled ? (
            <MeasurableImportedModel
              key={`${model.bodyId}-${measurementResetId}`}
              model={model}
              settings={settings}
              hiddenPartIds={hiddenPartIds}
              selectedPartIds={selectedPartIds}
              partColors={partColors}
              partOpacities={partOpacities}
              onSelectPart={onSelectPart}
              onMeasurementChange={onMeasurementChange}
            />
          ) : (
            <ImportedModel
              model={model}
              settings={settings}
              hiddenPartIds={hiddenPartIds}
              selectedPartIds={selectedPartIds}
              partColors={partColors}
              partOpacities={partOpacities}
              onSelectPart={onSelectPart}
            />
          )}
          <ContactShadows
            position={[0, -0.002, 0]}
            opacity={0.32}
            scale={Math.max(viewMetrics.radius * 4, 4)}
            blur={2.4}
            far={Math.max(viewMetrics.radius * 3, 3)}
            resolution={512}
            color="#05090d"
          />
        </>
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
