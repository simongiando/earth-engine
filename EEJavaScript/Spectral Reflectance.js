var AOI = /* color: #d63000 */ee.Geometry.Point([100.61368808625811, -0.4703730740873653]),
    Water = /* color: #1c71ff */ee.Feature(
        ee.Geometry.Polygon(
            [[[100.19514329316509, -0.288615724226806],
              [100.1793504464854, -0.3085281734869936],
              [100.21093613984478, -0.29754199903927653],
              [100.20750291230571, -0.28312262853884895]]]),
        {
          "label": "Water",
          "system:index": "0"
        }),
    Vegetation = /* color: #23f638 */ee.Feature(
        ee.Geometry.Polygon(
            [[[100.28069643957316, -0.31470059053641486],
              [100.27520327551066, -0.3193353767669142],
              [100.28628405315348, -0.31658309123027284],
              [100.28405245525309, -0.31297825671895496],
              [100.2818208573527, -0.312119962604544]]]),
        {
          "label": "Vegetation",
          "system:index": "0"
        }),
    Builtup = /* color: #ffc82d */ee.Feature(
        ee.Geometry.Polygon(
            [[[100.3872412017723, -0.310798935012398],
              [100.3856747917076, -0.3104985320181531],
              [100.38569624937972, -0.31150702775069394],
              [100.38518126524886, -0.31223657779493724],
              [100.38550313033065, -0.31277301161871024],
              [100.38754160918197, -0.3111422527096289],
              [100.38754160918197, -0.31069164822971784]]]),
        {
          "label": "Builtup",
          "system:index": "0"
        });

// Image filtering
var image = ee.Image(ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
              .filterBounds(AOI)
              .filterDate('2019-06-01', '2019-07-31')
              .sort('CLOUD_COVER')
              .first());
    
    
// Add Layer
Map.addLayer(image, {bands: ['B5', 'B3', 'B2'],min:0, max: 3000}, 'False Color');

// Bands selection
var subset = image.select('B[1-7]')
var sample = ee.FeatureCollection([Water,Vegetation,Builtup]);

// Visual parameters
var plotOptions = {
                    title: 'Spectral Reflectance Landsat-8  SR',
                    hAxis: {title: 'Wavelength (nm)'},
                    vAxis: {title: 'Reflectance'},
                    lineWidth: 1,
                    pointSize: 4,
                    series: {
                                0: {color: '#1c71ff'}, // Air
                                1: {color: '#23f638'}, // Vegetasi
                                2: {color: '#ffc82d'}, // Lahan Terbangun
                            }};


// Wavelength
var Wavelength = [443, 482, 562, 655, 865, 1609, 2201];

// Graphic
var graphic = ui.Chart.image.regions(subset, sample, ee.Reducer.mean(), 10, 'label', Wavelength)
  .setChartType('ScatterChart') 
  .setOptions(plotOptions); 

print(graphic);
