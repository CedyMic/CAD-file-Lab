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
import { calculateModelLayout } from './modelLayout'
import { createSectionPlane, type SectionSettings } from './sectionClipping'

import {
  addDistancePoint,
  closestPolylinePoints,
  coordinateDeltas,
  circularPolylineRadius,
  emptyDistanceMeasurement,
  faceAngleDegrees,
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
  section?: SectionSettings | null
  viewCommand?: ViewCommand | null
  hiddenPartIds?: ReadonlySet<string>
  selectedPartIds?: ReadonlySet<string>
  partColors?: ReadonlyMap<string, string>
  partOpacities?: ReadonlyMap<string, number>
  onSelectPart?: (partId: string, additive: boolean) => void
  onClearSelection?: () => void
  measurementEnabled?: boolean
  onMeasurementChange?: (summary: MeasurementSummary) => void
  measurementMode?: MeasurementMode
  modifyFaceSelection?: ModifyFaceSelection | null
  onModifyFaceSelect?: (selection: ModifyFaceSelection) => void
  modifyPreviewOffset?: number
}

export interface ModifyFaceSelection {
  partId: string
  faceId: number
  point: MeasurementPoint
  normal: MeasurementPoint
  surfaceTriangles: MeasurementPoint[]
}

export type MeasurementMode = 'auto' | 'point' | 'face' | 'edge'

