var ROI = ee.FeatureCollection("users/simongiandos/Carbon_Task_Force/Xingu_BRA_WGS84");

//** Created: November, 1st 2021
//** 1)
//** ESA Wolrd Land Cover map with 10m resolution**\\
//** Start
Map.centerObject(ROI);

//**-------------------------------------------------------------------------
//** Create a legend of the map
//** 1)
// set position of panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

// Create legend title
var legendTitle = ui.Label({
  value: 'Landcover Map 10 m',
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
var palette = [ '006400','ffbb22','ffff4c','f096ff',
                'fa0000','b4b4b4','f0f0f0','0064c8',
                '0096a0','00cf75','fae6a0'
              ]
var names = [ 'Trees','Shrubland','Grassland','Cropland','Built-up',
              'Barren / sparse vegetation','Snow and ice','Open water',
              'Herbaceous wetland','Mangroves','Moss and lichen'
            ]

// Add color and and names
for (var i = 0; i < 11; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  

// add legend to map (alternatively you can also print the legend to the console)
print(legend);

//** Import the data
var dataset_10m = ee.ImageCollection("ESA/WorldCover/v100")

//** Print properties into console
print('--Name of dataset--',dataset_10m.get('title'))

//** Image collection list
var listOfImages = dataset_10m.toList(dataset_10m.size());
// print ('Number of image',listOfImages)

//** Select image based on its index
var lc_img_1 = ee.Image(listOfImages.get(0));
print('--Image in--',lc_img_1.get('system:index'))

//** Select band--> "Map"
var landcover = lc_img_1.select('Map')

//** Reproject dataset into EPSG:32648
var projection = ee.Projection ('EPSG:32722');
var rep_dataset = landcover.reproject(projection,null,100);
// print ('After Reprojection into EPSG:EPSG:32722',rep_dataset);

//** Clip landcover within ROI
var lc_clipped_1 = rep_dataset.clip(ROI)

//** Define visualization paramater
var viz_param_1 = {
  bands: ['Map'],
};

//** Add layer onto canvas
Map.addLayer(lc_clipped_1, viz_param_1, "Landcover 10 m");
// //-----------------------------------------------------------
// // ** 2)
//**-------------------------------------------------------------------------
//** Create a legend of the map
// set position of panel
var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px 15px'
  }
});

// Create legend title
var legendTitle = ui.Label({
  value: 'Landcover Map 100 m',
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
var palette = [ '282828','FAE6A0','58481F','009900',
                '70663E','00CC00','4E751F','007800',
                '666000','8DB400','8D7400','A0DC00',
                '929900','648C00','FFBB22','000080',
                'FFFF4C','F096FF','FA0000','B4B4B4',
                'F0F0F0','0032C8','0096A0'
              ]
var names = [ 'Unknown','Moss and lichen','Closed forest, evergreen needle leaf','Closed forest, evergreen broad leaf','Closed forest, deciduous needle leaf',
              'Closed forest, deciduous broad leaf','Closed forest, mixed','Closed forest, not matching any of the other definitions',
              'Open forest, evergreen needle leaf','Open forest, evergreen broad leaf','Open forest, deciduous needle leaf','Open forest, deciduous broad leaf',
              'Open forest, mixed','Open forest, not matching any of the other definitions','Shrubs','Oceans, seas','Herbaceous vegetation',
              'Cultivated and managed vegetation / agriculture','Urban / built up','Bare / sparse vegetation','Snow and ice','Permanent water bodies',
              'Herbaceous wetland'
            ]
// Add color and and names
for (var i = 0; i < 23; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
// add legend to map (alternatively you can also print the legend to the console)
print(legend);

//** ESA Wolrd Land Cover map with 10m resolution**\\
var dataset_100m = ee.ImageCollection("COPERNICUS/Landcover/100m/Proba-V-C3/Global")

//** Print properties into console
// print('--Image Properties--',dataset_100m)
print('--Name of dataset--',dataset_100m.get('title'))

//** Image collection list
var listOfImages = dataset_100m.toList(dataset_100m.size());
// print ('Number of image',listOfImages)

//** Select image based on its index
var lc_img_2 = ee.Image(listOfImages.get(4));
print('--Image in--',lc_img_2.get('system:index'))

//** Select band--> "Map"
var landcover = lc_img_2.select('discrete_classification')

//** Reproject image using corresponding projection
var reproject = landcover.reproject(projection, null, 100)

//** Clip landcover within ROI
var lc_clipped_2 = reproject.clip(ROI)

//** Define visual parameter
var viz_param_2 = {};

//** Add layer onto canvas
Map.addLayer(lc_clipped_2, viz_param_2, "Landcover 100 m");

// **-------------------------------------------------------------------------------
// //** Create a split map 
var leftMap = ui.Map ()
var rightMap = ui.Map ()

var img_1 = ui.Map.Layer (lc_clipped_1, viz_param_1)
var img_2 = ui.Map.Layer (lc_clipped_2, viz_param_2)

var layer_1 = leftMap.layers()
var layer_2 = rightMap.layers()

layer_1.add(img_1)
layer_2.add(img_2)

var label_1 = ui.Label('Landcover 10 meter')
label_1.style()
          .set ('position','bottom-left')
          .set ('fontSize','20px')
          .set('fontWeight','bold');
var label_2 = ui.Label ('Landcover 100 meter')
label_2.style()
          .set ('position','bottom-right')
          .set ('fontSize','20px')
          .set('fontWeight','bold');
          
leftMap.add(label_1)
rightMap.add(label_2)

var splitPanel = ui.SplitPanel ({
  firstPanel : leftMap,
  secondPanel : rightMap,
  orientation : 'horizontal',
  wipe : true
});


ui.root.clear ();
ui.root.add (splitPanel);

var linkPanel = ui.Map.Linker ([leftMap,rightMap]);
leftMap.centerObject(ROI,12.5);
rightMap.centerObject (ROI,12.5);
