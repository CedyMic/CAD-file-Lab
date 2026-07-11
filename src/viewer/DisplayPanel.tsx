export type DisplayStyle =
  | 'shaded'
  | 'shaded-edges'
  | 'wireframe'
  | 'ghosted'

export type ProjectionMode =
  | 'perspective'
  | 'orthographic'

export interface DisplaySettings {
  displayStyle: DisplayStyle
  projection: ProjectionMode
  modelColor: string
  edgeColor: string
  backgroundColor: string
  gridColor: string
  showGrid: boolean
  showAxes: boolean
  showViewCube: boolean
  brightness: number
  edgeOpacity: number
  modelOpacity: number
}

export const defaultDisplaySettings: DisplaySettings = {
  displayStyle: 'shaded-edges',
  projection: 'perspective',
  modelColor: '#91b9db',
  edgeColor: '#27445b',
  backgroundColor: '#10171f',
  gridColor: '#2d4355',
  showGrid: true,
  showAxes: true,
  showViewCube: true,
  brightness: 1,
  edgeOpacity: 0.95,
  modelOpacity: 1,
}

interface DisplayPanelProps {
  settings: DisplaySettings
  onChange: (settings: DisplaySettings) => void
  onResetView: () => void
  onFitView: () => void
}

export function DisplayPanel({
  settings,
  onChange,
  onResetView,
  onFitView,
}: DisplayPanelProps) {
  function updateSetting<Key extends keyof DisplaySettings>(
    key: Key,
    value: DisplaySettings[Key],
  ) {
    onChange({
      ...settings,
      [key]: value,
    })
  }

  return (
    <section className="display-panel">
      <div className="display-panel-heading">
        <div>
          <span className="panel-label">
            Display
          </span>

          <strong>
            Visual settings
          </strong>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            onChange(defaultDisplaySettings)
          }}
        >
          Reset
        </button>
      </div>

      <label className="display-field">
        <span>
          Display style
        </span>

        <select
          value={settings.displayStyle}
          onChange={(event) => {
            updateSetting(
              'displayStyle',
              event.target.value as DisplayStyle,
            )
          }}
        >
          <option value="shaded">
            Shaded
          </option>

          <option value="shaded-edges">
            Shaded with edges
          </option>

          <option value="wireframe">
            Wireframe
          </option>

          <option value="ghosted">
            Ghosted
          </option>
        </select>
      </label>

      <label className="display-field">
        <span>
          Projection
        </span>

        <select
          value={settings.projection}
          onChange={(event) => {
            updateSetting(
              'projection',
              event.target.value as ProjectionMode,
            )
          }}
        >
          <option value="perspective">
            Perspective
          </option>

          <option value="orthographic">
            Orthographic
          </option>
        </select>
      </label>

      <div className="display-color-grid">
        <label className="display-field">
          <span>
            Model
          </span>

          <input
            type="color"
            value={settings.modelColor}
            onChange={(event) => {
              updateSetting(
                'modelColor',
                event.target.value,
              )
            }}
          />
        </label>

        <label className="display-field">
          <span>
            Edges
          </span>

          <input
            type="color"
            value={settings.edgeColor}
            onChange={(event) => {
              updateSetting(
                'edgeColor',
                event.target.value,
              )
            }}
          />
        </label>

        <label className="display-field">
          <span>
            Background
          </span>

          <input
            type="color"
            value={settings.backgroundColor}
            onChange={(event) => {
              updateSetting(
                'backgroundColor',
                event.target.value,
              )
            }}
          />
        </label>

        <label className="display-field">
          <span>
            Grid
          </span>

          <input
            type="color"
            value={settings.gridColor}
            onChange={(event) => {
              updateSetting(
                'gridColor',
                event.target.value,
              )
            }}
          />
        </label>
      </div>

      <label className="display-field">
        <span>
          Brightness
        </span>

        <input
          type="range"
          min="0.3"
          max="2"
          step="0.05"
          value={settings.brightness}
          onChange={(event) => {
            updateSetting(
              'brightness',
              Number(event.target.value),
            )
          }}
        />
      </label>

      <label className="display-field">
        <span>
          Model opacity
        </span>

        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={settings.modelOpacity}
          onChange={(event) => {
            updateSetting(
              'modelOpacity',
              Number(event.target.value),
            )
          }}
        />
      </label>

      <label className="display-field">
        <span>
          Edge opacity
        </span>

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.edgeOpacity}
          onChange={(event) => {
            updateSetting(
              'edgeOpacity',
              Number(event.target.value),
            )
          }}
        />
      </label>

      <div className="display-checkboxes">
        <label>
          <input
            type="checkbox"
            checked={settings.showGrid}
            onChange={(event) => {
              updateSetting(
                'showGrid',
                event.target.checked,
              )
            }}
          />

          Show grid
        </label>

        <label>
          <input
            type="checkbox"
            checked={settings.showAxes}
            onChange={(event) => {
              updateSetting(
                'showAxes',
                event.target.checked,
              )
            }}
          />

          Show axes
        </label>

        <label>
          <input
            type="checkbox"
            checked={settings.showViewCube}
            onChange={(event) => {
              updateSetting(
                'showViewCube',
                event.target.checked,
              )
            }}
          />

          Show orientation widget
        </label>
      </div>

      <div className="display-view-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onFitView}
        >
          Fit model
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onResetView}
        >
          Isometric view
        </button>
      </div>
    </section>
  )
}