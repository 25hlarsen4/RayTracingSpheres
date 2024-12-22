# About the project
Rasterization mode: In this mode, all spheres are approximated as triangular meshes. It lacks shadows and proper reflections of the spheres on the other spheres.
Ray Tracing mode: In this mode, to allow for shadows and proper reflections, the entire image is rendered using ray tracing. 
Rasterization + Ray Tracing mode: In this mode, the rendering is handled using rasterization. Ray tracing is used for computing reflections and shadows only.
