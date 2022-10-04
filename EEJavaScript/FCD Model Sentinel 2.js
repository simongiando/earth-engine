var roi = ee.FeatureCollection("users/simongiandos/Mangrove_Project/RE_IDN_KHD_04_BUMWI_UTM53S"),
    RF2020 = ee.Image("users/simongiandos/RandomForestClassfication_2020"),
    fdiParams = {"opacity":1,"bands":["FDI"],"min":-0.1265999972820282,"max":0.25839999318122864,"palette":["ea2c62","ff9a8c","fad5ad","adb36e","5a5f24"]},
    aviParams = {"opacity":1,"bands":["AVI"],"max":13.035513629308838,"palette":["ea2c62","ff9a8c","fad5ad","adb36e","015f04"]},
    bsiParams = {"opacity":1,"bands":["BSI"],"min":39.73920440673828,"max":106.44802856445312,"palette":["000000","522c1d","cc0824","de4e24","dea200"]},
    ssiParams = {"opacity":1,"bands":["SSI"],"min":51.30724879170179,"max":98.36076879728056,"palette":["f7e7ca","ba661d","974617","6f2f14","371a12"]},
    harvest = ee.FeatureCollection("users/gee005systemiq/Harvest_area_2017_12022022");

Map.centerObject (roi,10)

//** Define timeframe
var start = '2020-01-01'
var end = '2020-06-30'

//** Image Normalization
function normalize(image){
  var bandNames = image.bandNames();
  // Compute min and max of the image
  var minDict = image.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: roi,
    scale: 10,
    maxPixels: 1e12,
    bestEffort: true,
    tileScale: 16
  });
  var maxDict = image.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: roi,
    scale:10,
    maxPixels: 1e12,
    bestEffort: true,
    tileScale: 16
  });
  // var maxs = ee.Dictionary(maxDict).toImage()
  // var mins = ee.Dictionary(minDict).toImage()
  var mins = ee.Image.constant(minDict.values(bandNames));
  var maxs = ee.Image.constant(maxDict.values(bandNames));

  var normalized = image.subtract(mins).divide(maxs.subtract(mins))
  return normalized
}

//** Cloud masker
// Function to mask clouds using the Sentinel-2 QA band.
function maskS2clouds(image) {
  var qa = image.select('QA60')

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
             qa.bitwiseAnd(cirrusBitMask).eq(0))

  // Return the masked and scaled data, without the QA bands.
  return image.updateMask(mask).divide(10000)
      .select("B.*")
      .copyProperties(image, ["system:time_start"])
}

//** Vegetation Index 
var vegInd = function (img) {
  //** ---NDVI---
  var ndvi = img.normalizedDifference(['B8','B4']).rename('NDVI');
  //** ---FDI (Forest Discrimination Index)---
  var fdi = img.expression (
    'NIR-(RED+GREEN)',{
    'NIR'   : img.select('B8'),
    'RED'   : img.select('B4'),
    'GREEN' : img.select('B3')
    }).rename('FDI')
  return img.addBands (fdi)
            .addBands (ndvi)
}

//** Dataset
var collection = ee.ImageCollection('COPERNICUS/S2_SR')
                    .filterDate(start, end)
                    .map(maskS2clouds)
                    .map(vegInd)
                    .median()
                    .clip(roi)
print ('List of Bands', collection)

// Apply the normalization
var normalized = normalize (collection)

// Verify Normalization
var beforeDict = collection.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: roi,
  scale: 10,
  maxPixels: 1e12,
  bestEffort: true,
  tileScale: 16
});

var afterDict = normalized.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: roi,
  scale: 10,
  maxPixels: 1e12,
  bestEffort: true,
  tileScale: 16
});

print('Original Image Min/Max', beforeDict)
print('Normalized Image Min/Max', afterDict)

// ** Define the input data
var fdi = collection.select('FDI')
                    .updateMask (RF2020.lte(2))
                    
