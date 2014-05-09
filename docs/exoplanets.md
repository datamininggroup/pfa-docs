---
layout: page
type: tutorial
title: Exoplanets example
order: 30
---

## Explanation

This applet is intended as a sandbox for testing PFA functions on a real dataset.  The data are 1783 extrasolar planets, [downloaded](http://exoplanet.eu/catalog/votable/) in April 2014 from [exoplanet.eu](http://exoplanet.eu/){:target="_blank"}.

The dataset has a two-level taxonomy: it is a collection of stars and each star has one or more planets.  All of the numerical data for stars and planets are nullable (missing data is common in planet-hunting).  A few fields are strings (names and spectral type), one is an enumerated category (detection type), and one is an array of strings (molecules discovered in the planet's atmosphere).

Rather than dump thousands of JSON-formatted outputs in your browser, the output is drawn as a scatter plot using [d3](http://d3js.org/){:target="_blank"}.  Don't read too much into the distribution; extrasolar planets have a strong detection bias.

The dataset is hosted on [Google App Engine](https://developers.google.com/appengine/){:target="_blank"} (the same site that executes the PFA) as a binary Avro file.  If Google App Engine has to start a new instance, the calculation will take several seconds.  Otherwise, most runs will be less than a second.

## Executable

The default executable is a fold-type scoring engine that only produces output for planets when `planet.radius`, `planet.mass`, `star.age`, `star.temp`, and `star.dist` are all non-null.  This is not required for the example to work; any `action` will do, as long as the `input` and `output` types are unchanged.  (The `input` must match the exoplanets dataset and the `output` must be correctly interpreted by your browser.)

<script src="/public/js/d3.min.js"></script>
<style>
.axis path, .axis line {
    fill: none;
    stroke: black;
    stroke-width: 2px;
    shape-rendering: crispEdges;
}
</style>

<div class="engine big-engine" dataset="exoplanets">
  <textarea class="document"># Since this scoring engine is used in a data pipeline, its input is fixed.  Changing it would cause an error.
input:
  type: record
  name: Star
  fields:
    # The host star has the following fields.  Note that [double, "null"] means double or null.
    - {name: name,   type: string,           doc: "Name of the host star"}
    - {name: ra,     type: [double, "null"], doc: "Right ascension of the star in our sky (degrees, J2000)"}
    - {name: dec,    type: [double, "null"], doc: "Declination of the star in our sky (degrees, J2000)"}
    - {name: mag,    type: [double, "null"], doc: "Magnitude (dimness) of the star in our sky (unitless)"}
    - {name: dist,   type: [double, "null"], doc: "Distance of the star from Earth (parsecs)"}
    - {name: mass,   type: [double, "null"], doc: "Mass of the star (multiples of our Sun's mass)"}
    - {name: radius, type: [double, "null"], doc: "Radius of the star (multiples of our Sun's radius)"}
    - {name: age,    type: [double, "null"], doc: "Age of the star (billions of years)"}
    - {name: temp,   type: [double, "null"], doc: "Effective temperature of the star (degrees Kelvin)"}
    - {name: type,   type: [string, "null"], doc: "Spectral type of the star"}
    - name: planets
      type:
        # planets is an array of Planet records.  This taxonomy cannot be represented in a flat n-tuple.
        type: array
        items:
          type: record
          name: Planet
          fields:
            # A planet has the following fields.  Note the use of an enumeration type and an array of strings.
            - {name: name,          type: string,            doc: "Name of the planet"}
            - name: detection
              type:
                type: enum
                name: DetectionType
                symbols: [astrometry, imaging, microlensing, pulsar, radial_velocity, transit, ttv, OTHER]
                doc: "Technique used to make discovery"
            - {name: discovered,    type: string,            doc: "Year of discovery"}
            - {name: updated,       type: string,            doc: "Date of last update"}
            - {name: mass,          type: [double, "null"],  doc: "Mass of the planet (multiples of Jupiter's mass)"}
            - {name: radius,        type: [double, "null"],  doc: "Radius of the planet (multiples of Jupiter's radius)"}
            - {name: period,        type: [double, "null"],  doc: "Duration of planet's year (Earth days)"}
            - {name: max_distance,  type: [double, "null"],  doc: "Maximum distance of planet from star (semi-major axis in AU)"}
            - {name: eccentricity,  type: [double, "null"],  doc: "Ellipticalness of orbit (0 == circle, 1 == escapes star)"}
            - {name: temperature,   type: [double, "null"],  doc: "Measured or calculated temperature of the planet (degrees Kelvin)"}
            - {name: temp_measured, type: [boolean, "null"], doc: "True iff the temperature was actually measured"}
            - name: molecules
              type: {type: array, items: string}
              doc: Molecules identified in the planet's atmosphere

# Since this scoring engine is used in a data pipeline, its output is fixed.  Changing it would break the scatter plot.
output:
  type: record
  name: Output
  doc: "Interpreted by as positions, radii and colors of dots in the scatter plot."
  fields:
    - {name: x,       type: double,  doc: "Horizontal coordinate"}
    - {name: y,       type: double,  doc: "Vertical coordinate"}
    - {name: radius,  type: double,  doc: "Size of dot in screen pixels"}
    - {name: color,   type: double,  doc: "Rainbow colors from 0 to 1"}
    - {name: opacity, type: double,  doc: "Opacity of color from 0 to 1"}

method: emit

# This section describes what the scoring engine should do with the input.
action:
  - let: {star: input}
  - foreach: planet
    in: star.planets
    do:
      - ifnotnull: {radius: planet.radius, mass: planet.mass, age: star.age, temp: star.temp, dist: star.dist}
        then:
          emit:
            new: {x: radius, y: mass, radius: age, color: {/: [temp, 1000]}, opacity: {/: [dist, 1000]}}
            type: Output
</textarea>
  <div class="output"></div><div class="output-plot" style="position: relative; height: 400px;"><div class="theplot"></div><pre class="output-error"></pre></div>
</div>

