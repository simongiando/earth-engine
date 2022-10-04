//** Define timeframe
var start = '2020-01-01'
var end = '2020-06-30'

//** Cloud maskerp
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

var vegInd = function (img) {
  var fdi = img.expression (
    'NIR-(RED+GREEN)',{
    'NIR'   : img.select('B8'),
    'RED'   : img.select('B4'),
    'GREEN' : img.select('B3')
    }).rename('FDI')
  return img.addBands (fdi)
}
//** Dataset
var collection = ee.ImageCollection('COPERNICUS/S2_SR')
            .filterDate(start, end)
            .map(maskS2clouds)
            .map(vegInd)
            .median()
            .clip(roi)
print ('List of Bands', collection)

//** Masking the vegetation
var vegValue = RF2020.eq(1)
var vegetation = collection.updateMask(vegValue)

//** Extract FDI
var fdi = vegetation.select('FDI')

//** Forest Canopy Density Model
//** 3 Inputs (AVI, BSI & SI)
//** - Advanced Vegetation Index (AVI)
var avi = vegetation.expression(
    '(NIR+1)*(4096-RED)*(NIR-RED)', {
      'NIR': vegetation.select('B8'),
      'RED': vegetation.select('B4'),
  })
    avi = avi.pow(0.333).rename('AVI')

//** - Bare Soil Index (BSI)
var bsi = vegetation.expression(
    '((SWIR1 + RED) - (NIR + GREEN))/((SWIR1 + RED) + (NIR + GREEN))', {
      'NIR': vegetation.select('B8'),
      'RED': vegetation.select('B4'),
      'GREEN': vegetation.select('B3'),
      'SWIR1': vegetation.select('B11'),
})

var bsiscale = bsi.multiply(100).add(100).rename('BSI');

//** - Shadow Index (SI)
var si = vegetation.expression(
    '((4096 - GREEN) * (4096 - BLUE) *(4096 - RED))', {
      'RED': vegetation.select('B4'),
      'GREEN': vegetation.select('B3'),
      'BLUE': vegetation.select('B2'),
});
    si = si.pow(0.333).rename('SI')
    
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
var ssiscale = si.subtract(minsi).divide(maxsi.subtract(minsi)).multiply(100)

//** Perform Principle Compononent Analysis
//** Stack AVI and BSI
var avi_bsi = avi.addBands(bsiscale)
var bandNames = avi_bsi.bandNames()

//remove zeros
var good = avi_bsi.gte(0).or(avi_bsi.lte(0))
avi_bsi = avi_bsi.updateMask(good)

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
//Map.addLayer(avi_bsi,{}, "avi_bsi")
print("1", meanDict)
var means = ee.Image.constant(meanDict.values(bandNames));
print("2", means)
var centered = avi_bsi.subtract(means);
print(avi_bsi)

// Band names for PC bands
          
function getNewBandNames(prefix) {
  var seq = ee.List.sequence(1, bandNames.length());
  return seq.map(function(b) 
  {
    return ee.String(prefix).cat(ee.Number(b).int());
  });
}
//perform principal components with centered covariance
// Collapse the bands of the image into a 1D array per pixel.
var image = centered
var scale = 10
//var region = AOI
  var arrays = centered.toArray();
//Map.addLayer(centered)
  // Compute the covariance of the bands within the region.
  var covar = arrays.reduceRegion({
    reducer: ee.Reducer.centeredCovariance(),
    geometry: roi,
    scale: scale,
    maxPixels: 1e9,
    tileScale: 16,
    bestEffort: true
  });
print("covariates", covar)
  // Get the 'array' covariance result and cast to an array.
  // This represents the band-to-band covariance within the region.
  var covarArray = ee.Array(covar.get('array'));

  // Perform an eigen analysis and slice apart the values and vectors.
  var eigens = covarArray.eigen(); 

  // This is a P-length vector of Eigenvalues.
  var eigenValues = eigens.slice(1, 0, 1);
  // This is a PxP matrix with eigenvectors in rows.
  var eigenVectors = eigens.slice(1, 1);

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
    
  print(vdpca, 'VDPCA')

//** Get Vegetation Density (PC1)
var vd = vdpca.select('pc1')//.abs()

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
var fcd = fcd.subtract(ee.Number(1)).abs().rename('FCD')

//** Reclassify Forest and Non-Forest Based on FREL 30%
var forest = fcd.gte(30)

//** Visualize
Map.addLayer (forest,{},'Cek Forest')
Map.addLayer(fcd,{min:0,max:100,palette:["ff3508","d8ff04","06700e"]}, 'FCD ')
Map.addLayer(vdscale.clip(roi), {}, 'VD', false)
Map.addLayer (ssiscale, {}, 'SSI')
Map.addLayer (bsiscale,{},'BSI')
Map.addLayer (avi, {},'AVI')
Map.addLayer (fdi,{min:0,max:1},'FDI')
Map.addLayer (vegetation,{bands:['B8', 'B11', 'B12'], min:0, max: [0.5, 0.3, 0.3], gamma: 1.2},'RGB 8/11/12' ,0)

//** Graph
//** Histogram each input
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
