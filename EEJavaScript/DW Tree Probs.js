var roi = ee.FeatureCollection("projects/ee-gee005systemiq/assets/Ruvuma/RVL_TZA_RUV_CAA");

/*
          Objective:
              1. Tree Probability extraction
              2. Desc statistic of probability
              
*/


//** Center on Object
// Map.centerObject (roi,8)

//** Create the boundary
var blank = ee.Image().byte()
var outline = blank.paint(roi,'red',2)
Map.addLayer (outline,{},'ROI Boundary')

//** Temporal scale
var startDate = '2020-06-01';
var endDate   = '2020-09-01';

//** Filter
var filter = ee.Filter.and( ee.Filter.bounds(roi),
                            ee.Filter.date(startDate, endDate));

// ** Dynamic Dataset
//** 1. Dynamic World Data 10mr
var dwCol = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
                .filter(filter)
                
print ('General Properties',dwCol.first())
print ('List of DW Bands', dwCol.first().bandNames())
print ('Image size within '+startDate+'/'+endDate,dwCol.size())

//** 2. Sentinel 2 Collection 10m TOA         
var s2Col = ee.ImageCollection('COPERNICUS/S2')
                .filter(filter)
                .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE',35))
                
                
//** Join Sentinel 2 TOA and Dynamic
// Join corresponding DW and S2 images (by system:index).
var DwS2Col = ee.Join.saveFirst('s2_img').apply(dwCol, s2Col,
    ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'}));
print ('Joined Data',DwS2Col)
                
//** Extract the probability
var tree_probs = ee.ImageCollection (DwS2Col) .select('trees')
                                              .median()
                                              .clip(roi)

print ('Tree Probs Data',tree_probs)                      

//** Visual Parameters
var viz_params = {min:0, max:1, palette: ['blue','green','yellow','red']}

//** Add legend
// set position of panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});
// Create legend title
var legendTitle = ui.Label({
  value: 'Probability (0-1)',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});
// Add the title to the panel
legend.add(legendTitle); 

// create the legend image
var lon = ee.Image.pixelLonLat().select('latitude');
var gradient = lon.multiply((viz_params.max-viz_params.min)/100.0).add(viz_params.min);
var legendImage = gradient.visualize(viz_params);
// create text on top of legend
var panel = ui.Panel({
    widgets: [
      ui.Label(viz_params['max'])
    ],
  });

legend.add(panel);
  
// create thumbnail from the image
var thumbnail = ui.Thumbnail({
  image: legendImage, 
  params: {bbox:'0,0,10,100', dimensions:'10x200'},  
  style: {padding: '1px', position: 'bottom-center'}
});

// add the thumbnail to the legend
legend.add(thumbnail);

// create text on top of legend
var panel = ui.Panel({
    widgets: [
      ui.Label(viz_params['min'])
    ],
  });

legend.add(panel);

Map.add(legend);
 
//** Visualize the probability
Map.addLayer (tree_probs,viz_params,'Trees Probability')

//** Thresholding
var abv_50 = tree_probs.gte(0.5).selfMask()
Map.addLayer (abv_50,{palette:'green'},'Tree Probs >50%')

//** Reclass 
var reclass = tree_probs.where(tree_probs.gte(0).and(tree_probs.lte(0.3)),1)
                        .where(tree_probs.gt(0.3).and(tree_probs.lte(0.6)),2)
                        .where(tree_probs.gt(0.6).and(tree_probs.lte(1)),3)
                        
var viz_reclass = {min:1,max:3,palette:['blue','lightgreen','red']}

Map.addLayer (reclass,viz_reclass,'Reclass Low Mid High Probability')

//** Statistic Extraction
var reducers = ee.Reducer.min().combine(ee.Reducer.max(),"",true).combine(ee.Reducer.stdDev(),"",true)
var desc_stats = tree_probs.reduceRegion({
                            reducer : reducers, 
                            geometry: roi, 
                            scale: 100, 
                            maxPixels:1e12, 
                            bestEffort:true,
                            tileScale: 16
                                            })
print ('Stats Summary',desc_stats)

//** Chart histogram
print (Chart.image.histogram({
                              image:tree_probs, 
                              region:roi, 
                              scale:20, 
                              maxPixels:1e12
                                            })) 
                                            
//** Create a legend of the map
//** 1)
// set position of panel
var legend = ui.Panel({
  style: {
    position: 'top-left',
    padding: '8px 15px'
  }
});

// Create legend title
var legendTitle = ui.Label({
  value: 'Probability Reclassification',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});

// Add the title to the panel
legend.add(legendTitle);

// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {

      // Create the label that is actually the colored box.
      var colorBox = ui.Label({
        style: {
          backgroundColor: '#' + color,
          // Use padding to give the box height and width.
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });

      // Create the label filled with the description text.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });

      // return the panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
};

//  Palette and class names
var palette = ['0000ff','90ee90','ff0000']
var names = [ 'Low (0 - 0.3)',
              'Medium (0.3-0-6)',
              'High (0.6 - 1)']

// Add color and and names
for (var i = 0; i < 3; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
// add legend to map (alternatively you can also print the legend to the console)
Map.add(legend);
