var raytraceFS = `
struct Ray {
	vec3 pos;
	vec3 dir;
};

struct Material {
	vec3  k_d;	// diffuse coefficient
	vec3  k_s;	// specular coefficient
	float n;	// specular exponent
};

struct Sphere {
	vec3     center;
	float    radius;
	Material mtl;
};

struct Light {
	vec3 position;
	vec3 intensity;
};

struct HitInfo {
	float    t;
	vec3     position;
	vec3     normal;
	Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;
uniform int bounceLimit;

bool IntersectRay( inout HitInfo hit, Ray ray );

// Shades the given point and returns the computed color. note that view is already normalized
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
	vec3 color = vec3(0,0,0);

	// calculate shading necessities
	vec3 norm = normalize(normal);
	vec3 viewDir = normalize(view);
 
	for ( int i=0; i<NUM_LIGHTS; ++i ) {
		vec3 lightDir = normalize(lights[i].position - position);
	
		vec3 halfV = vec3(lightDir.x + viewDir.x, lightDir.y + viewDir.y, lightDir.z + viewDir.z);
		vec3 halfVect = normalize(halfV);
	
		float geoTerm = dot(norm, lightDir);
		geoTerm = max(float(0), geoTerm);
	
		float cosPhi = dot(norm, halfVect);
		cosPhi = max(float(0), cosPhi);
	
		vec3 diffuseTerm = geoTerm * mtl.k_d;
		vec3 specularTerm = mtl.k_s * pow(cosPhi, mtl.n);


 
		// Now check for shadows
		Ray shadowRay;
		shadowRay.pos = position;
		shadowRay.dir = lights[i].position - position;
		HitInfo hit;
  
		if ( IntersectRay( hit, shadowRay ) ) {
			// this updates hit with the closest hit info, so check if it's closer that the light source
			// need to get t val corresponding to light position  x = p + dt where x is the lightpos and p is the start of the shadow ray so t = (x - p) / d
			float lightT = (lights[i].position.x - shadowRay.pos.x) / shadowRay.dir.x;
			float bias = 0.0000001;
		
			if (hit.t > bias && hit.t < lightT) {
				// means the point is in shadow, so don't add any color
			}
			else {
				// otherwise not in shadow so shade as normal
				color += lights[i].intensity * (diffuseTerm + specularTerm);
			}
		}

		else {
			// If not shadowed, perform shading using the Blinn model
			// remember color is additive
			color += lights[i].intensity * (diffuseTerm + specularTerm);
		}
	}
	return color;
}

// Intersects the given ray with all spheres in the scene
// and updates the given HitInfo using the information of the sphere
// that first intersects with the ray.
// Returns true if an intersection is found.
bool IntersectRay( inout HitInfo hit, Ray ray )
{
	// start with huge t val because we want to update it with smaller ones
	// (the smallest t val will correspond to the closest hit)
	hit.t = 1e30;
	bool foundHit = false;
 
	for ( int i=0; i<NUM_SPHERES; ++i ) {
		// Test for ray-sphere intersection
		// If intersection is found, update the given HitInfo

		// get implicit representation for current sphere:   (d.d)t^2 + 2d.(p-c)t + (p-c).(p-c) - r^2 = 0
		Sphere sphere = spheres[i];
		float a = dot(ray.dir, ray.dir);
		float b = dot(float(2) * ray.dir, ray.pos - sphere.center);
		float c = dot(ray.pos - sphere.center, ray.pos - sphere.center);
		c = c - (sphere.radius * sphere.radius);

		// solve for t = (-b +- sqrt(b^2 - 4ac)) / 2a
		// first check if delta < 0 ie no sols
		float delta = (b * b) - (float(4) * a * c);

		if (delta >= float(0)) {
			// use the -sqrt to get closest hit
			float t = ( (float(-1)*b) - sqrt(delta) ) / (float(2)*a);

			if (t < hit.t && t > float(0)) {
				foundHit = true;
				hit.t = t;
				// x = p + td
				hit.position = ray.pos + (t * ray.dir);
				// normal = x - c
				hit.normal = normalize(hit.position - sphere.center);
				hit.mtl = sphere.mtl;
			}
		}
		
	}
	return foundHit;
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
	HitInfo hit;
	if ( IntersectRay( hit, ray ) ) {
		// viewing direction points toward camera
		vec3 view = normalize( -ray.dir );
		vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );

		vec3 norm = hit.normal;
		vec3 poss = hit.position;
		
		// Compute reflections
		vec3 k_s = hit.mtl.k_s;
		for ( int bounce=0; bounce<MAX_BOUNCES; ++bounce ) {
			if ( bounce >= bounceLimit ) break;
			if ( hit.mtl.k_s.r + hit.mtl.k_s.g + hit.mtl.k_s.b <= 0.0 ) break;
			
			Ray r;	// this is the reflection ray
			HitInfo h;	// reflection hit info
			
			// Initialize the reflection ray:   r = 2(v.n)n - v
			r.pos = poss;
			r.dir = (float(2) * (dot(view, norm)) * norm) - view;
			
			if ( IntersectRay( h, r ) ) {
				// Hit found, so shade the hit point. The view direction is now the previous perfect reflection direction negated
				clr += Shade( h.mtl, h.position, h.normal, -r.dir ) * k_s;
 
				// Update the loop variables for tracing the next reflection ray
				view = -r.dir;
				norm = h.normal;
				poss = h.position;
				k_s *= h.mtl.k_s;
			} else {
				// The refleciton ray did not intersect with anything,
				// so we are using the environment color
				clr += k_s * textureCube( envMap, r.dir.xzy ).rgb;
				break;	// no more reflections
			}
		}
		return vec4( clr, 1 );	// return the accumulated color, including the reflections
	} else {
		return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 0 );	// return the environment color
	}
}
`;