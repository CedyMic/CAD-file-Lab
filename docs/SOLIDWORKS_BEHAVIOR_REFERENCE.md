# SOLIDWORKS behavior acceptance reference

This document records the official SOLIDWORKS behaviors CAD File Lab must emulate where browser constraints allow.

## Window structure

- The CommandManager is contextual and changes tools by tabs such as Sketch and Features. It exists to save graphics-area space.
- The left Manager Pane switches among FeatureManager and PropertyManager. Active commands show their properties there without covering the graphics area.
- FeatureManager lists features in rebuild order.

Official references:
- https://help.solidworks.com/2025/English/SolidWorks/sldworks/c_commandmanager.htm
- https://help.solidworks.com/2025/English/SolidWorks/sldworks/c_management_panel.htm

## Sketch dimensions and relations

- Smart Dimension derives dimension type from selected entities and placement.
- A line yields length; two lines can yield angle or distance; an arc yields radius; a circle yields diameter; two points yield distance/orientation.
- Dimensions have a placement preview and can be dragged or deleted.
- Automatic relations use inferencing, pointer feedback, snaps, and Quick Snaps.
- Relations can also be added to selected entities and displayed/deleted later.

Official references:
- https://help.solidworks.com/2026/english/SolidWorks/sldworks/t_Dimensioning_a_2D_Sketch.htm
- https://help.solidworks.com/2025/english/SolidWorks/sldworks/c_Sketch_Relations_Overview.htm

## Reference planes

- Plane PropertyManager accepts up to three references.
- Available relations depend on selected geometry: Coincident, Parallel, Perpendicular, Project, Parallel to Screen, Tangent, At Angle, Offset Distance, Flip Normal, and Mid Plane.
- The plane must report Fully Defined before acceptance and provide a live preview.

Official reference:
- https://help.solidworks.com/2025/English/SolidWorks/sldworks/HIDD_DVE_CREATE_PLANE.htm

## Measure

- Measure supports selected points, lines/edges, arcs/circles, faces, surfaces, planes, bodies, and coordinate systems.
- It lists selections and updates results continuously.
- Results include minimum distance, angle, radius/diameter, XYZ deltas, projection/normal, area, and volume when applicable.
- Arc/circle distance modes include center-to-center, minimum, maximum, and custom.
- Click a selected entity again to remove it; click blank graphics space to clear all.
- Results appear in a Measure dialog/PropertyManager while callouts appear by geometry.

Official references:
- https://help.solidworks.com/2025/English/SolidWorks/sldworks/t_using_the_measure_tool.htm
- https://help.solidworks.com/2025/english/solidworks/sldworks/HIDD_MEASURE.htm