var land = normalized.updateMask (RF2020.lte(2))
//----------------------------------------------------------------------------------------------------- Part 1
//** Forest Canopy Density Model
//** 3 Inputs (AVI, BSI & SI)
//** - Advanced Vegetation Index (AVI)
var avi = land.expression(
    '(NIR+1)*(4096-RED)*(NIR-RED)', {
      'NIR': land.select('B8'),
      'RED': land.select('B4'),
  })
    avi = avi.pow(0.333).rename('AVI')

//** - Bare Soil Index (BSI)
var bsi = land.expression(
    '((SWIR1 + RED) - (NIR + BLUE))/((SWIR1 + RED) + (NIR + BLUE))', {
      'NIR': land.select('B8'),
      'RED': land.select('B4'),
      'BLUE': land.select('B2'),
      'SWIR1': land.select('B11'),
})
var bsiscale = bsi.multiply(100).add(100).rename('BSI');

//** - Shadow Index (SI)
var si = land.expression(
    '((4096 - GREEN) * (4096 - BLUE) *(4096 - RED))', {
      'RED': land.select('B4'),
      'GREEN': land.select('B3'),
      'BLUE': land.select('B2'),
});
    si = si.pow(0.333)
    
var minsi = si.reduceRegion({
  reducer:ee.Reducer.min(),
  geometry:roi,
  scale:10,
  bestEffort:true,
  tileScale:16})
var minsi = ee.Dictionary(minsi).toImage()

var maxsi = si.reduceRegion({
  reducer:ee.Reducer.max(),
  geometry:roi,
  scale:10,
  bestEffort:true,
  tileScale:16})
var maxsi = ee.Dictionary(maxsi).toImage()

//** Rescale Shadow Index
var ssiscale = si.subtract(minsi).divide(maxsi.subtract(minsi)).multiply(100).rename('SSI')

//** Perform Principle Compononent Analysis
//** Stack AVI and BSI
var avi_bsi = avi.addBands(bsiscale)
// print ('Stacked AVI and BSI 2',avi_bsi_land)

//remove zeros
var good = avi_bsi.gte(0).or(avi_bsi.lte(0))
var avi_bsi = avi_bsi.updateMask(good)

// Mean center the data to enable a faster covariance reducer
// and an SD stretch of the principal components.
var meanDict = avi_bsi.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: roi,
    scale: 10,
    maxPixels: 1e9,
    tileScale: 12,
    bestEffort: true
});

// print("1", meanDict)
var means = ee.Image.constant(meanDict.values(bandNames));
// print("2", means)
var centered = avi_bsi.subtract(means);

// Band names for PC bands
function getNewBandNames(prefix) {
  var seq = ee.List.sequence(1, bandNames.length());
  return seq.map(function(b) {
    return ee.String(prefix).cat(ee.Number(b).int());
  });
}

//perform principal components with centered covariance
// Collapse the bands of the image into a 1D array per pixel.
var image = centered
var scale = 10
var bandNames = avi_bsi.bandNames()

//var region = AOI
var arrays = centered.toArray();

// Compute the covariance of the bands within the region.
var covar = arrays.reduceRegion({
    reducer: ee.Reducer.centeredCovariance(),
    geometry: roi,
    scale: scale,
    maxPixels: 1e9,
    tileScale: 16,
    bestEffort: true
  });
// print("covariates", covar)

// Get the 'array' covariance result and cast to an array.
// This represents the band-to-band covariance within the region.
var covarArray = ee.Array(covar.get('array'));
// Perform an eigen analysis and slice apart the values and vectors.
var eigens = covarArray.eigen(); 
// This is a P-length vector of Eigenvalues.
var eigenValues = eigens.slice(1, 0, 1);
// print ('Eigen Values 2',eigenValues)
// This is a PxP matrix with eigenvectors in rows.
var eigenVectors = eigens.slice(1, 1);
// print ('Eigen Vectors 2', eigenVectors)
// Convert the array image to 2D arrays for matrix computations.
var arrayImage = arrays.toArray(1);
// Left multiply the image array by the matrix of eigenvectors.
var principalComponents = ee.Image(eigenVectors).matrixMultiply(arrayImage);
// Turn the square roots of the Eigenvalues into a P-band image.
var sdImage = ee.Image(eigenValues.sqrt()) 
              .arrayProject([0]).arrayFlatten([getNewBandNames('sd')]);