export interface MeasurementSummary {
  selections: string[]
  distance?: number
  deltaX?: number
  deltaY?: number
  deltaZ?: number
  faceGap?: number
  faceAngle?: number
  lineLength?: number
  radius?: number
  diameter?: number
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
  sectionPlane,
  onSelect,
  onMeasurePoint,
  onMeasureLine,
  onModifyFaceSelect,
  measurementMode,
}: {
  part: CadRenderPart
  settings: DisplaySettings
  modelPosition: THREE.Vector3
  color: string
  selected: boolean
  opacity: number
  sectionPlane: THREE.Plane | null
  onSelect: (additive: boolean) => void
  onMeasurePoint?: (sample: FaceSample) => void
  onMeasureLine?: (first: MeasurementPoint, second: MeasurementPoint, vertices: MeasurementPoint[], length: number, entityId: string) => void
  onModifyFaceSelect?: (selection: ModifyFaceSelection) => void
  measurementMode: MeasurementMode
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
          const triangleOffset = (event.faceIndex ?? -1) * 3
          const faceGroup = part.faces.faceGroups?.find((group) => (
            triangleOffset >= group.start && triangleOffset < group.start + group.count
          ))
          if (onModifyFaceSelect) {
            const normal = event.face?.normal.clone()
            if (!faceGroup || !normal) return
            normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(event.object.matrixWorld))
            const geometryIndex = faceGeometry.getIndex()
            const positions = faceGeometry.getAttribute('position')
            const surfaceTriangles: MeasurementPoint[] = []
            for (let offset = faceGroup.start; offset < faceGroup.start + faceGroup.count; offset += 1) {
              const vertexIndex = geometryIndex ? geometryIndex.getX(offset) : offset
              const vertex = new THREE.Vector3().fromBufferAttribute(positions, vertexIndex).applyMatrix4(event.object.matrixWorld)
              surfaceTriangles.push([vertex.x, vertex.y, vertex.z])
            }
            onModifyFaceSelect({
              partId: part.id,
              faceId: faceGroup.faceId,
              point: [event.point.x, event.point.y, event.point.z],
              normal: [normal.x, normal.y, normal.z],
              surfaceTriangles,
            })
            return
          }
          if (onMeasurePoint) {
            if (measurementMode === 'edge') return
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
            const surfaceTriangles: MeasurementPoint[] = []
            if (faceGroup) {
              const geometryIndex = faceGeometry.getIndex()
              const positions = faceGeometry.getAttribute('position')
              for (let offset = faceGroup.start; offset < faceGroup.start + faceGroup.count; offset += 1) {
                const vertexIndex = geometryIndex ? geometryIndex.getX(offset) : offset
                const vertex = new THREE.Vector3().fromBufferAttribute(positions, vertexIndex).applyMatrix4(event.object.matrixWorld)
                surfaceTriangles.push([vertex.x, vertex.y, vertex.z])
              }
            }
            onMeasurePoint({
              point: [event.point.x, event.point.y, event.point.z],
              normal: [normal.x, normal.y, normal.z],
              triangle,
              surfaceTriangles: measurementMode === 'point' ? undefined : surfaceTriangles.length ? surfaceTriangles : undefined,
              entityId: measurementMode === 'point' ? undefined : faceGroup ? `${part.id}-face-${faceGroup.faceId}` : undefined,
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
          clippingPlanes={sectionPlane ? [sectionPlane] : undefined}
        />
      </mesh>

      {(showEdges || onMeasureLine) && !isWireframe && (
        <lineSegments
          geometry={edgeGeometry}
          onClick={(event) => {
            if (!onMeasureLine) return
            if (measurementMode === 'point' || measurementMode === 'face') return
            event.stopPropagation()
            const position = edgeGeometry.getAttribute('position')
            const hitIndex = Math.max(0, Math.min(event.index ?? 0, position.count - 2))
            const group = part.edges.edgeGroups?.find((candidate) => hitIndex >= candidate.start && hitIndex < candidate.start + candidate.count)
            const startIndex = group?.start ?? hitIndex
            const count = group?.count ?? 2
            const vertices = Array.from({ length: count }, (_, offset) => {
              const point = new THREE.Vector3().fromBufferAttribute(position, startIndex + offset).applyMatrix4(event.object.matrixWorld)
              return [point.x, point.y, point.z] as MeasurementPoint
            })
            let length = 0
            for (let index = 0; index + 1 < vertices.length; index += 2) {
              length += new THREE.Vector3(...vertices[index]).distanceTo(new THREE.Vector3(...vertices[index + 1]))
            }
            onMeasureLine(vertices[0], vertices[vertices.length - 1], vertices, length, `${part.id}-edge-${group?.edgeId ?? hitIndex}`)
          }}
        >
          <lineBasicMaterial
            color={settings.edgeColor}
            transparent={
              settings.edgeOpacity < 1
            }
            opacity={showEdges ? settings.edgeOpacity : 0}
            clippingPlanes={sectionPlane ? [sectionPlane] : undefined}
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
            clippingPlanes={sectionPlane ? [sectionPlane] : undefined}
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
  onModifyFaceSelect,
  measurementMode,
  modelPosition,
  sectionPlane,
}: {
  model: ImportedCadBody
  settings: DisplaySettings
  hiddenPartIds: ReadonlySet<string>
  selectedPartIds: ReadonlySet<string>
  partColors: ReadonlyMap<string, string>
  partOpacities: ReadonlyMap<string, number>
  onSelectPart: (partId: string, additive: boolean) => void
  onMeasurePoint?: (sample: FaceSample) => void
  onMeasureLine?: (first: MeasurementPoint, second: MeasurementPoint, vertices: MeasurementPoint[], length: number, entityId: string) => void
  onModifyFaceSelect?: (selection: ModifyFaceSelection) => void
  measurementMode: MeasurementMode
  modelPosition: THREE.Vector3
  sectionPlane: THREE.Plane | null
}) {
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
            sectionPlane={sectionPlane}
            onSelect={(additive) => onSelectPart(part.id, additive)}
            onMeasurePoint={onMeasurePoint}
            onMeasureLine={onMeasureLine}
            onModifyFaceSelect={onModifyFaceSelect}
            measurementMode={measurementMode}
          />
        )
      ))}
    </group>
  )
}

