//Center the map to the region of interest using the region shapefile
Map.centerObject(AOI,13)
Map.setOptions('satellite')

/////////////////////////////////////////////////////////////
//2.1) Cloud Masking
////////////////////

//Landsat data includes a 'pixel_qa' band which can be used to create 
//     a function to mask clouds

function maskClouds(image) {
  
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
    var cloudShadowBitMask = ee.Number(2).pow(3).int();
    var cloudsBitMask = ee.Number(2).pow(5).int();  
    
    // Get the pixel QA band.
    var qa = image.select('pixel_qa');
    
    // Both flags should be set to zero, indicating clear conditions.
    var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0).and(qa.bitwiseAnd(cloudsBitMask).eq(0)); 
  
  // Return the masked image, scaled to [0, 1].
  return image.updateMask(mask).divide(10000).copyProperties(image, ["system:time_start"]);
}
 
//2.2) Adding Spectral Indices
///////////////////////////////

// This function maps spectral indices for Mangrove Mapping using Landsat 8 Imagery
var addIndicesL8 = function(img) {
  // NDVI
  var ndvi = img.normalizedDifference(['B5','B4']).rename('NDVI');
  // NDMI (Normalized Difference Mangrove Index - Shi et al 2016 - New spectral metrics for mangrove forest identification)
  var ndmi = img.normalizedDifference(['B7','B3']).rename('NDMI');
  // MNDWI (Modified Normalized Difference Water Index - Hanqiu Xu, 2006)
  var mndwi = img.normalizedDifference(['B3','B6']).rename('MNDWI');
  // SR (Simple Ratio)
  var sr = img.select('B5').divide(img.select('B4')).rename('SR');
  // Band Ratio 54
  var ratio54 = img.select('B6').divide(img.select('B5')).rename('R54');
  // Band Ratio 35
  var ratio35 = img.select('B4').divide(img.select('B6')).rename('R35');
  // GCVI
  var gcvi = img.expression('(NIR/GREEN)-1',{
    'NIR':img.select('B5'),
    'GREEN':img.select('B3')
  }).rename('GCVI');
  return img
    .addBands(ndvi)
    .addBands(ndmi)
    .addBands(mndwi)
    .addBands(sr)
    .addBands(ratio54)
    .addBands(ratio35)
    .addBands(gcvi);
};

//2.3) Filter Landsat data by Date and Region
/////////////////////////////////////////////

// Temporal Parameters

// Select the desired central year here
var year = 2019; 

// Start date will be set one year before the central year
var startDate = (year-1)+'-01-01'; 

// End date will be set to one year later than the central year.
var endDate = (year+1)+'-12-31'; 

//2.4) Apply filters and masks to Landsat 8 imagery
///////////////////////////////////////////////////

var l8 = L8.filterDate(startDate,endDate)
// Mask for clouds and cloud shadows
    .map(maskClouds)
//Add the indices
    .map(addIndicesL8)

//2.5) Composite the Landsat image collection
//You can composite on a per pixel, per-band basis using .median()
// OR with quality bands like .qualityMosaic('NDVI')

var composite = l8
              // Uses the median reducer
              .median() 
              // Clips the composite to our area of interest
              .clip(AOI); 
//2.6) Mask to areas of low elevation and high NDVI and MNDWI
/////////////////////////////////////////////////////////////

// Clip SRTM data to region
var srtmClip = SRTM.clip(AOI);

//Mask to elevations less than 65 meters
var elevationMask = srtmClip.lt(12);

//Used the NDVI and MNDWI bands to create masks
var NDVIMask = composite.select('NDVI').gt(0.5);
var MNDWIMask = composite.select('MNDWI').gt(-0.50);

//Apply the masks
var compositeNew = composite
                        .updateMask(NDVIMask)
                        .updateMask(MNDWIMask)
                        .updateMask(elevationMask)
                        
//2.7) Display results
//Select bands and parameters for visualization
var visPar = {bands:['B5','B6','B7'], min: 0, max: 0.4, gamma: 1}; 

//Add layer to map
Map.addLayer (SRTM,{min:0,max:3000},'SRTM',false)
var ndvi = composite.normalizedDifference(['B5','B4']).rename('NDVI_2019');
Map.addLayer (ndvi,{min:0,max:1},'NDVI_2019',false)
var mndwi = composite.normalizedDifference(['B3','B6']).rename('MNDWI_2019');
Map.addLayer (mndwi,{min:-1,max:1},'MNDWI_2019',false)
Map.addLayer(compositeNew.clip(AOI), visPar, 'Landsat Composite 2019',false)

// Extract MNDWI Transect values
var latLonImg = ee.Image.pixelLonLat();
var subset = composite.select ('MNDWI').addBands (latLonImg);
print (subset)

// Reduce elevation and coordinate bands by transect line; get a dictionary with
// band names as keys, pixel values as lists.
var mndwiTransect = subset.reduceRegion({
  reducer: ee.Reducer.toList(),
  geometry: Transect,
  scale: 0.1,
});

// Get longitude and elevation value lists from the reduction dictionary.
var lon = ee.List(mndwiTransect.get('longitude'));
var val = ee.List(mndwiTransect.get('MNDWI'));

// Sort the longitude and elevation values by ascending longitude.
var lonSort = lon.sort(lon);
var valSort = val.sort(lon);

// Define the chart and print it to the console.
var chart = ui.Chart.array.values({array: valSort, axis: 0, xLabels: lonSort})
                .setOptions({
                  title: 'Transect MNDWI Values ',
                  hAxis: {
                    title: 'Path',
                    viewWindow: {min: 115.18059, max: 115.18818},
                    titleTextStyle: {italic: false, bold: true}
                  },
                  vAxis: {
                    title: 'MNDWI',
                    titleTextStyle: {italic: false, bold: true}
                  },
                  colors: ['1d6b99'],
                  lineSize: 2,
                  pointSize: 0,
                  legend: {position: 'none'}
                });
print(chart);

// Extract NDVI Transect values
var latLonImg = ee.Image.pixelLonLat();
var subset = composite.select ('NDVI').addBands (latLonImg);
print (subset)

// Reduce elevation and coordinate bands by transect line; get a dictionary with
// band names as keys, pixel values as lists.
var mndwiTransect = subset.reduceRegion({
  reducer: ee.Reducer.toList(),
  geometry: Transect,
  scale: 0.1,
});

// Get longitude and elevation value lists from the reduction dictionary.
var lon = ee.List(mndwiTransect.get('longitude'));
var val = ee.List(mndwiTransect.get('NDVI'));

// Sort the longitude and elevation values by ascending longitude.
var lonSort = lon.sort(lon);
var valSort = val.sort(lon);

// Define the chart and print it to the console.
var chart = ui.Chart.array.values({array: valSort, axis: 0, xLabels: lonSort})
                .setOptions({
                  title: 'Transect NDVI Values ',
                  hAxis: {
                    title: 'Path',
                    viewWindow: {min: 115.18059, max: 115.18818},
                    titleTextStyle: {italic: false, bold: true}
                  },
                  vAxis: {
                    title: 'NDVI',
                    titleTextStyle: {italic: false, bold: true}
                  },
                  colors: ['1d6b99'],
                  lineSize: 2,
                  pointSize: 0,
                  legend: {position: 'none'}
                });
print(chart);