// Turn the PCs into a P-band image, normalized by SD.
var vdpca = principalComponents
  // Throw out an an unneeded dimension, [[]] -> [].
  .arrayProject([0])
  // Make the one band array image a multi-band image, [] -> image.
  .arrayFlatten([getNewBandNames('pc')])
  // Normalize the PCs by their SDs.
  .divide(sdImage);
// Compute Percentage Variance of each component
var eigenValuesList = eigenValues.toList().flatten()
var total = eigenValuesList.reduce(ee.Reducer.sum())
var percentageVariance = eigenValuesList.map(function(item) {
    return (ee.Number(item).divide(total)).multiply(100).format('%.2f')
    })   
print ('')  
print ('Eigen Vectors-Values and PC Bands', eigenValues, eigenVectors, percentageVariance, vdpca)

//** Get Vegetation Density (PC1)
var vd = vdpca.select('pc1')

//rescale 0 to 100
var minvd = vd.reduceRegion({
  reducer:ee.Reducer.min(),
  geometry:roi,
  scale:10,
  bestEffort:true,
  tileScale:16})
var minvd = ee.Dictionary(minvd).toImage();

var maxvd = vd.reduceRegion({
  reducer:ee.Reducer.max(),
  geometry:roi,
  scale:10,
  bestEffort:true,
  tileScale:16})
var maxvd = ee.Dictionary(maxvd).toImage();

var normvd = vd.subtract(minvd).divide(maxvd.subtract(minvd))

//with zeros back in
var vdscale = normvd.multiply(100).unmask()

//** Finally calculate FCD = (VD*SSI + 1)^1/2 -1
var fcdm = vdscale.multiply(ssiscale).add(ee.Number(1))
var fcd = fcdm.pow(0.5)
var fcd = fcd.subtract(ee.Number(1)).abs().rename('FCD 2')

//** Reclassify Forest and Non-Forest Based on FREL 30%
// var forest = fcd.gte(30)

//** Harvest area no brush
var empty = ee.Image().byte()
var outline = empty.paint({
  featureCollection: harvest,
  color: 1,
  width: 0.5
})

//** Visualization
Map.addLayer (ssiscale, ssiParams, 'SSI')
Map.addLayer (bsiscale,bsiParams,'BSI')
Map.addLayer (avi, aviParams,'AVI')
Map.addLayer (fdi,fdiParams,'FDI')
Map.addLayer (land,{bands:['B8', 'B11', 'B12'], min:0, max: [0.5, 0.3, 0.3], gamma: 1.2},'RGB 8/11/12')
Map.addLayer (outline,{palette:'yellow'},'Harvested Area')
Map.addLayer(fcd,{min:0,max:100,palette:["ff3508","d8ff04","06700e"]}, 'FCD')


// ** Statistic Calculation
// ** Calculate correlation and plotting
var correlation = avi_bsi.select(['AVI', 'BSI']).reduceRegion({
                  reducer: ee.Reducer.pearsonsCorrelation(), 
                  geometry: roi, 
                  scale: 1000,
                  tileScale: 16
        }).get('correlation')
var regression = avi_bsi.reduceRegion({
                  reducer: ee.Reducer.linearRegression(1,1), 
                  geometry: roi, 
                  scale: 1000,
                  tileScale: 16
        }).get('coefficients')
        
print('AVI vs BSI Correlation and Regression', correlation)

var pccorrelation = vdpca.select(['pc1', 'pc2']).reduceRegion({
                  reducer: ee.Reducer.pearsonsCorrelation(), 
                  geometry: roi, 
                  scale: 1000,
                  tileScale: 16
        }).get('correlation')
var pcregression = vdpca.reduceRegion({
                  reducer: ee.Reducer.linearRegression(1,1), 
                  geometry: roi, 
                  scale: 1000,
                  tileScale: 16
        }).get('coefficients')
        