function DistanceAnnotation({
  points,
  faces,
  lineVertices,
}: {
  points: readonly MeasurementPoint[]
  faces: readonly FaceSample[]
  lineVertices: readonly MeasurementPoint[]
}) {
  if (points.length === 0) return null

  const first = new THREE.Vector3(...points[0])
  const second = points.length === 2 ? new THREE.Vector3(...points[1]) : null
  const positions = second
    ? new Float32Array([...first.toArray(), ...second.toArray()])
    : null

  return (
    <group>
      {faces.map((face, index) => (face.surfaceTriangles ?? face.triangle) && (
        <mesh key={`face-${index}`} renderOrder={19}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array((face.surfaceTriangles ?? face.triangle!).flat()), 3]}
            />
          </bufferGeometry>
          <meshBasicMaterial color="#ffad24" transparent opacity={0.42} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Html position={first} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', color: '#07131c', background: '#35b7ff', border: '2px solid white', borderRadius: '50%', boxShadow: '0 0 0 2px #0879b7, 0 2px 6px #0009', font: '700 10px system-ui' }}>1</div>
      </Html>
      {second && positions && (
        <>
          <Html position={second} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', color: '#07131c', background: '#35b7ff', border: '2px solid white', borderRadius: '50%', boxShadow: '0 0 0 2px #0879b7, 0 2px 6px #0009', font: '700 10px system-ui' }}>2</div>
          </Html>
          <lineSegments renderOrder={20}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color="#21a7ff" depthTest={false} />
          </lineSegments>
        </>
      )}
      {lineVertices.length > 1 && (
        <lineSegments renderOrder={21}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(lineVertices.flat()), 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#ffad24" depthTest={false} />
        </lineSegments>
      )}
    </group>
  )
}

function ModifyFaceHighlight({ selection, offset }: { selection: ModifyFaceSelection; offset: number }) {
  const [nx, ny, nz] = selection.normal
  const positions = new Float32Array(selection.surfaceTriangles.flatMap(([x, y, z]) => [x + nx * offset, y + ny * offset, z + nz * offset]))
  return <mesh renderOrder={24}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <meshBasicMaterial color="#ffb21c" transparent opacity={0.5} depthTest={false} side={THREE.DoubleSide} />
  </mesh>
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
  measurementMode,
  modelPosition,
  sectionPlane,
}: {
  model: ImportedCadBody
  settings: DisplaySettings
  hiddenPartIds: ReadonlySet<string>
  selectedPartIds: ReadonlySet<string>
  partColors: ReadonlyMap<string, string>
  partOpacities: ReadonlyMap<string, number>
  onSelectPart: (partId: string, additive: boolean) => void
  onMeasurementChange?: (summary: MeasurementSummary) => void
  measurementMode: MeasurementMode
  modelPosition: THREE.Vector3
  sectionPlane: THREE.Plane | null
}) {
  const [measurement, setMeasurement] = useState({
    distance: emptyDistanceMeasurement,
    faces: [] as FaceSample[],
    kind: 'points' as 'points' | 'line',
    lineVertices: [] as MeasurementPoint[],
    lineLength: undefined as number | undefined,
    radius: undefined as number | undefined,
    lineEntityId: undefined as string | undefined,
    lineSelections: [] as Array<{ id: string; vertices: MeasurementPoint[]; length: number; radius?: number }>,
  })

  const emptyMeasurement = () => ({
    distance: emptyDistanceMeasurement,
    faces: [] as FaceSample[],
    kind: 'points' as const,
    lineVertices: [] as MeasurementPoint[],
    lineLength: undefined,
    radius: undefined,
    lineEntityId: undefined,
    lineSelections: [] as Array<{ id: string; vertices: MeasurementPoint[]; length: number; radius?: number }>,
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMeasurement(emptyMeasurement())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const points = measurement.distance.points
    if (points.length !== 2) {
      onMeasurementChange?.({
        selections: measurement.kind === 'line'
          ? measurement.lineSelections.map((_, index) => `Edge ${index + 1}`)
          : measurement.faces.length
            ? measurement.faces.map((_, index) => `Face ${index + 1}`)
            : points.map((_, index) => `Point ${index + 1}`),
      })
      return
    }
    const world = coordinateDeltas(points[0], points[1])
    const faceGap = measurement.faces.length === 2
      ? parallelFaceDistance(measurement.faces[0], measurement.faces[1])
      : null
    onMeasurementChange?.({
      selections: measurement.kind === 'line'
        ? measurement.lineSelections.map((_, index) => `Edge ${index + 1}`)
        : measurement.faces.length
          ? measurement.faces.map((_, index) => `Face ${index + 1}`)
          : points.map((_, index) => `Point ${index + 1}`),
      distance: measurement.kind !== 'line' || measurement.lineSelections.length === 2
        ? getDistanceMillimetres(measurement.distance) ?? undefined
        : undefined,
      deltaX: world[0],
      deltaY: -world[2],
      deltaZ: world[1],
      faceGap: faceGap ?? undefined,
      faceAngle: measurement.faces.length === 2 && faceGap === null
        ? faceAngleDegrees(measurement.faces[0], measurement.faces[1])
        : undefined,
      lineLength: measurement.kind === 'line' ? measurement.lineLength : undefined,
      radius: measurement.radius,
      diameter: measurement.radius === undefined ? undefined : measurement.radius * 2,
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
        measurementMode={measurementMode}
        modelPosition={modelPosition}
        sectionPlane={sectionPlane}
        onMeasurePoint={(sample) => {
          setMeasurement((current) => {
            const existing = current.faces.length === 1 ? current.faces[0] : null
            if (measurementMode === 'face' && !sample.entityId) return current
            const sameFace = Boolean(existing?.entityId && sample.entityId && existing.entityId === sample.entityId)
            if (sameFace) return emptyMeasurement()
            const restart = current.distance.points.length >= 2
            return {
              distance: addDistancePoint(current.distance, sample.point),
              faces: measurementMode === 'point' ? [] : restart ? [sample] : [...current.faces, sample],
              kind: 'points',
              lineVertices: [],
              lineLength: undefined,
              radius: undefined,
              lineEntityId: undefined,
              lineSelections: [],
            }
          })
        }}
        onMeasureLine={(first, second, vertices, length, entityId) => {
          setMeasurement((current) => {
            const existingIndex = current.lineSelections.findIndex((edge) => edge.id === entityId)
            if (existingIndex >= 0) {
              const remaining = current.lineSelections.filter((_, index) => index !== existingIndex)
              if (!remaining.length) return emptyMeasurement()
              const edge = remaining[0]
              return {
                distance: { points: [edge.vertices[0], edge.vertices[edge.vertices.length - 1]] },
                faces: [], kind: 'line', lineVertices: edge.vertices, lineLength: edge.length,
                radius: edge.radius, lineEntityId: edge.id, lineSelections: remaining,
              }
            }
            const edge = { id: entityId, vertices, length, radius: circularPolylineRadius(vertices) ?? undefined }
            if (current.kind === 'line' && current.lineSelections.length === 1) {
              const edges = [current.lineSelections[0], edge]
              const closest = closestPolylinePoints(edges[0].vertices, edges[1].vertices)
              return {
                distance: { points: [closest.first, closest.second] }, faces: [], kind: 'line',
                lineVertices: [...edges[0].vertices, ...edges[1].vertices], lineLength: undefined,
                radius: undefined, lineEntityId: undefined, lineSelections: edges,
              }
            }
            return {
              distance: { points: [first, second] }, faces: [], kind: 'line', lineVertices: vertices,
              lineLength: length, radius: edge.radius, lineEntityId: entityId, lineSelections: [edge],
            }
          })
        }}
      />
      <DistanceAnnotation
        points={measurement.distance.points}
        faces={measurement.faces}
        lineVertices={measurement.lineVertices}
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
  section = null,
  viewCommand = null,
  hiddenPartIds = new Set<string>(),
  selectedPartIds = new Set<string>(),
  partColors = new Map<string, string>(),
  partOpacities = new Map<string, number>(),
  onSelectPart = () => undefined,
  onClearSelection = () => undefined,
  measurementEnabled = false,
  onMeasurementChange,
  measurementMode = 'auto',
  modifyFaceSelection = null,
  onModifyFaceSelect,
  modifyPreviewOffset = 0,
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

  const modelLayout = useMemo(() => calculateModelLayout(model), [model])
  const modelPosition = useMemo(() => new THREE.Vector3(...modelLayout.position), [modelLayout])
  const sectionPlane = useMemo(() => {
    if (!model || !section) return null
    const definition = createSectionPlane(model, modelLayout, section)
    return definition
      ? new THREE.Plane(new THREE.Vector3(...definition.normal), definition.constant)
      : null
  }, [model, modelLayout, section])

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
        gl.localClippingEnabled = true
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
              key={`${model.bodyId}-${measurementResetId}-${measurementMode}`}
              model={model}
              settings={settings}
              hiddenPartIds={hiddenPartIds}
              selectedPartIds={selectedPartIds}
              partColors={partColors}
              partOpacities={partOpacities}
              onSelectPart={onSelectPart}
              onMeasurementChange={onMeasurementChange}
              measurementMode={measurementMode}
              modelPosition={modelPosition}
              sectionPlane={sectionPlane}
            />
          ) : (
            <ImportedModel
              model={model}
              measurementMode="auto"
              settings={settings}
              hiddenPartIds={hiddenPartIds}
              selectedPartIds={selectedPartIds}
              partColors={partColors}
              partOpacities={partOpacities}
              onSelectPart={onSelectPart}
              onModifyFaceSelect={onModifyFaceSelect}
              modelPosition={modelPosition}
              sectionPlane={sectionPlane}
            />
          )}
          {!section && <ContactShadows
            position={[0, -0.002, 0]}
            opacity={0.32}
            scale={Math.max(viewMetrics.radius * 4, 4)}
            blur={2.4}
            far={Math.max(viewMetrics.radius * 3, 3)}
            resolution={512}
            color="#05090d"
          />}
          {modifyFaceSelection && <ModifyFaceHighlight selection={modifyFaceSelection} offset={modifyPreviewOffset} />}
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