print('PC bands Correlation and Regression',pccorrelation)


//** AVI vs BSI
var pixelVals = avi_bsi.reduceRegion ({
                        reducer: ee.Reducer.toList(), 
                        geometry: roi, 
                        scale: 1000,
                        maxPixels: 1e12,
                        bestEffort: true,
                        tileScale:16
                  });

var x = ee.List(pixelVals.get('AVI'));
// print ('AVI array dimension',x.size())
var y = ee.List(pixelVals.get('BSI')).slice(0,812);
// print ('BSI array dimension',y.size())

// Define the chart and print it to the console.
var chart = ui.Chart.array.values({array: y, axis: 0, xLabels: x})
              .setOptions({
        title: 'AVI & BSI',
        colors: ['#3c3f18'],
        hAxis: {'title': 'AVI'},
        vAxis: {'title': 'BSI'},
        pointSize: 3,
          trendlines: {
            0: {
              type: 'linear',
              color: 'red',
              lineWidth: 3,
              opacity: 0.7,
            }}
});
print(chart);

//** PC1 vs PC2 
var pixelVals = vdpca.reduceRegion ({
                        reducer: ee.Reducer.toList(), 
                        geometry: roi, 
                        scale: 1000,
                        maxPixels: 1e12,
                        bestEffort: true,
                        tileScale:16
                  });

var x = ee.List(pixelVals.get('pc1'));
var y = ee.List(pixelVals.get('pc2'));

// Define the chart and print it to the console.
var chart = ui.Chart.array.values({array: y, axis: 0, xLabels: x})
              .setOptions({
        title: 'PC1 vs PC2',
        colors:['#3c3f18'],
        hAxis: {'title': 'PC1'},
        vAxis: {'title': 'PC2'},
        pointSize: 3
});

print(chart);

// ** Graph
// ** Histogram each input
print (ui.Chart.image.histogram({
          image: fdi, 
          region:roi, 
          scale:10, 
          maxPixels:1e12}))
  
print (ui.Chart.image.histogram({
          image: avi, 
          region:roi, 
          scale:10, 
          maxPixels:1e12}))
          
print (ui.Chart.image.histogram({
          image: bsiscale, 
          region:roi, 
          scale:10, 
          maxPixels:1e12}))
          
print (ui.Chart.image.histogram({
          image: ssiscale, 
          region:roi, 
          scale:10, 
          maxPixels:1e12}))

print (ui.Chart.image.histogram({
          image: fcd, 
          region:roi, 
          scale:10, 
          maxPixels:1e12}))

print (ui.Chart.image.histogram({
          image: avi_bsi, 
          region:roi, 
          scale:10, 
          maxPixels:1e12}))
          
print (ui.Chart.image.histogram ({
          image:vdpca,
          region:roi,
          scale:10,
          maxPixels:1e12
}))

//--------------------------------- FCD LEGEND
//** Adding a legend for FCD
var nSteps = 10
var palette = ["ff3508","d8ff04","06700e"]
var params = {min:0,max:100,palette:palette}

// Creates a color bar thumbnail image for use in legend from the given color palette
function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, 100, 0.1],
    dimensions: '80x8',
    format: 'png',
    min: 0,
    max: 100,
    palette: palette,
  };
}

// Create the colour bar for the legend
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0).int(),
  params: makeColorBarParams(params.palette),
  style: {stretch: 'horizontal', margin: '0px 6px', maxHeight: '20px'},
});

// Create a panel with three numbers for the legend
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(params.min, {margin: '4px 8px'}),
    ui.Label(
        ((params.max-params.min) / 2+params.min),
        {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
    ui.Label(params.max, {margin: '4px 8px'})
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

// Legend title
var legendTitle = ui.Label({
  value: 'Forest Canopy Density (%)',
  style: {fontWeight: 'bold'}
});

// Add the legendPanel to the map
var legendPanel = ui.Panel([legendTitle, colorBar, legendLabels]);
Map.add(legendPanel);
